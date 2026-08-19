import os
import json
import pymongo
from pymongo import MongoClient

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("MONGODB_DB_NAME", "saferoute")
PERSIST_FILE = os.path.join("uploads", "db_store.json")

class InMemoryMongoCollection:
    """Fall-back BSON/MongoDB collection store with JSON disk persistence."""
    def __init__(self, name, parent_db):
        self.name = name
        self.parent_db = parent_db
        self.data = parent_db.store.get(name, [])

    def _save(self):
        self.parent_db.store[self.name] = self.data
        self.parent_db.save_to_disk()

    def insert_one(self, doc):
        doc_copy = dict(doc)
        if "_id" not in doc_copy:
            import uuid
            doc_copy["_id"] = str(uuid.uuid4())
        self.data.append(doc_copy)
        self._save()
        class Result:
            inserted_id = doc_copy["_id"]
        return Result()

    def find_one(self, query=None, sort=None):
        res = self.find(query, limit=1, sort=sort)
        return res[0] if res else None

    def find(self, query=None, limit=0, sort=None):
        query = query or {}
        results = []
        for doc in self.data:
            match = True
            for k, v in query.items():
                if doc.get(k) != v:
                    match = False
                    break
            if match:
                results.append(dict(doc))
        if sort:
            key, direction = sort[0]
            results.sort(key=lambda x: x.get(key, ""), reverse=(direction < 0))
        if limit > 0:
            results = results[:limit]
        return results

    def update_one(self, query, update):
        doc = self.find_one(query)
        if doc:
            if "$set" in update:
                for k, v in update["$set"].items():
                    doc[k] = v
            for idx, item in enumerate(self.data):
                if item["_id"] == doc["_id"]:
                    self.data[idx] = doc
                    break
            self._save()
            class Result:
                modified_count = 1
            return Result()
        class Result:
            modified_count = 0
        return Result()

    def delete_one(self, query):
        doc = self.find_one(query)
        if doc:
            self.data = [d for d in self.data if d["_id"] != doc["_id"]]
            self._save()
            class Result:
                deleted_count = 1
            return Result()
        class Result:
            deleted_count = 0
        return Result()

    def count_documents(self, query):
        return len(self.find(query))

class InMemoryDatabase:
    def __init__(self):
        self.store = {}
        self.collections = {}
        self.load_from_disk()

    def load_from_disk(self):
        os.makedirs("uploads", exist_ok=True)
        if os.path.exists(PERSIST_FILE):
            try:
                with open(PERSIST_FILE, "r") as f:
                    self.store = json.load(f)
            except Exception:
                self.store = {}

    def save_to_disk(self):
        try:
            os.makedirs("uploads", exist_ok=True)
            with open(PERSIST_FILE, "w") as f:
                json.dump(self.store, f, indent=2)
        except Exception:
            pass

    def __getitem__(self, name):
        if name not in self.collections:
            self.collections[name] = InMemoryMongoCollection(name, self)
        return self.collections[name]

try:
    client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=1000)
    client.admin.command('ping')
    db = client[DB_NAME]
    print(f"[INFO] Connected to MongoDB at {MONGODB_URI}")
except Exception as e:
    print("[INFO] MongoDB daemon connection unavailable. Initializing embedded BSON storage engine with disk persistence.")
    db = InMemoryDatabase()

def get_db():
    return db
