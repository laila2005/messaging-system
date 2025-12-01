# tests/test_encryption.py - Encryption Testing Script
"""
Test script for encryption functionality.

Tests:
- Basic encryption/decryption
- Message integrity
- Encryption uniqueness (nonce working)
- Tampering detection
- Various message types
"""

import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from security.encryption import MessageEncryption


def test_encryption():
    """
    Run comprehensive encryption tests.
    """
    print("\n" + "="*60)
    print("ENCRYPTION MODULE TESTS")
    print("="*60)
    
    # Create encryption object
    encryptor = MessageEncryption("test_key_12345")
    
    # Test 1: Basic Encryption/Decryption
    print("\n" + "-"*60)
    print("Test 1: Basic Encryption/Decryption")
    print("-"*60)
    
    test_messages = [
        "Hello, World!",
        "This is a secret message 🔒",
        "Testing with special chars: @#$%^&*()",
        "A" * 1000,  # Long message
        "Multi\nLine\nMessage",
        "Unicode: 你好世界 مرحبا العالم"
    ]
    
    for i, msg in enumerate(test_messages, 1):
        print(f"\n  Test {i}: {msg[:40]}{'...' if len(msg) > 40 else ''}")
        
        # Encrypt
        encrypted = encryptor.encrypt(msg)
        print(f"    Encrypted: {encrypted[:40]}...")
        
        # Decrypt
        decrypted = encryptor.decrypt(encrypted)
        
        # Verify
        if msg == decrypted:
            print(f"    ✓ PASS: Message matches!")
        else:
            print(f"    ✗ FAIL: Message doesn't match!")
            print(f"    Expected: {msg[:50]}")
            print(f"    Got: {decrypted[:50]}")
            return False
    
    # Test 2: Encryption Uniqueness
    print("\n" + "-"*60)
    print("Test 2: Encryption Uniqueness (Nonce)")
    print("-"*60)
    
    msg = "Same message"
    enc1 = encryptor.encrypt(msg)
    enc2 = encryptor.encrypt(msg)
    
    print(f"  Message: {msg}")
    print(f"  Encryption 1: {enc1[:40]}...")
    print(f"  Encryption 2: {enc2[:40]}...")
    
    if enc1 != enc2:
        print("  ✓ PASS: Encryptions are unique (nonce working)")
    else:
        print("  ✗ FAIL: Encryptions are identical (security issue)")
        return False
    
    # But both should decrypt to same message
    if encryptor.decrypt(enc1) == encryptor.decrypt(enc2) == msg:
        print("  ✓ PASS: Both decrypt to original message")
    else:
        print("  ✗ FAIL: Decryption mismatch")
        return False
    
    # Test 3: Tampering Detection
    print("\n" + "-"*60)
    print("Test 3: Tampering Detection")
    print("-"*60)
    
    msg = "Important message"
    encrypted = encryptor.encrypt(msg)
    
    # Try to tamper with encrypted message
    tampered = encrypted[:-5] + "XXXXX"
    
    print(f"  Original encrypted: {encrypted[:40]}...")
    print(f"  Tampered encrypted: {tampered[:40]}...")
    
    try:
        encryptor.decrypt(tampered)
        print("  ✗ FAIL: Tampering not detected!")
        return False
    except:
        print("  ✓ PASS: Tampering detected and rejected!")
    
    # Test 4: Empty Message
    print("\n" + "-"*60)
    print("Test 4: Empty Message")
    print("-"*60)
    
    msg = ""
    encrypted = encryptor.encrypt(msg)
    decrypted = encryptor.decrypt(encrypted)
    
    if msg == decrypted:
        print("  ✓ PASS: Empty message handled correctly")
    else:
        print("  ✗ FAIL: Empty message failed")
        return False
    
    # Test 5: Very Long Message
    print("\n" + "-"*60)
    print("Test 5: Very Long Message")
    print("-"*60)
    
    msg = "X" * 10000  # 10KB message
    print(f"  Message length: {len(msg)} characters")
    
    encrypted = encryptor.encrypt(msg)
    print(f"  Encrypted length: {len(encrypted)} characters")
    
    decrypted = encryptor.decrypt(encrypted)
    
    if msg == decrypted:
        print("  ✓ PASS: Long message handled correctly")
    else:
        print("  ✗ FAIL: Long message failed")
        return False
    
    # Test 6: Different Keys
    print("\n" + "-"*60)
    print("Test 6: Different Keys")
    print("-"*60)
    
    encryptor1 = MessageEncryption("key1")
    encryptor2 = MessageEncryption("key2")
    
    msg = "Secret message"
    encrypted_with_key1 = encryptor1.encrypt(msg)
    
    print(f"  Message: {msg}")
    print(f"  Encrypted with key1: {encrypted_with_key1[:40]}...")
    
    try:
        decrypted_with_key2 = encryptor2.decrypt(encrypted_with_key1)
        print("  ✗ FAIL: Wrong key decrypted successfully (security issue)")
        return False
    except:
        print("  ✓ PASS: Wrong key rejected")
    
    print("\n" + "="*60)
    print("✓ ALL ENCRYPTION TESTS PASSED!")
    print("="*60 + "\n")
    
    return True


if __name__ == "__main__":
    try:
        test_encryption()
    except Exception as e:
        print(f"\n✗ ERROR: {e}\n")
        import traceback
        traceback.print_exc()
        sys.exit(1)
