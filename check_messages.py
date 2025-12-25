#!/usr/bin/env python3
"""Check database for messages"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database.database import Database

def check_messages():
    """Check what messages exist in database"""
    db = Database('data/chat_system.db')
    
    print("=== CHECKING DATABASE ===")
    
    # Get message count
    count = db.get_message_count()
    print(f"Total messages in database: {count}")
    
    # Get recent messages
    history = db.get_chat_history(10)
    
    if history:
        print(f"\nLast {len(history)} messages:")
        for i, (username, message, timestamp) in enumerate(history, 1):
            print(f"{i}. {timestamp} | {username}: {message}")
    else:
        print("\nNo messages found in database!")
        print("Chat history will be empty until someone sends messages.")
    
    db.close()

if __name__ == "__main__":
    check_messages()
