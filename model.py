from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class Task(BaseModel):
    id: Optional[str] = Field(default=None, description="Optional custom or generated task ID")
    title: str = Field(..., description="The title of the task")
    description: Optional[str] = Field(default="", description="The description of the task")
    latitude: float = Field(..., description="The latitude of the task")
    longitude: float = Field(..., description="The longitude of the task")
    address_name: Optional[str] = Field(default="", description="The address name of the task")
    radius_meters: int = Field(100, description="The radius of the task in meters")

class TodoCreate(Task):
    pass

class TodoUpdate(BaseModel):
    title: Optional[str] = Field(default=None, description="The title of the task")
    description: Optional[str] = Field(default=None, description="The description of the task")
    latitude: Optional[float] = Field(default=None, description="The latitude of the task")
    longitude: Optional[float] = Field(default=None, description="The longitude of the task")
    address_name: Optional[str] = Field(default=None, description="The address name of the task")
    radius_meters: Optional[int] = Field(default=None, description="The radius of the task in meters")
    completed: Optional[bool] = None

class TodoResponse(Task):
    id: str
    completed: bool = False
    created_at: Optional[str] = Field(default_factory=lambda: datetime.utcnow().isoformat())
