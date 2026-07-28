import json
import jwt
import os
import shutil
from typing import Dict, List, Set
from collections import defaultdict
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, status, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel

from . import database, models, schemas, auth
from .database import engine

# Create DB tables (We will use Alembic later for migrations, this is just for initial dev)
models.Base.metadata.create_all(bind=engine)

# Ensure uploads directory exists. Use /tmp for writable storage in Hugging Face Docker.
UPLOAD_DIR = "/tmp/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

app = FastAPI(title="Zagel API")

# Serve static files for avatars
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Connection Manager for WebSockets supporting Multi-Device Concurrent Connections
class ConnectionManager:
    def __init__(self):
        # Maps user_id to set of active WebSocket connections across all devices
        self.active_connections: Dict[int, Set[WebSocket]] = defaultdict(set)

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        self.active_connections[user_id].add(websocket)

    def disconnect(self, websocket: WebSocket, user_id: int):
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def send_personal_message(self, message: str, user_id: int):
        if user_id in self.active_connections:
            dead_sockets = []
            for ws in list(self.active_connections[user_id]):
                try:
                    await ws.send_text(message)
                except Exception:
                    dead_sockets.append(ws)
            for ws in dead_sockets:
                self.disconnect(ws, user_id)

    async def broadcast(self, message: str, exclude_user_id: int = None):
        for uid, connections in list(self.active_connections.items()):
            if uid != exclude_user_id:
                dead_sockets = []
                for ws in list(connections):
                    try:
                        await ws.send_text(message)
                    except Exception:
                        dead_sockets.append(ws)
                for ws in dead_sockets:
                    self.disconnect(ws, uid)

manager = ConnectionManager()

# --- REST ENDPOINTS ---

