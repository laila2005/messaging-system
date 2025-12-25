#  Database Management Layer

import sqlite3
import hashlib
from datetime import datetime
import os


class Database:
    
    def __init__(self, db_name='data/chat_system.db'):
   
        os.makedirs(os.path.dirname(db_name), exist_ok=True)
     
        self.conn = sqlite3.connect(db_name, check_same_thread=False)
        self.cursor = self.conn.cursor()
        
        # Create tables
        self.create_tables()
        
        print(f"✓ Database initialized: {db_name}")
    
    def create_tables(self):
      
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
      
        return hashlib.sha256(password.encode()).hexdigest()
    
    def register_user(self, username, password):
        
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
    
        try:
            self.cursor.execute(
                'SELECT username, message, timestamp FROM messages ORDER BY timestamp DESC LIMIT ?',
                (limit,)
            )
            messages = self.cursor.fetchall()
            return list(reversed(messages))
            
        except Exception as e:
            print(f"✗ Error retrieving chat history: {e}")
            return []
    
    def get_user_count(self):
      
        try:
            self.cursor.execute('SELECT COUNT(*) FROM users')
            return self.cursor.fetchone()[0]
        except Exception as e:
            print(f"✗ Error getting user count: {e}")
            return 0
    
    def get_message_count(self):
     
        try:
            self.cursor.execute('SELECT COUNT(*) FROM messages')
            return self.cursor.fetchone()[0]
        except Exception as e:
            print(f"✗ Error getting message count: {e}")
            return 0
    
    def close(self):
        
        self.conn.close()
        print("✓ Database connection closed")


if __name__ == "__main__":

    print("Testing Database Module...")
    
    db = Database('test_database.db')
    
    # Test registration
    print("\n1. Testing user registration:")
    db.register_user("testuser", "password123")
    db.register_user("alice", "alice_pass")
    db.register_user("testuser", "different_pass") 
    
    # Test authentication
    print("\n2. Testing authentication:")
    db.authenticate_user("testuser", "password123")  
    db.authenticate_user("testuser", "wrong_pass")   
    
    # 
    print("\n3. Testing message logging:")
    db.log_message("testuser", "Hello, world!")
    db.log_message("alice", "Hi there!")
    
    
    print("\n4. Testing chat history retrieval:")
    history = db.get_chat_history(10)
    for username, message, timestamp in history:
        print(f"  [{timestamp}] {username}: {message}")
    
    print("\n✓ Database tests complete!")
    db.close()
