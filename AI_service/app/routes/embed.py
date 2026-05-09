from fastapi import APIRouter
from app.model import model
from pydantic import BaseModel

router=APIRouter()

class TextInput(BaseModel):
    text:str

@router.post("/analyze")
def embed(data: TextInput):
    embedding=model.encode(data.text)
    print(f"Generated embedding for text length {len(data.text)}")
    return {"embedding":embedding.tolist()}