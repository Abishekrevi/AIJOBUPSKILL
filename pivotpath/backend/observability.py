"""
PivotPath Observability — Upgrade 44
Distributed tracing with OpenTelemetry.
Every request gets a trace ID. Every internal span (DB, RAG, Groq, reranker)
is timed and reported. Pinpoints exactly which layer is slow.
Used by every MAANG company — Google invented Dapper which became OpenTelemetry.
"""
import os
import time
import functools
from typing import Optional, Callable
from contextlib import asynccontextmanager, contextmanager

# ─── Tracer setup ─────────────────────────────────────────────────────────────
_tracer = None
_meter = None
_request_counter = None
_latency_histogram = None


def init_telemetry(service_name: str = "pivotpath-api"):
    """
    Initialise OpenTelemetry tracer and meter.
    Exports to console (dev) or OTLP endpoint (prod via OTEL_EXPORTER_OTLP_ENDPOINT).
    """
    global _tracer, _meter, _request_counter, _latency_histogram
    try:
        from opentelemetry import trace, metrics
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
        from opentelemetry.sdk.metrics import MeterProvider
        from opentelemetry.sdk.metrics.export import (
            ConsoleMetricExporter, PeriodicExportingMetricReader
        )
        from opentelemetry.sdk.resources import Resource

        resource = Resource.create({"service.name": service_name,
                                    "service.version": "0.4.0"})

        # Trace provider
        tracer_provider = TracerProvider(resource=resource)

        # Use OTLP exporter if endpoint is configured, else console
        otlp_endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
        if otlp_endpoint:
            try:
                from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
                tracer_provider.add_span_processor(
                    BatchSpanProcessor(OTLPSpanExporter(endpoint=otlp_endpoint))
                )
            except ImportError:
                from opentelemetry.sdk.trace.export import ConsoleSpanExporter
                tracer_provider.add_span_processor(
                    BatchSpanProcessor(ConsoleSpanExporter())
                )
        else:
            from opentelemetry.sdk.trace.export import ConsoleSpanExporter
            tracer_provider.add_span_processor(
                BatchSpanProcessor(ConsoleSpanExporter())
            )

        trace.set_tracer_provider(tracer_provider)
        _tracer = trace.get_tracer(service_name)

        # Metrics provider
        reader = PeriodicExportingMetricReader(
            ConsoleMetricExporter(),
            export_interval_millis=60_000
        )
        meter_provider = MeterProvider(resource=resource, metric_readers=[reader])
        metrics.set_meter_provider(meter_provider)
        _meter = metrics.get_meter(service_name)

        # Create instruments
        _request_counter = _meter.create_counter(
            "http_requests_total",
            description="Total HTTP requests"
        )
        _latency_histogram = _meter.create_histogram(
            "http_request_duration_ms",
            description="Request latency in milliseconds"
        )

        print(f"[OTel] Telemetry initialised for service: {service_name}")
        return True
    except ImportError as e:
        print(f"[OTel] OpenTelemetry not available: {e}")
        return False
    except Exception as e:
        print(f"[OTel] Init error: {e}")
        return False


def get_tracer():
    return _tracer


# ─── Span context managers ────────────────────────────────────────────────────
@contextmanager
def trace_span(name: str, attributes: dict = None):
    """Synchronous span context manager."""
    if _tracer is None:
        yield None
        return
    with _tracer.start_as_current_span(name) as span:
        if attributes:
            for k, v in attributes.items():
                span.set_attribute(k, str(v))
        try:
            yield span
        except Exception as e:
            span.record_exception(e)
            span.set_status(
                __import__("opentelemetry.trace", fromlist=["StatusCode"]).StatusCode.ERROR
            )
            raise


@asynccontextmanager
async def async_trace_span(name: str, attributes: dict = None):
    """Async span context manager."""
    if _tracer is None:
        yield None
        return
    with _tracer.start_as_current_span(name) as span:
        if attributes:
            for k, v in attributes.items():
                span.set_attribute(k, str(v))
        try:
            yield span
        except Exception as e:
            span.record_exception(e)
            raise


# ─── Decorator for tracing functions ─────────────────────────────────────────
def traced(span_name: Optional[str] = None, attributes: dict = None):
    """Decorator to automatically trace a function call."""
    def decorator(func: Callable):
        name = span_name or f"{func.__module__}.{func.__name__}"

        if __import__("asyncio").iscoroutinefunction(func):
            @functools.wraps(func)
            async def async_wrapper(*args, **kwargs):
                if _tracer is None:
                    return await func(*args, **kwargs)
                with _tracer.start_as_current_span(name) as span:
                    if attributes:
                        for k, v in attributes.items():
                            span.set_attribute(k, str(v))
                    start = time.perf_counter()
                    try:
                        result = await func(*args, **kwargs)
                        span.set_attribute("duration_ms",
                                           round((time.perf_counter() - start) * 1000, 2))
                        return result
                    except Exception as e:
                        span.record_exception(e)
                        raise
            return async_wrapper
        else:
            @functools.wraps(func)
            def sync_wrapper(*args, **kwargs):
                if _tracer is None:
                    return func(*args, **kwargs)
                with _tracer.start_as_current_span(name) as span:
                    if attributes:
                        for k, v in attributes.items():
                            span.set_attribute(k, str(v))
                    start = time.perf_counter()
                    try:
                        result = func(*args, **kwargs)
                        span.set_attribute("duration_ms",
                                           round((time.perf_counter() - start) * 1000, 2))
                        return result
                    except Exception as e:
                        span.record_exception(e)
                        raise
            return sync_wrapper
    return decorator


# ─── FastAPI middleware ───────────────────────────────────────────────────────
async def telemetry_middleware(request, call_next):
    """
    FastAPI middleware — traces every HTTP request with:
    - trace_id injected into response headers
    - request method, path, status code as span attributes
    - latency recorded to histogram
    """
    start = time.perf_counter()
    trace_id = "no-trace"

    if _tracer:
        with _tracer.start_as_current_span(
            f"{request.method} {request.url.path}",
            kind=__import__(
                "opentelemetry.trace",
                fromlist=["SpanKind"]
            ).SpanKind.SERVER
        ) as span:
            span.set_attribute("http.method", request.method)
            span.set_attribute("http.url", str(request.url))
            span.set_attribute("http.route", request.url.path)
            client_ip = request.client.host if request.client else "unknown"
            span.set_attribute("net.peer.ip", client_ip)

            try:
                ctx = span.get_span_context()
                trace_id = format(ctx.trace_id, "032x") if ctx else "no-trace"
            except Exception:
                pass

            response = await call_next(request)

            duration_ms = round((time.perf_counter() - start) * 1000, 2)
            span.set_attribute("http.status_code", response.status_code)
            span.set_attribute("duration_ms", duration_ms)

            if _request_counter:
                _request_counter.add(1, {
                    "method": request.method,
                    "path": request.url.path,
                    "status": str(response.status_code)
                })
            if _latency_histogram:
                _latency_histogram.record(duration_ms, {
                    "method": request.method,
                    "path": request.url.path
                })

            response.headers["X-Trace-ID"] = trace_id
            return response
    else:
        response = await call_next(request)
        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        response.headers["X-Request-Duration-Ms"] = str(duration_ms)
        return response
