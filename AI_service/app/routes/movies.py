from bson import ObjectId
from fastapi import APIRouter
from fastapi.encoders import jsonable_encoder

from app.db import db

router = APIRouter()


@router.get("/movies")
def get_all_movies():
    # Use `embedding.0` to check for a non-empty embedding array
    movies = list(db.movies.find({"embedding.0": {"$exists": True}}))
    payload = jsonable_encoder(movies, custom_encoder={ObjectId: str})
    return {"success": True, "count": len(payload), "data": payload}