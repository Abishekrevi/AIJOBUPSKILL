"""
PivotPath Reliability Patterns
Implements upgrades 46 + 47:
  46. Circuit breaker — graceful Groq/external API degradation
  47. Event-driven architecture — async in-process event bus
"""

import asyncio
import time
from enum import Enum
from typing import Callable, Optional, Any, Dict, List
from collections import defaultdict, deque


# ─── Upgrade 46: Circuit Breaker ─────────────────────────────────────────────
class CircuitState(Enum):
    CLOSED = "closed"        # Normal operation — requests pass through
    OPEN = "open"            # Failing — requests blocked, fallback used
    HALF_OPEN = "half_open"  # Testing recovery — one probe request allowed


class CircuitBreaker:
    """
    Netflix Hystrix-inspired circuit breaker.
    Prevents cascading failures when Groq API / ChromaDB / Redis goes down.
    States: CLOSED → (threshold failures) → OPEN → (timeout) → HALF_OPEN → CLOSED

    Used at Google, Amazon, Netflix for every external dependency.
    """

    def __init__(
        self,
        name: str,
        failure_threshold: int = 3,
        recovery_timeout: float = 60.0,
        success_threshold: int = 2,
        timeout: float = 30.0,
    ):
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.success_threshold = success_threshold
        self.timeout = timeout

        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time: Optional[float] = None
        self._total_calls = 0
        self._total_failures = 0
        self._total_successes = 0
        self._response_times: deque = deque(maxlen=100)

    def _should_attempt(self) -> bool:
        if self.state == CircuitState.CLOSED:
            return True
        if self.state == CircuitState.OPEN:
            if time.time() - (self.last_failure_time or 0) > self.recovery_timeout:
                self.state = CircuitState.HALF_OPEN
                self.success_count = 0
                print(f"[CircuitBreaker:{self.name}] → HALF_OPEN (probing recovery)")
                return True
            return False
        if self.state == CircuitState.HALF_OPEN:
            return True
        return False

    def _on_success(self, duration: float):
        self._total_calls += 1
        self._total_successes += 1
        self._response_times.append(duration)
        if self.state == CircuitState.HALF_OPEN:
            self.success_count += 1
            if self.success_count >= self.success_threshold:
                self.state = CircuitState.CLOSED
                self.failure_count = 0
                print(f"[CircuitBreaker:{self.name}] → CLOSED (recovered)")
        elif self.state == CircuitState.CLOSED:
            self.failure_count = max(0, self.failure_count - 1)

    def _on_failure(self, exc: Exception):
        self._total_calls += 1
        self._total_failures += 1
        self.failure_count += 1
        self.last_failure_time = time.time()
        if self.state == CircuitState.HALF_OPEN:
            self.state = CircuitState.OPEN
            print(f"[CircuitBreaker:{self.name}] → OPEN (probe failed: {exc})")
        elif self.failure_count >= self.failure_threshold:
            self.state = CircuitState.OPEN
            print(f"[CircuitBreaker:{self.name}] → OPEN ({self.failure_count} failures)")

    async def call(self, fn: Callable, *args,
                   fallback: Optional[Callable] = None, **kwargs) -> Any:
        """Execute fn through the circuit breaker with optional fallback."""
        if not self._should_attempt():
            if fallback:
                return fallback(*args, **kwargs) if not asyncio.iscoroutinefunction(fallback) \
                    else await fallback(*args, **kwargs)
            raise Exception(f"Circuit {self.name} is OPEN — service unavailable")

        start = time.perf_counter()
        try:
            if asyncio.iscoroutinefunction(fn):
                result = await asyncio.wait_for(fn(*args, **kwargs), timeout=self.timeout)
            else:
                result = fn(*args, **kwargs)
            self._on_success(time.perf_counter() - start)
            return result
        except asyncio.TimeoutError as e:
            self._on_failure(e)
            if fallback:
                return fallback(*args, **kwargs) if not asyncio.iscoroutinefunction(fallback) \
                    else await fallback(*args, **kwargs)
            raise
        except Exception as e:
            self._on_failure(e)
            if fallback:
                return fallback(*args, **kwargs) if not asyncio.iscoroutinefunction(fallback) \
                    else await fallback(*args, **kwargs)
            raise

    def stats(self) -> dict:
        avg_rt = (
            sum(self._response_times) / len(self._response_times)
            if self._response_times else 0
        )
        return {
            "name": self.name,
            "state": self.state.value,
            "failure_count": self.failure_count,
            "total_calls": self._total_calls,
            "total_failures": self._total_failures,
            "total_successes": self._total_successes,
            "error_rate": round(
                self._total_failures / max(self._total_calls, 1), 3
            ),
            "avg_response_time_ms": round(avg_rt * 1000, 2),
            "last_failure_ago_secs": (
                round(time.time() - self.last_failure_time, 1)
                if self.last_failure_time else None
            ),
        }

    def reset(self):
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time = None


