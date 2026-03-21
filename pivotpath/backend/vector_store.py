"""
PivotPath Vector Store — Production RAG Pipeline
Implements upgrades 11-14, 17, 20, 23:
  11. Hybrid BM25 + vector search (Reciprocal Rank Fusion)
  12. Cross-encoder reranker — top-k precision boost
  13. (spaCy NER skill extraction — in nlp_pipeline.py)
  14. Semantic chunking — context-aware document splitting
  17. HyDE — Hypothetical Document Embeddings for cold-start
  20. Contextual compression — LexRank extractive summarisation
  23. Conversational memory summarisation — rolling compression
"""

import os
import uuid
from typing import List, Optional

# ─── Lazy-loaded globals ──────────────────────────────────────────────────────
_collection = None
_model = None
_reranker = None
_corpus_cache: dict[str, list[str]] = {}   # worker_id → list of document strings


def _get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def _get_reranker():
    """Upgrade 12: Cross-encoder reranker (lazy-loaded)."""
    global _reranker
    if _reranker is None:
        try:
            from sentence_transformers import CrossEncoder
            _reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
        except Exception as e:
            print(f"[Reranker] load error: {e}")
    return _reranker


def _get_collection():
    global _collection
    if _collection is None:
        import chromadb
        client = chromadb.Client()
        _collection = client.get_or_create_collection(
            name="coach_memory",
            metadata={"hnsw:space": "cosine"}
        )
    return _collection


# ─── Upgrade 14: Semantic chunking ───────────────────────────────────────────
def semantic_chunk(text: str, threshold: float = 0.45,
                   max_chunk_tokens: int = 300) -> List[str]:
    """
    Split text at semantic boundaries (cosine similarity drops between sentences).
    Falls back to whole text if too short.
    """
    sentences = [s.strip() for s in text.replace("\n", " ").split(". ") if s.strip()]
    if len(sentences) <= 2:
        return [text]
    try:
        import numpy as np
        model = _get_model()
        embeddings = model.encode(sentences, show_progress_bar=False)
        chunks, chunk = [], [sentences[0]]
        for i in range(1, len(sentences)):
            # cosine similarity between consecutive sentences
            a, b = embeddings[i - 1], embeddings[i]
            sim = float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-8))
            if sim < threshold:
                chunks.append(". ".join(chunk) + ".")
                chunk = []
            chunk.append(sentences[i])
            # also split if chunk is too long
            if len(" ".join(chunk).split()) > max_chunk_tokens:
                chunks.append(". ".join(chunk) + ".")
                chunk = []
        if chunk:
            chunks.append(". ".join(chunk) + ".")
        return [c for c in chunks if len(c.strip()) > 20]
    except Exception as e:
        print(f"[Chunker] error: {e}")
        return [text]


# ─── Upgrade 20: Contextual compression (LexRank) ────────────────────────────
def compress_context(text: str, max_sentences: int = 3) -> str:
    """
    Extract the most important sentences from a document using LexRank.
    Reduces token usage by ~60% while preserving core meaning.
    """
    try:
        from sumy.parsers.plaintext import PlaintextParser
        from sumy.nlp.tokenizers import Tokenizer
        from sumy.summarizers.lex_rank import LexRankSummarizer
        parser = PlaintextParser.from_string(text, Tokenizer("english"))
        summarizer = LexRankSummarizer()
        summary = summarizer(parser.document, max_sentences)
        result = " ".join(str(s) for s in summary)
        return result if result.strip() else text
    except Exception:
        # graceful fallback — return first N sentences
        sentences = text.split(". ")
        return ". ".join(sentences[:max_sentences]) + "."


# ─── Upgrade 11: Reciprocal Rank Fusion ──────────────────────────────────────
def _rrf_merge(vec_results: List[str], bm25_results: List[str],
               k: int = 60) -> List[str]:
    """
    Merge vector and BM25 ranked lists using Reciprocal Rank Fusion.
    RRF score = sum(1 / (k + rank)) across all rankers.
    """
    scores: dict[str, float] = {}
    for rank, doc in enumerate(vec_results):
        scores[doc] = scores.get(doc, 0) + 1.0 / (k + rank + 1)
    for rank, doc in enumerate(bm25_results):
        scores[doc] = scores.get(doc, 0) + 1.0 / (k + rank + 1)
    return [doc for doc, _ in sorted(scores.items(), key=lambda x: x[1], reverse=True)]


# ─── Upgrade 12: Cross-encoder reranking ─────────────────────────────────────
def rerank(query: str, documents: List[str], top_n: int = 3) -> List[str]:
    """
    Re-score documents against the query using a cross-encoder.
    Much more accurate than cosine similarity for final selection.
    """
    if not documents:
        return []
    reranker = _get_reranker()
    if not reranker:
        return documents[:top_n]
    try:
        pairs = [[query, doc] for doc in documents]
        scores = reranker.predict(pairs)
        ranked = sorted(zip(scores, documents), reverse=True)
        return [doc for _, doc in ranked[:top_n]]
    except Exception as e:
        print(f"[Reranker] error: {e}")
        return documents[:top_n]


