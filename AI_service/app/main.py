from fastapi import FastAPI
from app.routes import embed
app=FastAPI()

@app.get("/")
def get_embeddings():
    return {"message": "Hello World"}

app.include_router(embed.router)