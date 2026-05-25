import asyncio
from contextlib import suppress

from fastapi import FastAPI

from app.routes import embed, movies, recommend
from scripts.build_faiss import rebuild_faiss_index
app=FastAPI()

_faiss_scheduler_task = None


async def _faiss_scheduler_loop():
    # Rebuild immediately on startup, then every 15 minutes.
    while True:
        try:
            result = await asyncio.to_thread(rebuild_faiss_index, out_dir="./data")
            print(
                f"[faiss] rebuilt index with {result['count']} movies -> {result['index_path']}"
            )
        except Exception as error:
            print(f"[faiss] rebuild failed: {error}")

        await asyncio.sleep(15 * 60)


@app.on_event("startup")
async def start_faiss_scheduler():
    global _faiss_scheduler_task
    if _faiss_scheduler_task is None or _faiss_scheduler_task.done():
        _faiss_scheduler_task = asyncio.create_task(_faiss_scheduler_loop())


@app.on_event("shutdown")
async def stop_faiss_scheduler():
    global _faiss_scheduler_task
    if _faiss_scheduler_task and not _faiss_scheduler_task.done():
        _faiss_scheduler_task.cancel()
        with suppress(asyncio.CancelledError):
            await _faiss_scheduler_task
        _faiss_scheduler_task = None

@app.get("/")
def get_embeddings():
    return {"message": "Hello World"}

app.include_router(embed.router)
app.include_router(movies.router)
app.include_router(recommend.router)