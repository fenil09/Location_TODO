import firebase_admin
import firebase_admin
from firebase_admin import credentials, firestore
import os

import json

def get_DB():
    if not firebase_admin._apps:
        cred = None

        # 1. Search all environment variables for any JSON string containing Firebase credentials
        for key, val in os.environ.items():
            if val and isinstance(val, str) and val.strip().startswith("{") and ("private_key" in val or "project_id" in val):
                try:
                    cred_dict = json.loads(val.strip())
                    cred = credentials.Certificate(cred_dict)
                    print(f"✅ Successfully loaded Firebase credentials from environment variable: '{key}'")
                    break
                except Exception as err:
                    print(f"⚠️ Failed parsing env var {key}: {err}")

        # 2. Search candidate file paths & /etc/secrets directory
        if not cred:
            possible_paths = [
                os.getenv("FIREBASE_KEY_PATH"),
                "/etc/secrets/firebase_key.json",
                "firebase_key.json",
                "/home/fenil/Desktop/Location_TODO/firebase_key.json"
            ]

            if os.path.exists("/etc/secrets"):
                try:
                    for fname in os.listdir("/etc/secrets"):
                        possible_paths.append(os.path.join("/etc/secrets", fname))
                except Exception:
                    pass

            for p in possible_paths:
                if p and os.path.exists(p) and os.path.isfile(p):
                    try:
                        cred = credentials.Certificate(p)
                        print(f"✅ Successfully loaded Firebase credentials from file: '{p}'")
                        break
                    except Exception as err:
                        print(f"⚠️ Failed loading key file {p}: {err}")

        if not cred:
            env_keys = [k for k in os.environ.keys() if not k.startswith("npm_")]
            secrets_contents = os.listdir("/etc/secrets") if os.path.exists("/etc/secrets") else "Directory /etc/secrets does not exist"
            raise FileNotFoundError(
                f"🔥 FIREBASE CREDENTIALS NOT FOUND!\n"
                f"Available Environment Variables on Render: {env_keys}\n"
                f"Files in /etc/secrets: {secrets_contents}\n"
                f"Troubleshooting: In Render Dashboard -> Environment, ensure you added 'FIREBASE_CREDENTIALS_JSON' or Secret File 'firebase_key.json' and saved changes."
            )

        firebase_admin.initialize_app(cred)

    return firestore.client()

db = get_DB()

if __name__ == "__main__":
    print(f"🔥 Successfully connected to Firebase Project: '{db.project}'!")



Collection_Name = "todos"

def create_todo(todo_Data:dict) -> dict:
    collection_ref = db.collection(Collection_Name)
    custom_id = todo_Data.get("id")

    if custom_id:
        doc_ref = collection_ref.document(custom_id)
        doc_ref.set(todo_Data)
    else:
        update_time, doc_ref = collection_ref.add(todo_Data)
        todo_Data["id"] = doc_ref.id
    
    return todo_Data


def get_all_todos():
    collectin_ref = db.collection(Collection_Name)
    docs = collectin_ref.stream()
    todos = []
    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        todos.append(data)
    return todos


def update_todo(todo_id:str,updates:dict)  -> dict:
    doc_ref = db.collection(Collection_Name).document(todo_id)
    clean_updates = {k:v for k,v in updates.items() if v is not None}

    if clean_updates:
        doc_ref.update(clean_updates)
    
    doc = doc_ref.get()
    if doc.exists:
        data = doc.to_dict()
        data["id"] = doc.id
        return data
    return {"id":todo_id,"message":"Todo not found"}


def delete_todo(todo_id:str) -> bool:
    doc_ref = db.collection(Collection_Name).document(todo_id)
    doc_ref.delete()
    return True
    
        
    






    
        
    