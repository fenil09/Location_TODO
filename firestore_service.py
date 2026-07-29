import firebase_admin
import firebase_admin
from firebase_admin import credentials, firestore
import os

import json

def get_DB():
    if not firebase_admin._apps:
        # Check env var for path, secret file on Render, or relative local path
        key_path = os.getenv("FIREBASE_KEY_PATH", "firebase_key.json")
        env_json = os.getenv("FIREBASE_CREDENTIALS_JSON")

        if env_json:
            cred_dict = json.loads(env_json)
            cred = credentials.Certificate(cred_dict)
        elif os.path.exists(key_path):
            cred = credentials.Certificate(key_path)
        elif os.path.exists('/home/fenil/Desktop/Location_TODO/firebase_key.json'):
            cred = credentials.Certificate('/home/fenil/Desktop/Location_TODO/firebase_key.json')
        else:
            raise FileNotFoundError(f"Error: Firebase key file not found at '{key_path}'. Set FIREBASE_CREDENTIALS_JSON env var or upload Secret File on Render.")

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
    
        
    






    
        
    