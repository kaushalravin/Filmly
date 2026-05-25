from typing import List, Optional
import json
from pathlib import Path

import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from scripts.build_faiss import rebuild_faiss_index

router = APIRouter()


class EmbeddingQuery(BaseModel):
    embedding: List[float]
    k: Optional[int] = 15


_INDEX = None
_META = None
_D = None


def _load_faiss():
    try:
        import importlib
        faiss = importlib.import_module("faiss")
        return faiss
    except Exception:
        raise HTTPException(status_code=500, detail="faiss is not installed; install faiss-cpu in the AI_service venv")


def _load_index_and_meta(index_path: str = "./data/faiss_movie.index", meta_path: str = "./data/faiss_movie_meta.json"):
    global _INDEX, _META, _D
    if _INDEX is not None and _META is not None:
        return

    idx_p = Path(index_path)
    meta_p = Path(meta_path)
    if not idx_p.exists() or not meta_p.exists():
        raise HTTPException(status_code=500, detail="FAISS index or metadata not found. Build it with scripts/build_faiss.py")

    faiss = _load_faiss()
    _INDEX = faiss.read_index(str(idx_p))
    with open(meta_p, "r", encoding="utf-8") as f:
        _META = json.load(f)

    _D = _INDEX.d


@router.post("/recommend")
def recommend(query: EmbeddingQuery):
    _load_index_and_meta()

    vec = np.array(query.embedding, dtype="float32")
    if vec.ndim != 1:
        raise HTTPException(status_code=400, detail="embedding must be a 1-D list of floats")

    if _D is None:
        raise HTTPException(status_code=500, detail="Index not loaded correctly")

    if vec.shape[0] != _D:
        raise HTTPException(status_code=400, detail=f"embedding dimension mismatch (expected {_D})")

    faiss = _load_faiss()
    # normalize for cosine (index built with normalized vectors)
    faiss.normalize_L2(vec.reshape(1, -1))

    k = max(1, min(100, int(query.k)))
    D, I = _INDEX.search(vec.reshape(1, -1), k)

    results = []
    for score, idx in zip(D[0].tolist(), I[0].tolist()):
        if idx < 0:
            continue
        meta = _META[idx]
        results.append({
            "score": float(score),
            "idx": meta.get("idx"),
            "movie_id": meta.get("_id"),
            "tmdbId": meta.get("tmdbId"),
            "title": meta.get("title"),
        })

    return {"success": True, "k": len(results), "results": results}


@router.post("/rebuild-index")
def rebuild_index_now():
    try:
        result = rebuild_faiss_index(out_dir="./data")
        return {"success": True, "message": "FAISS index rebuilt", "data": result}
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))
