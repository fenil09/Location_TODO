from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import os

from model import TodoCreate, TodoResponse, TodoUpdate
from firestore_service import create_todo, get_all_todos,update_todo,delete_todo
from geo_utils import iswithin_radius

app = FastAPI(title="GeoTask API", version="1.0.0")

# Enable CORS for browser requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serves API status info at root endpoint
@app.get("/")
async def root_api_info():
    """Returns API health and status information."""
    return {
        "status": "online",
        "service": "GeoTask Backend API",
        "version": "1.0.0",
        "docs": "/docs"
    }

@app.get("/api/todos")
async def fetch_all_todos():
    """Returns all stored location tasks from Firestore."""
    try:
        return get_all_todos()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/todos", response_model=TodoResponse, status_code=201)
async def create_todo_endpoint(todo: TodoCreate):
    """
    Receives JSON payload from frontend, validates with TodoCreate, 
    and saves directly to Firebase Firestore!
    """
    try:
        todo_dict = todo.model_dump()
        saved_todo = create_todo(todo_dict)
        return saved_todo
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/api/todos/{todo_id}")
async def update_todo_endpoint(todo_id: str, updates: TodoUpdate):
    try:
        update_dict = updates.model_dump(exclude_unset=True)
        return update_todo(todo_id, update_dict)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/todos/{todo_id}")
async def delete_todo_endpoint(todo_id: str):
    try:
        delete_todo(todo_id)
        return {"success": True, "deleted_id": todo_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@app.get("/api/todos/nearby")
async def fetch_nearby_todos(lat:float,lng:float):
    try:
        all_todos = get_all_todos()
        annotate_todos = []

        for todo in all_todos:
            task_lat = todo.get("latitude")
            task_lng = todo.get("longitude")
            radius = todo.get("radius_meters",100)

            if task_lat is not None and task_lng is not None:
                is_inside , dist = iswithin_radius(lat,lng,task_lat,task_lng,radius)
                todo["distance_meters"] = dist
                todo["is_inside"] = is_inside
            
            else:
                todo["distance_meters"] = None
                todo["is_inside"] = False
            
            annotate_todos.append(todo)
        
        annotate_todos.sort(key = lambda t: t["distance_meters"] if t["distance_meters"] is not None else float("inf"))
    
        return annotate_todos
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
                

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
