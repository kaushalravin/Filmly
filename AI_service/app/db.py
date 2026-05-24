import os

from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "filmly")

if not MONGO_URI:
    raise RuntimeError("MONGO_URI is not configured")

client = MongoClient(MONGO_URI)
db = client[MONGO_DB_NAME]