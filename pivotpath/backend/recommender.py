"""
Recommendation Engine — collaborative filtering using sparse cosine similarity.
Also contains the InterviewQueue priority heap for fair slot allocation.
"""
import heapq
import numpy as np
from typing import List, Dict, Optional
from scipy.sparse import csr_matrix
from sklearn.metrics.pairwise import cosine_similarity


# ─── Collaborative Filtering ─────────────────────────────────────────────────

class CredentialRecommender:
    """
    User-based collaborative filtering over a worker × credential matrix.
    Values = completion percentage (0-100).
    Uses scipy sparse CSR matrix for memory efficiency at scale.
    """

    def __init__(self):
        self.matrix: Optional[csr_matrix] = None
        self.worker_ids: List[str] = []
        self.credential_ids: List[str] = []

    def fit(self, enrollments: List[Dict]):
        """
        Build the sparse matrix from enrollment records.
        enrollments: list of {"worker_id", "credential_id", "progress_pct"}
        """
        if not enrollments:
            return

        # Build index maps
        worker_set = sorted(set(e["worker_id"] for e in enrollments))
        cred_set = sorted(set(e["credential_id"] for e in enrollments))
        self.worker_ids = worker_set
        self.credential_ids = cred_set

        w_idx = {w: i for i, w in enumerate(worker_set)}
        c_idx = {c: i for i, c in enumerate(cred_set)}

        rows, cols, vals = [], [], []
        for e in enrollments:
            rows.append(w_idx[e["worker_id"]])
            cols.append(c_idx[e["credential_id"]])
            vals.append(float(e.get("progress_pct", 0)))

        self.matrix = csr_matrix(
            (vals, (rows, cols)),
            shape=(len(worker_set), len(cred_set))
        )

    def recommend(self, worker_id: str, top_n: int = 3) -> List[Dict]:
        """
        Return top_n credential IDs not yet started by this worker,
        ranked by what similar workers completed.
        """
        if self.matrix is None or worker_id not in self.worker_ids:
            return []

        w_idx = self.worker_ids.index(worker_id)
        worker_vec = self.matrix[w_idx]

        # Cosine similarity against all other workers
        sims = cosine_similarity(worker_vec, self.matrix).flatten()
        sims[w_idx] = -1  # exclude self

        # Top 5 most similar workers
        top_similar = np.argsort(sims)[::-1][:5]

        # Credentials the current worker hasn't started (progress = 0)
        worker_row = np.array(self.matrix[w_idx].todense()).flatten()
        not_started = set(
            self.credential_ids[i]
            for i, v in enumerate(worker_row)
            if v == 0
        )

        # Score unseen credentials by weighted sum across similar workers
        scores: Dict[str, float] = {}
        for sim_w_idx in top_similar:
            sim = sims[sim_w_idx]
            if sim <= 0:
                continue
            sim_row = np.array(self.matrix[sim_w_idx].todense()).flatten()
            for c_idx, progress in enumerate(sim_row):
                cred_id = self.credential_ids[c_idx]
                if cred_id in not_started and progress > 0:
                    scores[cred_id] = scores.get(cred_id, 0) + sim * progress

        ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        return [{"credential_id": cid, "score": round(score, 2)} for cid, score in ranked[:top_n]]


# ─── Interview Priority Queue ─────────────────────────────────────────────────

class InterviewQueue:
    """
    Min-heap priority queue for fair interview slot allocation.
    Workers are ranked by: skill_match_score (60%) + completion_pct (40%).
    Higher combined score = higher priority = earlier slot.
    """

    def __init__(self):
        self._heap: List = []
        self._entry_count = 0  # tiebreaker

    def push(self, worker_id: str, skill_match_score: float, completion_pct: float):
        priority = -(skill_match_score * 0.6 + completion_pct * 0.4)
        heapq.heappush(self._heap, (priority, self._entry_count, worker_id))
        self._entry_count += 1

    def pop_next(self) -> Optional[str]:
        if not self._heap:
            return None
        _, _, worker_id = heapq.heappop(self._heap)
        return worker_id

    def peek_top_n(self, n: int) -> List[Dict]:
        top = heapq.nsmallest(n, self._heap)
        return [
            {"worker_id": wid, "priority_score": round(-pri, 2)}
            for pri, _, wid in top
        ]

    def size(self) -> int:
        return len(self._heap)


# ─── Dropout Risk Detection ───────────────────────────────────────────────────

class DropoutDetector:
    """
    Isolation Forest anomaly detection for identifying workers
    at risk of dropping out based on engagement signals.
    """

    def __init__(self):
        self.model = None
        self._fitted = False

    def fit(self, feature_matrix: np.ndarray):
        """
        Train on historical engagement features.
        Features per worker: [weekly_logins, weekly_coach_msgs,
                               progress_delta_7d, days_since_last_login]
        """
        from sklearn.ensemble import IsolationForest
        self.model = IsolationForest(contamination=0.15, random_state=42)
        self.model.fit(feature_matrix)
        self._fitted = True

    def predict_risk(self, features: np.ndarray) -> List[bool]:
        """
        Returns True for each worker with high dropout risk.
        Score < 0 from IsolationForest = anomaly = dropout risk.
        """
        if not self._fitted or self.model is None:
            return [False] * len(features)
        scores = self.model.decision_function(features)
        return (scores < -0.05).tolist()

    def risk_score(self, features: np.ndarray) -> List[float]:
        """Return raw anomaly scores (lower = higher risk)."""
        if not self._fitted or self.model is None:
            return [0.0] * len(features)
        return self.model.decision_function(features).tolist()


# Singletons
recommender = CredentialRecommender()
interview_queue = InterviewQueue()
dropout_detector = DropoutDetector()