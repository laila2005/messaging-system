import json
import jwt
import os
import shutil
from typing import Dict, List
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, status, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordRequestForm

from . import models, schemas, auth, database
from .database import engine

# Create DB tables (We will use Alembic later for migrations, this is just for initial dev)
models.Base.metadata.create_all(bind=engine)

# Ensure uploads directory exists
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

app = FastAPI(title="Secure Business Chat API")

# Serve static files for avatars
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Connection Manager for WebSockets
class ConnectionManager:
    def __init__(self):
        # Maps user_id to their active WebSocket connection
        self.active_connections: Dict[int, WebSocket] = {}

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        self.active_connections[user_id] = websocket

    def disconnect(self, user_id: int):
        if user_id in self.active_connections:
            del self.active_connections[user_id]

    async def send_personal_message(self, message: str, user_id: int):
        if user_id in self.active_connections:
            await self.active_connections[user_id].send_text(message)

    async def broadcast(self, message: str, exclude_user_id: int = None):
        for uid, connection in self.active_connections.items():
            if uid != exclude_user_id:
                await connection.send_text(message)

manager = ConnectionManager()

# --- REST ENDPOINTS ---

@app.post("/register", response_model=schemas.UserResponse)
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

@app.post("/token", response_model=schemas.Token)
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
        
    db.commit()
    db.refresh(current_user)
    return current_user

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

# --- WEBSOCKET ENDPOINT ---

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str, db: Session = Depends(database.get_db)):
    try:
        # Manually verify token for websocket
        payload = jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        user = db.query(models.User).filter(models.User.username == username).first()
        if user is None:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
    except Exception:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await manager.connect(websocket, user.id)
    
    # Broadcast user joined
    await manager.broadcast(json.dumps({
        "type": "system",
        "content": f"{user.username} joined the chat"
    }), exclude_user_id=user.id)

    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            content = message_data.get("content")
            recipient_id = message_data.get("recipient_id") # None if broadcast
            
            # Save to DB
            new_msg = models.Message(
                sender_id=user.id,
                recipient_id=recipient_id,
                content=content
            )
            db.add(new_msg)
            db.commit()
            db.refresh(new_msg)
            
            out_msg = {
                "type": "message",
                "id": new_msg.id,
                "sender_id": user.id,
                "sender_username": user.username,
                "recipient_id": recipient_id,
                "content": content,
                "timestamp": new_msg.timestamp.isoformat()
            }
            
            if recipient_id:
                # Direct message
                await manager.send_personal_message(json.dumps(out_msg), recipient_id)
                # Send back to sender for confirmation
                await manager.send_personal_message(json.dumps(out_msg), user.id)
            else:
                # Broadcast
                await manager.broadcast(json.dumps(out_msg))
                
    except WebSocketDisconnect:
        manager.disconnect(user.id)
        await manager.broadcast(json.dumps({
            "type": "system",
            "content": f"{user.username} left the chat"
        }))
