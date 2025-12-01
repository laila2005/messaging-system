# tests/test_database.py - Database Testing Script
"""
Test script for database functionality.

Tests:
- User registration
- Duplicate username prevention
- User authentication
- Message logging
- Chat history retrieval
"""

import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.database import Database


def test_database():
    """
    Run comprehensive database tests.
    """
    print("\n" + "="*60)
    print("DATABASE MODULE TESTS")
    print("="*60)
    
    # Create test database
    test_db_path = 'tests/test_chat.db'
    
    # Remove old test database if exists
    if os.path.exists(test_db_path):
        os.remove(test_db_path)
        print(f"✓ Removed old test database")
    
    db = Database(test_db_path)
    
    # Test 1: User Registration
    print("\n" + "-"*60)
    print("Test 1: User Registration")
    print("-"*60)
    
    success = db.register_user("alice", "alice123")
    print(f"  Register 'alice': {'✓ PASS' if success else '✗ FAIL'}")
    assert success, "Failed to register alice"
    
    success = db.register_user("bob", "bob456")
    print(f"  Register 'bob': {'✓ PASS' if success else '✗ FAIL'}")
    assert success, "Failed to register bob"
    
    success = db.register_user("charlie", "charlie789")
    print(f"  Register 'charlie': {'✓ PASS' if success else '✗ FAIL'}")
    assert success, "Failed to register charlie"
    
    # Test 2: Duplicate Username Prevention
    print("\n" + "-"*60)
    print("Test 2: Duplicate Username Prevention")
    print("-"*60)
    
    success = db.register_user("alice", "different_password")
    print(f"  Duplicate 'alice' rejected: {'✓ PASS' if not success else '✗ FAIL'}")
    assert not success, "Duplicate username should be rejected"
    
    # Test 3: User Authentication
    print("\n" + "-"*60)
    print("Test 3: User Authentication")
    print("-"*60)
    
    valid = db.authenticate_user("alice", "alice123")
    print(f"  Valid credentials (alice): {'✓ PASS' if valid else '✗ FAIL'}")
    assert valid, "Valid credentials should authenticate"
    
    valid = db.authenticate_user("bob", "bob456")
    print(f"  Valid credentials (bob): {'✓ PASS' if valid else '✗ FAIL'}")
    assert valid, "Valid credentials should authenticate"
    
    invalid = db.authenticate_user("alice", "wrong_password")
    print(f"  Invalid password rejected: {'✓ PASS' if not invalid else '✗ FAIL'}")
    assert not invalid, "Invalid password should be rejected"
    
    invalid = db.authenticate_user("nonexistent", "password")
    print(f"  Nonexistent user rejected: {'✓ PASS' if not invalid else '✗ FAIL'}")
    assert not invalid, "Nonexistent user should be rejected"
    
    # Test 4: Message Logging
    print("\n" + "-"*60)
    print("Test 4: Message Logging")
    print("-"*60)
    
    messages = [
        ("alice", "Hello everyone!"),
        ("bob", "Hi Alice!"),
        ("charlie", "Hey guys!"),
        ("alice", "How are you all doing?"),
        ("bob", "Great, thanks!")
    ]
    
    for username, message in messages:
        success = db.log_message(username, message)
        print(f"  Log message from {username}: {'✓ PASS' if success else '✗ FAIL'}")
        assert success, f"Failed to log message from {username}"
    
    # Test 5: Chat History Retrieval
    print("\n" + "-"*60)
    print("Test 5: Chat History Retrieval")
    print("-"*60)
    
    history = db.get_chat_history(10)
    print(f"  Retrieved {len(history)} messages: {'✓ PASS' if len(history) == 5 else '✗ FAIL'}")
    assert len(history) == 5, f"Expected 5 messages, got {len(history)}"
    
    print("\n  Chat History:")
    for username, message, timestamp in history:
        print(f"    [{timestamp}] {username}: {message}")
    
    # Test 6: Limited History Retrieval
    print("\n" + "-"*60)
    print("Test 6: Limited History Retrieval")
    print("-"*60)
    
    history = db.get_chat_history(3)
    print(f"  Retrieved {len(history)} messages (limit 3): {'✓ PASS' if len(history) == 3 else '✗ FAIL'}")
    assert len(history) == 3, f"Expected 3 messages, got {len(history)}"
    
    # Test 7: User and Message Counts
    print("\n" + "-"*60)
    print("Test 7: User and Message Counts")
    print("-"*60)
    
    user_count = db.get_user_count()
    print(f"  Total users: {user_count} {'✓ PASS' if user_count == 3 else '✗ FAIL'}")
    assert user_count == 3, f"Expected 3 users, got {user_count}"
    
    message_count = db.get_message_count()
    print(f"  Total messages: {message_count} {'✓ PASS' if message_count == 5 else '✗ FAIL'}")
    assert message_count == 5, f"Expected 5 messages, got {message_count}"
    
    # Cleanup
    db.close()
    
    print("\n" + "="*60)
    print("✓ ALL DATABASE TESTS PASSED!")
    print("="*60 + "\n")
    
    return True


if __name__ == "__main__":
    try:
        test_database()
    except AssertionError as e:
        print(f"\n✗ TEST FAILED: {e}\n")
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ ERROR: {e}\n")
        sys.exit(1)
