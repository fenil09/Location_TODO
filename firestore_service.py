import firebase_admin
import firebase_admin
from firebase_admin import credentials, firestore
import os

import json

def get_DB():
    if not firebase_admin._apps:
        env_json = os.getenv("FIREBASE_CREDENTIALS_JSON")

        # List candidate paths to check for the key file
        possible_paths = [
            os.getenv("FIREBASE_KEY_PATH"),
            "/etc/secrets/firebase_key.json",  # Render's default Secret File location
            "firebase_key.json",                 # Project root
            "/home/fenil/Desktop/Location_TODO/firebase_key.json"
        ]

        # Auto-discover any .json file in Render's secret directory
        if os.path.exists("/etc/secrets"):
            try:
                for fname in os.listdir("/etc/secrets"):
                    if fname.endswith(".json"):
                        possible_paths.append(os.path.join("/etc/secrets", fname))
            except Exception:
                pass
        
        found_path = None
        for p in possible_paths:
            if p and os.path.exists(p):
                found_path = p
                break

        if env_json:
            try:
                cred_dict = json.loads(env_json.strip())
                cred = credentials.Certificate(cred_dict)
            except Exception as err:
                raise ValueError(f"Failed to parse FIREBASE_CREDENTIALS_JSON environment variable: {err}")
        elif found_path:
            cred = credentials.Certificate(found_path)
        else:
            secrets_contents = os.listdir("/etc/secrets") if os.path.exists("/etc/secrets") else "/etc/secrets directory does not exist"
            raise FileNotFoundError(
                f"Error: Firebase key file not found.\n"
                f"Checked paths: {possible_paths}\n"
                f"/etc/secrets contents: {secrets_contents}\n"
                f"Please add Environment Variable 'FIREBASE_CREDENTIALS_JSON' or Secret File 'firebase_key.json' in Render Dashboard."
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
    
        
    






    
        
    