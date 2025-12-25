#!/usr/bin/env python3
"""Quick script to check database contents"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database.database import Database

def check_database():
    """Check database contents"""
    db = Database('data/chat_system.db')
    
    print("=== DATABASE CHECK ===")
    
    # Check users
    users = db.get_user_count()
    print(f"Total users: {users}")
    
    # Check messages
    messages = db.get_message_count()
    print(f"Total messages: {messages}")
    
    # Get recent messages
    history = db.get_chat_history(10)
    if history:
        print("\nRecent messages:")
        for username, message, timestamp in history:
            print(f"  {timestamp}: {username}: {message}")
    else:
        print("\nNo messages in database")
    
    db.close()

if __name__ == "__main__":
    check_database()
