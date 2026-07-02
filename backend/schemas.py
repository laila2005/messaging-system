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
    require_message_requests: Optional[bool] = None
    hide_phone_number: Optional[bool] = None

class UserResponse(BaseModel):
    id: int
    username: str
    email: Optional[str] = None
    phone_number: Optional[str] = None
    is_active: bool
    avatar_url: Optional[str] = None
    require_message_requests: bool = False
    hide_phone_number: bool = False

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class MessageCreate(BaseModel):
    content: str
    recipient_id: Optional[int] = None # None means broadcast
    location_lat: Optional[str] = None
    location_lng: Optional[str] = None
    is_disappearing: Optional[bool] = False
    reply_to_id: Optional[int] = None

class MessageResponse(BaseModel):
    id: int
    sender_id: int
    recipient_id: Optional[int]
    content: str
    timestamp: datetime
    status: str
    sender_username: str
    location_lat: Optional[str] = None
    location_lng: Optional[str] = None
    is_disappearing: bool = False
    reply_to_id: Optional[int] = None
    reply_to_username: Optional[str] = None
    reply_to_content: Optional[str] = None

    class Config:
        from_attributes = True

class ConnectionRequestResponse(BaseModel):
    id: int
    sender_id: int
    receiver_id: int
    status: str
    timestamp: datetime

    class Config:
        from_attributes = True

class ContactSyncRequest(BaseModel):
    contacts: list[str]

class ReactionCreate(BaseModel):
    emoji: str

class ReactionResponse(BaseModel):
    id: int
    message_id: int
    user_id: int
    emoji: str

    class Config:
        from_attributes = True
