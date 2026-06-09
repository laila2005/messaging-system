from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class UserCreate(BaseModel):
    username: str
    password: str
    email: Optional[str] = None
    phone_number: Optional[str] = None

class UserUpdate(BaseModel):
    email: Optional[str] = None
    phone_number: Optional[str] = None

class UserResponse(BaseModel):
    id: int
    username: str
    email: Optional[str] = None
    phone_number: Optional[str] = None
    is_active: bool
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class MessageCreate(BaseModel):
    content: str
    recipient_id: Optional[int] = None # None means broadcast

class MessageResponse(BaseModel):
    id: int
    sender_id: int
    recipient_id: Optional[int]
    content: str
    timestamp: datetime
    status: str
    sender_username: str

    class Config:
        from_attributes = True
