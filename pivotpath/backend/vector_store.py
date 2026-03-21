"""
RAG Vector Store — persistent semantic memory for the AI coach.
Each coach conversation is embedded and stored. On each new message,
the top-k most relevant past exchanges are retrieved and injected
into the system prompt so Alex remembers everything intelligently.
"""
import os
import uuid
from typing import List

# Lazy imports to avoid startup cost on cold boot
_collection = None
_model = None

def _get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model

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

def store_exchange(worker_id: str, user_msg: str, assistant_msg: str):
    """Embed and store a coach exchange in the vector store."""
    try:
        model = _get_model()
        collection = _get_collection()
        combined = f"User: {user_msg}\nAlex: {assistant_msg}"
        embedding = model.encode(combined).tolist()
        collection.add(
            embeddings=[embedding],
            documents=[combined],
            ids=[str(uuid.uuid4())],
            metadatas=[{"worker_id": worker_id, "user_msg": user_msg[:200]}]
        )
    except Exception as e:
        print(f"[VectorStore] store error: {e}")

def retrieve_context(worker_id: str, query: str, k: int = 3) -> List[str]:
    """Retrieve top-k most semantically relevant past exchanges for this worker."""
    try:
        model = _get_model()
        collection = _get_collection()
        if collection.count() == 0:
            return []
        q_embedding = model.encode(query).tolist()
        results = collection.query(
            query_embeddings=[q_embedding],
            where={"worker_id": worker_id},
            n_results=min(k, collection.count())
        )
        return results["documents"][0] if results["documents"] else []
    except Exception as e:
        print(f"[VectorStore] retrieve error: {e}")
        return []