@app.post("/register")
def register(user: schemas.UserCreate, db: Session = Depends(database.get_db)):
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed_password = auth.get_password_hash(user.password)
    db_user = models.User(
        username=user.username, 
        hashed_password=hashed_password,
        email=user.email,
        phone_number=user.phone_number
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@app.post("/token")
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = auth.create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me", response_model=schemas.UserResponse)
def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user

@app.get("/users/by-username/{username}", response_model=schemas.UserResponse)
def get_user_by_username(username: str, db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@app.post("/users/me/avatar", response_model=schemas.UserResponse)
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    file_extension = file.filename.split(".")[-1]
    file_name = f"avatar_{current_user.id}.{file_extension}"
    file_path = os.path.join(UPLOAD_DIR, file_name)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    current_user.avatar_url = f"/uploads/{file_name}"
    db.commit()
    db.refresh(current_user)
    
    # Broadcast update
    async def notify_avatar_update():
        await manager.broadcast(json.dumps({
            "type": "system",
            "content": f"{current_user.username} updated their profile picture"
        }))
    await notify_avatar_update()
    
    return current_user

@app.post("/messages/attachment")
async def upload_attachment(
    file: UploadFile = File(...),
    current_user: models.User = Depends(auth.get_current_user)
):
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    import uuid
    file_extension = file.filename.split(".")[-1]
    file_name = f"attachment_{uuid.uuid4().hex}.{file_extension}"
    file_path = os.path.join(UPLOAD_DIR, file_name)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return {"attachment_url": f"/uploads/{file_name}"}

class ChatContext(BaseModel):
    messages: list[str]

@app.post("/ai/smart-replies")
async def generate_smart_replies(context: ChatContext, current_user: models.User = Depends(auth.get_current_user)):
    # Mock LLM implementation for generating smart replies based on context
    last_msg = context.messages[-1].lower() if context.messages else ""
    if "hello" in last_msg or "hi" in last_msg:
        return {"replies": ["Hi there!", "Hello! How can I help?", "Hey!"]}
    if "meeting" in last_msg or "call" in last_msg:
        return {"replies": ["Sure, let's do it.", "I'm available now.", "Can we schedule for later?"]}
    if "?" in last_msg:
        return {"replies": ["Yes, absolutely.", "I need to check on that.", "No, I don't think so."]}
    
    return {"replies": ["Got it.", "Thanks!", "Sounds good to me."]}

@app.post("/ai/summarize")
async def summarize_chat(context: ChatContext, current_user: models.User = Depends(auth.get_current_user)):
    if not context.messages:
        return {"summary": "No messages to summarize."}
    return {"summary": "The team discussed the upcoming project milestones, scheduled a follow-up meeting, and confirmed the deployment timeline."}

import re
import httpx
from fastapi import Query

@app.get("/api/link-preview")
async def link_preview(url: str = Query(...)):
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"}
            resp = await client.get(url, headers=headers, follow_redirects=True)
            if resp.status_code != 200:
                return {}
            
            html = resp.text
            
            # Extract og title/desc/image using flexible regex that handles quotes/newlines
            og_title = re.search(r'<meta\s+[^>]*property=["\']og:title["\']\s+[^>]*content=["\'](.*?)["\']', html, re.I | re.S)
            if not og_title:
                og_title = re.search(r'<meta\s+[^>]*content=["\'](.*?)["\']\s+[^>]*property=["\']og:title["\']', html, re.I | re.S)
                
            og_desc = re.search(r'<meta\s+[^>]*property=["\']og:description["\']\s+[^>]*content=["\'](.*?)["\']', html, re.I | re.S)
            if not og_desc:
                og_desc = re.search(r'<meta\s+[^>]*content=["\'](.*?)["\']\s+[^>]*property=["\']og:description["\']', html, re.I | re.S)
                
            og_image = re.search(r'<meta\s+[^>]*property=["\']og:image["\']\s+[^>]*content=["\'](.*?)["\']', html, re.I | re.S)
            if not og_image:
                og_image = re.search(r'<meta\s+[^>]*content=["\'](.*?)["\']\s+[^>]*property=["\']og:image["\']', html, re.I | re.S)
            
            title = og_title.group(1) if og_title else ""
            if not title:
                t_match = re.search(r'<title>(.*?)</title>', html, re.I | re.S)
                title = t_match.group(1) if t_match else ""
                
            desc = og_desc.group(1) if og_desc else ""
            if not desc:
                d_match = re.search(r'<meta\s+name=["\']description["\']\s+content=["\'](.*?)["\']', html, re.I | re.S)
                if not d_match:
                    d_match = re.search(r'<meta\s+content=["\'](.*?)["\']\s+[^>]*name=["\']description["\']', html, re.I | re.S)
                desc = d_match.group(1) if d_match else ""
                
            image = og_image.group(1) if og_image else ""
            
            return {
                "title": title.strip() if title else None,
                "description": desc.strip() if desc else None,
                "image": image.strip() if image else None,
                "url": url
            }
    except Exception as e:
        return {"error": str(e)}

@app.get("/messages")
def get_chat_history(
    target_username: str = None,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if target_username:
        target_user = db.query(models.User).filter(models.User.username == target_username).first()
        if not target_user:
            return []
        messages = db.query(models.Message).filter(
            ((models.Message.sender_id == current_user.id) & (models.Message.recipient_id == target_user.id)) |
            ((models.Message.sender_id == target_user.id) & (models.Message.recipient_id == current_user.id))
        ).order_by(models.Message.timestamp.asc()).all()
    else:
        messages = db.query(models.Message).filter(
            models.Message.recipient_id == None
        ).order_by(models.Message.timestamp.asc()).all()

    result = []
    for m in messages:
        sender = db.query(models.User).filter(models.User.id == m.sender_id).first()
        recipient = db.query(models.User).filter(models.User.id == m.recipient_id).first() if m.recipient_id else None
        
        reply_to_msg = db.query(models.Message).filter(models.Message.id == m.reply_to_id).first() if m.reply_to_id else None
        reply_to_sender = db.query(models.User).filter(models.User.id == reply_to_msg.sender_id).first() if reply_to_msg else None

        result.append({
            "id": m.id,
            "sender_id": m.sender_id,
            "sender_username": sender.username if sender else "Unknown",
            "recipient_id": m.recipient_id,
            "recipient_username": recipient.username if recipient else None,
            "content": m.content,
            "attachment_url": m.attachment_url,
            "location_lat": m.location_lat,
            "location_lng": m.location_lng,
            "is_disappearing": m.is_disappearing,
            "reply_to_id": m.reply_to_id,
            "reply_to_username": reply_to_sender.username if reply_to_sender else None,
            "reply_to_content": reply_to_msg.content if reply_to_msg else None,
            "timestamp": m.timestamp.isoformat()
        })
    return result

@app.delete("/messages")
def clear_chat_history(
    target_username: str = None,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if target_username:
        target_user = db.query(models.User).filter(models.User.username == target_username).first()
        if not target_user:
            raise HTTPException(status_code=404, detail="User not found")
        deleted = db.query(models.Message).filter(
            ((models.Message.sender_id == current_user.id) & (models.Message.recipient_id == target_user.id)) |
            ((models.Message.sender_id == target_user.id) & (models.Message.recipient_id == current_user.id))
        ).delete()
    else:
        # Clear only messages sent by current_user to the global broadcast to prevent clearing everyone's messages
        deleted = db.query(models.Message).filter(
            models.Message.recipient_id == None,
            models.Message.sender_id == current_user.id
        ).delete()
    db.commit()
    return {"message": f"Deleted {deleted} messages."}

@app.put("/users/me", response_model=schemas.UserResponse)
def update_user_details(
    user_update: schemas.UserUpdate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    if user_update.email is not None:
        current_user.email = user_update.email
    if user_update.phone_number is not None:
        current_user.phone_number = user_update.phone_number
    if user_update.require_message_requests is not None:
        current_user.require_message_requests = user_update.require_message_requests
    if user_update.hide_phone_number is not None:
        current_user.hide_phone_number = user_update.hide_phone_number
        
    db.commit()
    db.refresh(current_user)
    return current_user

@app.post("/contacts/sync", response_model=List[schemas.UserResponse])
def sync_contacts(sync_request: schemas.ContactSyncRequest, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    users = db.query(models.User).filter(models.User.phone_number.in_(sync_request.contacts)).all()
    return users

@app.post("/users/block/{target_username}")
def block_user(target_username: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    target_user = db.query(models.User).filter(models.User.username == target_username).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    existing = db.query(models.BlockedUser).filter(models.BlockedUser.blocker_id == current_user.id, models.BlockedUser.blocked_id == target_user.id).first()
    if not existing:
        new_block = models.BlockedUser(blocker_id=current_user.id, blocked_id=target_user.id)
        db.add(new_block)
        db.commit()
    return {"status": "blocked"}

@app.delete("/users/block/{target_username}")
def unblock_user(target_username: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    target_user = db.query(models.User).filter(models.User.username == target_username).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    existing = db.query(models.BlockedUser).filter(models.BlockedUser.blocker_id == current_user.id, models.BlockedUser.blocked_id == target_user.id).first()
    if existing:
        db.delete(existing)
        db.commit()
    return {"status": "unblocked"}

@app.post("/messages", response_model=schemas.MessageResponse)
def create_message(
    message: schemas.MessageCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    if message.recipient_id:
        recipient = db.query(models.User).filter(models.User.id == message.recipient_id).first()
        if not recipient:
            raise HTTPException(status_code=404, detail="Recipient not found")
        is_blocked = db.query(models.BlockedUser).filter(
            models.BlockedUser.blocker_id == message.recipient_id,
            models.BlockedUser.blocked_id == current_user.id
        ).first()
        if is_blocked:
            raise HTTPException(status_code=403, detail="You are blocked by this user")

    new_msg = models.Message(
        sender_id=current_user.id,
        recipient_id=message.recipient_id,
        content=message.content,
        location_lat=message.location_lat,
        location_lng=message.location_lng,
        is_disappearing=message.is_disappearing,
        reply_to_id=message.reply_to_id
    )
    db.add(new_msg)
    db.commit()
    db.refresh(new_msg)
    
    reply_to_msg = db.query(models.Message).filter(models.Message.id == new_msg.reply_to_id).first() if new_msg.reply_to_id else None
    reply_to_sender = db.query(models.User).filter(models.User.id == reply_to_msg.sender_id).first() if reply_to_msg else None

    setattr(new_msg, "sender_username", current_user.username)
    setattr(new_msg, "reply_to_username", reply_to_sender.username if reply_to_sender else None)
    setattr(new_msg, "reply_to_content", reply_to_msg.content if reply_to_msg else None)
    return new_msg

@app.get("/users/online", response_model=List[schemas.UserResponse])
def get_online_users(db: Session = Depends(database.get_db)):
    online_ids = list(manager.active_connections.keys())
    if not online_ids:
        return []
    users = db.query(models.User).filter(models.User.id.in_(online_ids)).all()
    return users

@app.get("/users", response_model=List[schemas.UserResponse])
def get_all_users(db: Session = Depends(database.get_db)):
    users = db.query(models.User).all()
    return users

# --- CONNECTION SYSTEM ---

@app.post("/connections/request/{target_username}")
async def create_connection_request(
    target_username: str,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    target_user = db.query(models.User).filter(models.User.username == target_username).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    if target_user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot send request to yourself")
    
    existing = db.query(models.ConnectionRequest).filter(
        models.ConnectionRequest.sender_id == current_user.id,
        models.ConnectionRequest.receiver_id == target_user.id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Request already exists")
    
    new_request = models.ConnectionRequest(sender_id=current_user.id, receiver_id=target_user.id)
    db.add(new_request)
    db.commit()
    db.refresh(new_request)

    await manager.send_personal_message(json.dumps({
        "type": "connection_request",
        "sender": current_user.username
    }), target_user.id)

    return new_request

@app.post("/connections/accept/{request_id}")
def accept_connection_request(
    request_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    req = db.query(models.ConnectionRequest).filter(models.ConnectionRequest.id == request_id).first()
    if not req or req.receiver_id != current_user.id:
        raise HTTPException(status_code=404, detail="Request not found")
    req.status = "accepted"
    db.commit()
    return {"status": "accepted"}

@app.post("/connections/reject/{request_id}")
def reject_connection_request(
    request_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    req = db.query(models.ConnectionRequest).filter(models.ConnectionRequest.id == request_id).first()
    if not req or req.receiver_id != current_user.id:
        raise HTTPException(status_code=404, detail="Request not found")
    req.status = "rejected"
    db.commit()
    return {"status": "rejected"}

@app.get("/connections")
def get_connections(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    incoming = db.query(models.ConnectionRequest).filter(
        models.ConnectionRequest.receiver_id == current_user.id,
        models.ConnectionRequest.status == "pending"
    ).all()
    
    accepted_requests = db.query(models.ConnectionRequest).filter(
        models.ConnectionRequest.status == "accepted",
        ((models.ConnectionRequest.sender_id == current_user.id) | (models.ConnectionRequest.receiver_id == current_user.id))
    ).all()
    
    friends = []
    for req in accepted_requests:
        friend_id = req.receiver_id if req.sender_id == current_user.id else req.sender_id
        friend = db.query(models.User).filter(models.User.id == friend_id).first()
        if friend:
            friends.append(schemas.UserResponse.model_validate(friend))
            
    incoming_responses = []
    for req in incoming:
        sender = db.query(models.User).filter(models.User.id == req.sender_id).first()
        receiver = db.query(models.User).filter(models.User.id == req.receiver_id).first()
        resp = schemas.ConnectionRequestResponse.model_validate(req)
        resp.requester_username = sender.username if sender else None
        resp.target_username = receiver.username if receiver else None
        incoming_responses.append(resp)
    return {"friends": friends, "incoming_requests": incoming_responses}

# --- PHASE 12: ENTERPRISE COMPLIANCE ---
@app.delete("/admin/retention")
def apply_data_retention(
    days: int = 30,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin privileges required")
    from datetime import datetime, timedelta, timezone
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    deleted = db.query(models.Message).filter(models.Message.timestamp < cutoff).delete()
    db.commit()
    return {"message": f"Deleted {deleted} messages older than {days} days."}

# --- WEBSOCKET ENDPOINT ---

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str, db: Session = Depends(database.get_db)):
    try:
        payload = jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        username: str = payload.get("sub")
        user = db.query(models.User).filter(models.User.username == username).first()
        if user is None:
            await websocket.accept()
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
    except Exception:
        await websocket.accept()
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await manager.connect(websocket, user.id)
    
    # Deliver missed messages
    missed_msgs = db.query(models.Message).filter(
        models.Message.recipient_id == user.id,
        models.Message.status == "sent"
    ).order_by(models.Message.timestamp.asc()).all()
    
    for msg in missed_msgs:
        sender = db.query(models.User).filter(models.User.id == msg.sender_id).first()
        reply_to_msg = db.query(models.Message).filter(models.Message.id == msg.reply_to_id).first() if msg.reply_to_id else None
        reply_to_sender = db.query(models.User).filter(models.User.id == reply_to_msg.sender_id).first() if reply_to_msg else None

        out_msg = {
            "type": "message",
            "id": msg.id,
            "sender_id": msg.sender_id,
            "sender_username": sender.username if sender else "Unknown",
            "recipient_id": user.id,
            "recipient_username": user.username,
            "content": msg.content,
            "attachment_url": msg.attachment_url,
            "location_lat": msg.location_lat,
            "location_lng": msg.location_lng,
            "is_disappearing": msg.is_disappearing,
            "reply_to_id": msg.reply_to_id,
            "reply_to_username": reply_to_sender.username if reply_to_sender else None,
            "reply_to_content": reply_to_msg.content if reply_to_msg else None,
            "timestamp": msg.timestamp.isoformat(),
            "status": "delivered"
        }
        await manager.send_personal_message(json.dumps(out_msg), user.id)
        msg.status = "delivered"
    
    if missed_msgs:
        db.commit()
    
    # Broadcast user joined
    await manager.broadcast(json.dumps({
        "type": "system",
        "content": f"{user.username} joined the chat"
    }), exclude_user_id=user.id)

    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            msg_type = message_data.get("type", "message")
            recipient_id = message_data.get("recipient_id") # None if broadcast
            if recipient_id is not None:
                try:
                    recipient_id = int(recipient_id)
                except (ValueError, TypeError):
                    pass
            
            if msg_type == "ping":
                continue

            # Handle WebRTC Signaling and Typing indicators
            if msg_type in ["webrtc_offer", "webrtc_answer", "webrtc_ice", "webrtc_hangup", "typing"]:
                if recipient_id is not None:
                    signal_payload = {
                        "type": msg_type,
                        "sender_username": user.username,
                        "sender_id": user.id,
                        "payload": message_data.get("payload")
                    }
                    if "withVideo" in message_data:
                        signal_payload["withVideo"] = message_data.get("withVideo")
                    await manager.send_personal_message(json.dumps(signal_payload), recipient_id)
                continue

            if msg_type == "mark_read":
                sender_id = message_data.get("sender_id")
                if sender_id is not None:
                    try:
                        sender_id = int(sender_id)
                    except (ValueError, TypeError):
                        pass
                unread_msgs = db.query(models.Message).filter(
                    models.Message.recipient_id == user.id,
                    models.Message.sender_id == sender_id,
                    models.Message.status.in_(["sent", "delivered"])
                ).all()
                for msg in unread_msgs:
                    msg.status = "read"
                if unread_msgs:
                    db.commit()
                    # Notify the sender in real-time
                    await manager.send_personal_message(json.dumps({
                        "type": "messages_read",
                        "reader_username": user.username,
                        "reader_id": user.id,
                        "sender_id": sender_id
                    }), sender_id)
                continue
            
            if msg_type == "reaction":
                message_id = message_data.get("message_id")
                emoji = message_data.get("emoji")
                target_msg = db.query(models.Message).filter(models.Message.id == message_id).first()
                if target_msg:
                    reaction = models.MessageReaction(message_id=message_id, user_id=user.id, emoji=emoji)
                    db.add(reaction)
                    db.commit()
                    db.refresh(reaction)
                    
                    reaction_payload = {
                        "type": "reaction",
                        "message_id": message_id,
                        "user_id": user.id,
                        "emoji": emoji
                    }
                    if target_msg.recipient_id:
                        if target_msg.recipient_id != user.id:
                            await manager.send_personal_message(json.dumps(reaction_payload), target_msg.recipient_id)
                        if target_msg.sender_id != user.id:
                            await manager.send_personal_message(json.dumps(reaction_payload), target_msg.sender_id)
                    else:
                        await manager.broadcast(json.dumps(reaction_payload))
                continue
            
            content = message_data.get("content")
            attachment_url = message_data.get("attachment_url")
            
            # Phase 12 Content Moderation (Global Broadcast only)
            TOXIC_WORDS = ["spam", "abuse", "hate", "scam"]
            if not recipient_id and content:
                if any(word in content.lower() for word in TOXIC_WORDS):
                    await manager.send_personal_message(json.dumps({
                        "type": "system",
                        "content": "Message blocked: Violates community guidelines."
                    }), user.id)
                    continue

            recipient_username = None
            if recipient_id:
                # check if blocked
                is_blocked = db.query(models.BlockedUser).filter(
                    models.BlockedUser.blocker_id == recipient_id,
                    models.BlockedUser.blocked_id == user.id
                ).first()
                if is_blocked:
                    # Drop message silently
                    continue

                recipient_user = db.query(models.User).filter(models.User.id == recipient_id).first()
                if recipient_user:
                    recipient_username = recipient_user.username
            
            # Save to DB
            location_lat = message_data.get("location_lat")
            location_lng = message_data.get("location_lng")
            is_disappearing = message_data.get("is_disappearing", False)
            reply_to_id = message_data.get("reply_to_id")

            new_msg = models.Message(
                sender_id=user.id,
                recipient_id=recipient_id,
                content=content,
                attachment_url=attachment_url,
                location_lat=location_lat,
                location_lng=location_lng,
                is_disappearing=is_disappearing,
                reply_to_id=reply_to_id
            )
            db.add(new_msg)
            db.commit()
            db.refresh(new_msg)
            
            reply_to_msg = db.query(models.Message).filter(models.Message.id == reply_to_id).first() if reply_to_id else None
            reply_to_sender = db.query(models.User).filter(models.User.id == reply_to_msg.sender_id).first() if reply_to_msg else None

            out_msg = {
                "type": "message",
                "id": new_msg.id,
                "sender_id": user.id,
                "sender_username": user.username,
                "recipient_id": recipient_id,
                "recipient_username": recipient_username,
                "content": content,
                "attachment_url": attachment_url,
                "location_lat": location_lat,
                "location_lng": location_lng,
                "is_disappearing": is_disappearing,
                "reply_to_id": reply_to_id,
                "reply_to_username": reply_to_sender.username if reply_to_sender else None,
                "reply_to_content": reply_to_msg.content if reply_to_msg else None,
                "timestamp": new_msg.timestamp.isoformat(),
                "status": "sent"
            }
            
            if recipient_id:
                # Direct message
                if recipient_id != user.id:
                    await manager.send_personal_message(json.dumps(out_msg), recipient_id)
                # Send back to sender for confirmation
                await manager.send_personal_message(json.dumps(out_msg), user.id)
            else:
                # Broadcast
                await manager.broadcast(json.dumps(out_msg))
                
    except WebSocketDisconnect:
        manager.disconnect(websocket, user.id)
        if user.id not in manager.active_connections:
            await manager.broadcast(json.dumps({
                "type": "system",
                "content": f"{user.username} left the chat"
            }))
