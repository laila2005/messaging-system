# database/database.py - Database Management Layer
"""
This module handles all database operations including:
- User registration and authentication
- Password hashing for security
- Message logging and retrieval
- Database initialization and management
"""

import sqlite3
import hashlib
from datetime import datetime
import os


class Database:
    """
    Database class for managing user accounts and chat messages.
    
    Uses SQLite for lightweight, file-based database storage.
    Implements secure password hashing using SHA-256.
    """
    
    def __init__(self, db_name='data/chat_system.db'):
        """
        Initialize database connection and create tables if they don't exist.
        
        Args:
            db_name (str): Path to the SQLite database file
        """
        # Create data directory if it doesn't exist
        os.makedirs(os.path.dirname(db_name), exist_ok=True)
        
        # Connect to database (creates file if doesn't exist)
        # check_same_thread=False allows multi-threaded access
        self.conn = sqlite3.connect(db_name, check_same_thread=False)
        self.cursor = self.conn.cursor()
        
        # Create tables
        self.create_tables()
        
        print(f"✓ Database initialized: {db_name}")
    
    def create_tables(self):
        """
        Create database tables for users and messages.
        
        Tables:
        - users: Stores user accounts with hashed passwords
        - messages: Stores chat history with timestamps
        """
        # Users table
        # UNIQUE constraint on username prevents duplicate accounts
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Messages table
        # Stores all chat messages with sender and timestamp
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                message TEXT NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        self.conn.commit()
    
    def hash_password(self, password):
        """
        Hash a password using SHA-256 algorithm.
        
        SHA-256 is a one-way cryptographic hash function:
        - Same password always produces same hash
        - Cannot reverse hash to get original password
        - Even small password changes produce completely different hashes
        
        Args:
            password (str): Plain text password
            
        Returns:
            str: Hexadecimal hash string (64 characters)
            
        Example:
            "mypassword" -> "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8"
        """
        return hashlib.sha256(password.encode()).hexdigest()
    
    def register_user(self, username, password):
        """
        Register a new user account.
        
        Process:
        1. Hash the password for security
        2. Attempt to insert into database
        3. If username exists, UNIQUE constraint fails
        
        Args:
            username (str): Desired username
            password (str): Plain text password (will be hashed)
            
        Returns:
            bool: True if registration successful, False if username exists
        """
        try:
            password_hash = self.hash_password(password)
            
            self.cursor.execute(
                'INSERT INTO users (username, password_hash) VALUES (?, ?)',
                (username, password_hash)
            )
            
            self.conn.commit()
            print(f"✓ User registered: {username}")
            return True
            
        except sqlite3.IntegrityError:
            # Username already exists (UNIQUE constraint violation)
            print(f"✗ Registration failed: Username '{username}' already exists")
            return False
        except Exception as e:
            print(f"✗ Registration error: {e}")
            return False
    
    def authenticate_user(self, username, password):
        """
        Authenticate a user login attempt.
        
        Process:
        1. Hash the provided password
        2. Search database for matching username AND password_hash
        3. If found, authentication succeeds
        
        Args:
            username (str): Username to authenticate
            password (str): Plain text password to verify
            
        Returns:
            bool: True if credentials are valid, False otherwise
        """
        try:
            password_hash = self.hash_password(password)
            
            self.cursor.execute(
                'SELECT * FROM users WHERE username = ? AND password_hash = ?',
                (username, password_hash)
            )
            
            result = self.cursor.fetchone()
            
            if result:
                print(f"✓ Authentication successful: {username}")
                return True
            else:
                print(f"✗ Authentication failed: Invalid credentials for {username}")
                return False
                
        except Exception as e:
            print(f"✗ Authentication error: {e}")
            return False
    
    def username_exists(self, username):
        """
        Check if a username already exists in the database.
        
        Args:
            username (str): Username to check
            
        Returns:
            bool: True if username exists, False otherwise
        """
        try:
            self.cursor.execute(
                'SELECT username FROM users WHERE username = ?',
                (username,)
            )
            return self.cursor.fetchone() is not None
        except Exception as e:
            print(f"✗ Error checking username: {e}")
            return False
    
    def log_message(self, username, message):
        """
        Save a chat message to the database.
        
        Args:
            username (str): Username of message sender
            message (str): Message content
            
        Returns:
            bool: True if message saved successfully
        """
        try:
            self.cursor.execute(
                'INSERT INTO messages (username, message) VALUES (?, ?)',
                (username, message)
            )
            self.conn.commit()
            return True
        except Exception as e:
            print(f"✗ Error logging message: {e}")
            return False
    
    def get_chat_history(self, limit=50):
        """
        Retrieve recent chat messages from database.
        
        Args:
            limit (int): Maximum number of messages to retrieve
            
        Returns:
            list: List of tuples (username, message, timestamp)
                  Ordered from oldest to newest
        """
        try:
            self.cursor.execute(
                'SELECT username, message, timestamp FROM messages ORDER BY timestamp DESC LIMIT ?',
                (limit,)
            )
            
            # Reverse to get chronological order (oldest first)
            messages = self.cursor.fetchall()
            return list(reversed(messages))
            
        except Exception as e:
            print(f"✗ Error retrieving chat history: {e}")
            return []
    
    def get_user_count(self):
        """
        Get total number of registered users.
        
        Returns:
            int: Number of users in database
        """
        try:
            self.cursor.execute('SELECT COUNT(*) FROM users')
            return self.cursor.fetchone()[0]
        except Exception as e:
            print(f"✗ Error getting user count: {e}")
            return 0
    
    def get_message_count(self):
        """
        Get total number of messages in database.
        
        Returns:
            int: Number of messages in database
        """
        try:
            self.cursor.execute('SELECT COUNT(*) FROM messages')
            return self.cursor.fetchone()[0]
        except Exception as e:
            print(f"✗ Error getting message count: {e}")
            return 0
    
    def close(self):
        """
        Close database connection.
        Should be called when shutting down the application.
        """
        self.conn.close()
        print("✓ Database connection closed")


if __name__ == "__main__":
    # Quick test when running this file directly
    print("Testing Database Module...")
    
    db = Database('test_database.db')
    
    # Test registration
    print("\n1. Testing user registration:")
    db.register_user("testuser", "password123")
    db.register_user("alice", "alice_pass")
    db.register_user("testuser", "different_pass")  # Should fail
    
    # Test authentication
    print("\n2. Testing authentication:")
    db.authenticate_user("testuser", "password123")  # Should succeed
    db.authenticate_user("testuser", "wrong_pass")   # Should fail
    
    # Test message logging
    print("\n3. Testing message logging:")
    db.log_message("testuser", "Hello, world!")
    db.log_message("alice", "Hi there!")
    
    # Test chat history
    print("\n4. Testing chat history retrieval:")
    history = db.get_chat_history(10)
    for username, message, timestamp in history:
        print(f"  [{timestamp}] {username}: {message}")
    
    print("\n✓ Database tests complete!")
    db.close()
