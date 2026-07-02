from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=True)
    phone_number = Column(String, unique=True, index=True, nullable=True)
    hashed_password = Column(String, nullable=False)
    public_key = Column(Text, nullable=True) # For E2EE Phase 3
    avatar_url = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    require_message_requests = Column(Boolean, default=False)
    hide_phone_number = Column(Boolean, default=False)

    # Relationships
    messages_sent = relationship("Message", foreign_keys="Message.sender_id", back_populates="sender")
    messages_received = relationship("Message", foreign_keys="Message.recipient_id", back_populates="recipient")
    requests_sent = relationship("ConnectionRequest", foreign_keys="ConnectionRequest.sender_id", back_populates="sender")
    requests_received = relationship("ConnectionRequest", foreign_keys="ConnectionRequest.receiver_id", back_populates="receiver")
    blocked_users = relationship("BlockedUser", foreign_keys="BlockedUser.blocker_id", back_populates="blocker")
    blocked_by = relationship("BlockedUser", foreign_keys="BlockedUser.blocked_id", back_populates="blocked")


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    recipient_id = Column(Integer, ForeignKey("users.id"), nullable=True) # NULL means broadcast message
    content = Column(Text, nullable=False) # Plaintext for broadcast, Encrypted for E2E
    attachment_url = Column(String, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(String, default="sent") # sent, delivered, read
    location_lat = Column(String, nullable=True)
    location_lng = Column(String, nullable=True)
    is_disappearing = Column(Boolean, default=False)
    reply_to_id = Column(Integer, ForeignKey("messages.id"), nullable=True)

    # Relationships
    sender = relationship("User", foreign_keys=[sender_id], back_populates="messages_sent")
    recipient = relationship("User", foreign_keys=[recipient_id], back_populates="messages_received")
    reactions = relationship("MessageReaction", back_populates="message", cascade="all, delete-orphan")
    reply_to = relationship("Message", remote_side=[id])

class ConnectionRequest(Base):
    __tablename__ = "connection_requests"

    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    receiver_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String, default="pending") # pending, accepted, rejected
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    sender = relationship("User", foreign_keys=[sender_id], back_populates="requests_sent")
    receiver = relationship("User", foreign_keys=[receiver_id], back_populates="requests_received")

class BlockedUser(Base):
    __tablename__ = "blocked_users"

    id = Column(Integer, primary_key=True, index=True)
    blocker_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    blocked_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    blocker = relationship("User", foreign_keys=[blocker_id], back_populates="blocked_users")
    blocked = relationship("User", foreign_keys=[blocked_id], back_populates="blocked_by")

class MessageReaction(Base):
    __tablename__ = "message_reactions"

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("messages.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    emoji = Column(String, nullable=False)

    message = relationship("Message", back_populates="reactions")
    user = relationship("User")
