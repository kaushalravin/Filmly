from fastapi import FastAPI
from app.routes import embed, movies, recommend
app=FastAPI()

@app.get("/")
def get_embeddings():
    return {"message": "Hello World"}

app.include_router(embed.router)
app.include_router(movies.router)
app.include_router(recommend.router)