# ─── Core: store exchange ─────────────────────────────────────────────────────
def store_exchange(worker_id: str, user_msg: str, assistant_msg: str):
    """
    Upgrade 14: Semantically chunk the exchange before storing.
    Each chunk is embedded and stored as a separate vector.
    """
    try:
        model = _get_model()
        collection = _get_collection()
        combined = f"User: {user_msg}\nAlex: {assistant_msg}"
        chunks = semantic_chunk(combined)
        for chunk in chunks:
            embedding = model.encode(chunk).tolist()
            collection.add(
                embeddings=[embedding],
                documents=[chunk],
                ids=[str(uuid.uuid4())],
                metadatas=[{"worker_id": worker_id, "user_msg": user_msg[:200]}]
            )
        # Update local BM25 corpus cache
        if worker_id not in _corpus_cache:
            _corpus_cache[worker_id] = []
        _corpus_cache[worker_id].extend(chunks)
    except Exception as e:
        print(f"[VectorStore] store error: {e}")


# ─── Upgrade 11: Hybrid BM25 + vector retrieval ───────────────────────────────
def hybrid_retrieve(worker_id: str, query: str, k: int = 5) -> List[str]:
    """
    Combine BM25 keyword search + vector semantic search via RRF,
    then rerank with cross-encoder for final precision.
    """
    # Vector search
    vec_results = _vector_search(worker_id, query, k=k * 2)

    # BM25 keyword search over cached corpus
    bm25_results = _bm25_search(worker_id, query, k=k * 2)

    if not vec_results and not bm25_results:
        return []

    # Merge with RRF
    merged = _rrf_merge(vec_results, bm25_results)

    # Upgrade 12: Rerank merged results
    reranked = rerank(query, merged, top_n=k)

    # Upgrade 20: Compress each result to reduce token waste
    compressed = [compress_context(doc, max_sentences=3) for doc in reranked]

    return compressed


def _vector_search(worker_id: str, query: str, k: int = 10) -> List[str]:
    """Pure cosine-similarity vector search."""
    try:
        model = _get_model()
        collection = _get_collection()
        if collection.count() == 0:
            return []
        q_embedding = model.encode(query).tolist()
        results = collection.query(
            query_embeddings=[q_embedding],
            where={"worker_id": worker_id},
            n_results=min(k, max(1, collection.count()))
        )
        return results["documents"][0] if results["documents"] else []
    except Exception as e:
        print(f"[VectorStore] vector search error: {e}")
        return []


def _bm25_search(worker_id: str, query: str, k: int = 10) -> List[str]:
    """BM25 keyword search over the in-memory corpus cache."""
    corpus = _corpus_cache.get(worker_id, [])
    if not corpus:
        return []
    try:
        from rank_bm25 import BM25Okapi
        tokenized_corpus = [doc.lower().split() for doc in corpus]
        bm25 = BM25Okapi(tokenized_corpus)
        scores = bm25.get_scores(query.lower().split())
        import numpy as np
        top_indices = scores.argsort()[::-1][:k]
        return [corpus[i] for i in top_indices if scores[i] > 0]
    except Exception as e:
        print(f"[BM25] error: {e}")
        return []


# ─── Upgrade 17: HyDE cold-start retrieval ───────────────────────────────────
async def hyde_retrieve(worker_id: str, query: str, k: int = 3,
                        groq_caller=None) -> List[str]:
    """
    Hypothetical Document Embeddings:
    For new workers with no history, generate a hypothetical ideal answer,
    embed it, and use that embedding for retrieval.
    """
    # Check if worker has enough history for normal retrieval
    corpus = _corpus_cache.get(worker_id, [])
    if len(corpus) >= 3:
        return hybrid_retrieve(worker_id, query, k=k)

    if groq_caller is None:
        return hybrid_retrieve(worker_id, query, k=k)

    try:
        # Generate a hypothetical ideal answer
        hypothetical = await groq_caller(
            messages=[{"role": "user", "content":
                       f"Write a short ideal career coaching answer to: {query}"}],
            system="You write ideal career coaching answers. Be specific, practical, and under 100 words."
        )
        # Embed the hypothetical answer and search
        model = _get_model()
        collection = _get_collection()
        h_embed = model.encode(hypothetical).tolist()
        if collection.count() > 0:
            results = collection.query(
                query_embeddings=[h_embed],
                n_results=min(k, collection.count())
            )
            docs = results["documents"][0] if results["documents"] else []
            return rerank(query, docs, top_n=k)
    except Exception as e:
        print(f"[HyDE] error: {e}")

    return hybrid_retrieve(worker_id, query, k=k)


# ─── Upgrade 23: Conversational memory summarisation ─────────────────────────
async def get_compressed_history(worker_id: str, sessions: list,
                                  groq_caller=None) -> dict:
    """
    For workers with many sessions, summarise older exchanges into a compact
    memory string and only keep recent sessions in full detail.
    Cuts prompt token usage by ~70% for long conversations.
    """
    if len(sessions) <= 6:
        return {"recent": sessions, "summary": None}

    recent = sessions[:6]
    older = sessions[6:]

    if groq_caller is None:
        return {"recent": recent, "summary": None}

    try:
        old_text = "\n".join(
            f"User: {s.message}\nAlex: {s.response}"
            for s in older
        )
        summary = await groq_caller(
            messages=[{"role": "user", "content":
                       f"Summarise this coaching conversation history in 3 concise sentences:\n\n{old_text}"}],
            system="You summarise career coaching conversations. Be specific about skills, goals, and progress mentioned. Under 80 words."
        )
        return {"recent": recent, "summary": summary}
    except Exception as e:
        print(f"[MemorySummariser] error: {e}")
        return {"recent": recent, "summary": None}


# ─── Backwards-compatible alias ───────────────────────────────────────────────
def retrieve_context(worker_id: str, query: str, k: int = 3) -> List[str]:
    """Backwards-compatible wrapper — now uses full hybrid pipeline."""
    return hybrid_retrieve(worker_id, query, k=k)