# ─── Upgrade 47: Async Event Bus ─────────────────────────────────────────────
class EventBus:
    """
    In-process async event bus for decoupled service communication.
    Publishers fire events without knowing who handles them.
    Handlers run as background asyncio tasks — non-blocking.

    Scales to RabbitMQ/Kafka when needed by swapping the transport layer.
    Used by every MAANG microservice architecture.
    """

    def __init__(self):
        self._handlers: Dict[str, List[Callable]] = defaultdict(list)
        self._middleware: List[Callable] = []
        self._event_log: deque = deque(maxlen=1000)  # recent event history
        self._stats: Dict[str, int] = defaultdict(int)

    def subscribe(self, event: str, handler: Callable):
        """Register a handler for an event type."""
        self._handlers[event].append(handler)

    def unsubscribe(self, event: str, handler: Callable):
        if handler in self._handlers[event]:
            self._handlers[event].remove(handler)

    def use(self, middleware: Callable):
        """Add middleware that runs before every handler."""
        self._middleware.append(middleware)

    async def publish(self, event: str, payload: dict):
        """
        Publish an event. All handlers run as background tasks.
        Non-blocking — the caller gets control back immediately.
        """
        self._stats[event] += 1
        self._event_log.append({
            "event": event,
            "payload_keys": list(payload.keys()),
            "timestamp": time.time(),
        })

        handlers = self._handlers.get(event, []) + self._handlers.get("*", [])
        for handler in handlers:
            asyncio.create_task(self._safe_handle(handler, event, payload))

    async def _safe_handle(self, handler: Callable, event: str, payload: dict):
        """Run handler with error isolation — one failure doesn't affect others."""
        try:
            # Run middleware
            for mw in self._middleware:
                payload = await mw(event, payload) if asyncio.iscoroutinefunction(mw) \
                    else mw(event, payload)
            # Run handler
            if asyncio.iscoroutinefunction(handler):
                await handler(payload)
            else:
                handler(payload)
        except Exception as e:
            print(f"[EventBus] handler error for '{event}': {e}")

    def recent_events(self, n: int = 20) -> list:
        return list(self._event_log)[-n:]

    def stats(self) -> dict:
        return {
            "total_event_types": len(self._handlers),
            "registered_handlers": sum(len(v) for v in self._handlers.values()),
            "event_counts": dict(self._stats),
        }


# ─── Event type constants ─────────────────────────────────────────────────────
class AppEvent:
    CREDENTIAL_COMPLETED   = "credential.completed"
    CREDENTIAL_ENROLLED    = "credential.enrolled"
    WORKER_PLACED          = "worker.placed"
    WORKER_CREATED         = "worker.created"
    INTERVIEW_BOOKED       = "interview.booked"
    DROPOUT_RISK_DETECTED  = "dropout.risk_detected"
    LOGIN_ANOMALY          = "auth.login_anomaly"
    SKILL_SIGNALS_UPDATED  = "signals.updated"
    RAG_EVAL_COMPLETE      = "rag.eval_complete"


# ─── Singletons ───────────────────────────────────────────────────────────────
groq_breaker = CircuitBreaker(
    name="groq",
    failure_threshold=3,
    recovery_timeout=60.0,
    timeout=30.0
)
redis_breaker = CircuitBreaker(
    name="redis",
    failure_threshold=5,
    recovery_timeout=30.0,
    timeout=5.0
)
chromadb_breaker = CircuitBreaker(
    name="chromadb",
    failure_threshold=3,
    recovery_timeout=45.0,
    timeout=10.0
)

bus = EventBus()


# ─── Default event handlers ───────────────────────────────────────────────────
async def _handle_credential_completed(payload: dict):
    """When a credential is completed: push WebSocket notification."""
    worker_id = payload.get("worker_id")
    credential_id = payload.get("credential_id")
    if worker_id:
        try:
            from main import push_notification
            await push_notification(worker_id, "credential_completed", {
                "message": "🎉 Credential completed! Check your employer matches.",
                "credential_id": credential_id,
            })
        except Exception:
            pass


async def _handle_dropout_risk(payload: dict):
    """When dropout risk is detected: log to audit trail."""
    try:
        from database import AsyncSessionLocal
        from audit_log import log_event
        async with AsyncSessionLocal() as db:
            await log_event(db, "DROPOUT_RISK_DETECTED",
                            actor_id=payload.get("worker_id"),
                            actor_role="system",
                            payload=payload)
    except Exception:
        pass


async def _handle_interview_booked(payload: dict):
    """When an interview is booked: push notification to worker."""
    worker_id = payload.get("worker_id")
    if worker_id:
        try:
            from main import push_notification
            await push_notification(worker_id, "interview_booked", {
                "message": f"✅ Interview confirmed with {payload.get('employer_name', 'employer')}!",
                "date": payload.get("slot_date"),
                "time": payload.get("slot_time"),
            })
        except Exception:
            pass


# Register default handlers
bus.subscribe(AppEvent.CREDENTIAL_COMPLETED, _handle_credential_completed)
bus.subscribe(AppEvent.DROPOUT_RISK_DETECTED, _handle_dropout_risk)
bus.subscribe(AppEvent.INTERVIEW_BOOKED, _handle_interview_booked)
