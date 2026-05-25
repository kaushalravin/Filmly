"""Build a FAISS index from movies with embeddings.

Usage examples:
    python scripts/build_faiss.py --endpoint http://localhost:8000/movies --out-dir ./data
    python scripts/build_faiss.py --out-dir ./data   # uses direct DB access
"""
import argparse
import json
from pathlib import Path
import sys

import numpy as np
import httpx

# Ensure the project root is on sys.path so `import app` works when running this script directly
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

try:
    import faiss
except Exception as e:
    raise RuntimeError("faiss is required. Install faiss-cpu in your venv (pip install faiss-cpu).") from e


def fetch_movies_from_endpoint(endpoint: str):
    resp = httpx.get(endpoint, timeout=30.0)
    resp.raise_for_status()
    body = resp.json()
    return body.get("data", [])


def fetch_movies_from_db():
    # Local DB access: import app.db (will read env)
    from app.db import db

    movies = list(db.movies.find({"embedding.0": {"$exists": True}}))
    # Convert ObjectId to str for serializable meta
    for m in movies:
        m["_id"] = str(m["_id"])
    return movies


def build_index(movies, out_dir: Path, normalize: bool = True):
    if not movies:
        raise ValueError("No movies provided to build index")

    vectors = []
    meta = []

    for i, m in enumerate(movies):
        emb = m.get("embedding")
        if not emb:
            continue
        vec = np.array(emb, dtype="float32")
        vectors.append(vec)
        meta.append({
            "idx": len(meta),
            "_id": m.get("_id"),
            "tmdbId": m.get("tmdbId"),
            "title": m.get("title"),
        })

    if not vectors:
        raise ValueError("No embeddings found in provided movies")

    X = np.vstack(vectors)

    if normalize:
        # Normalize rows for cosine similarity using inner product
        faiss.normalize_L2(X)

    d = X.shape[1]
    index = faiss.IndexFlatIP(d)
    index.add(X)

    out_dir.mkdir(parents=True, exist_ok=True)
    index_path = out_dir / "faiss_movie.index"
    meta_path = out_dir / "faiss_movie_meta.json"
    np_path = out_dir / "faiss_movie_embeddings.npy"

    faiss.write_index(index, str(index_path))
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    # Save raw (normalized) embeddings as well for inspection
    np.save(np_path, X)

    return index_path, meta_path, np_path


def rebuild_faiss_index(out_dir: str = "./data", endpoint: str | None = None, normalize: bool = True):
    """Fetch movies and rebuild the FAISS index on disk.

    Returns a dict with output paths and counts.
    """
    if endpoint:
        print(f"Fetching movies from endpoint: {endpoint}")
        movies = fetch_movies_from_endpoint(endpoint)
    else:
        print("Fetching movies directly from MongoDB (app.db)")
        movies = fetch_movies_from_db()

    print(f"Found {len(movies)} movies (with embeddings filter applied by source)")

    out_path = Path(out_dir)
    idx_path, meta_path, np_path = build_index(movies, out_path, normalize=normalize)

    return {
        "count": len(movies),
        "index_path": str(idx_path),
        "meta_path": str(meta_path),
        "embeddings_path": str(np_path),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--endpoint", help="AI service movies endpoint URL (e.g. http://localhost:8000/movies)")
    parser.add_argument("--out-dir", default="./data", help="Output directory for index and metadata")
    parser.add_argument("--no-normalize", dest="normalize", action="store_false", help="Disable L2 normalization (if you prefer)")
    args = parser.parse_args()

    result = rebuild_faiss_index(out_dir=args.out_dir, endpoint=args.endpoint, normalize=args.normalize)

    print("FAISS index built:")
    print(f" - count: {result['count']}")
    print(f" - index: {result['index_path']}")
    print(f" - meta:  {result['meta_path']}")
    print(f" - numpy: {result['embeddings_path']}")


if __name__ == "__main__":
    main()
