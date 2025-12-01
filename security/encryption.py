# security/encryption.py - Message Encryption Layer
"""
This module provides AES-256 encryption for secure message transmission.

AES (Advanced Encryption Standard) is a military-grade encryption algorithm:
- Used by governments and banks worldwide
- 256-bit key provides 2^256 possible combinations
- Virtually impossible to break with current technology

Encryption Flow:
1. Plain text message → AES cipher → Encrypted ciphertext
2. Add nonce (random value) to prevent pattern detection
3. Add authentication tag to detect tampering
4. Encode to Base64 for text transmission
"""

from Crypto.Cipher import AES
from Crypto.Random import get_random_bytes
import hashlib
import base64


class MessageEncryption:
    """
    Handles encryption and decryption of messages using AES-256-EAX mode.
    
    EAX mode provides:
    - Confidentiality: Message content is hidden
    - Authenticity: Detects if message was tampered with
    - Nonce-based: Each encryption is unique even for same message
    """
    
    def __init__(self, key):
        """
        Initialize encryption with a secret key.
        
        Args:
            key (str): Secret encryption key (must be same on server and client)
        
        The key is hashed to ensure it's exactly 32 bytes (256 bits) for AES-256.
        """
        # Hash the key to get exactly 32 bytes (256 bits)
        # This ensures any length key works and is properly formatted
        self.key = hashlib.sha256(key.encode()).digest()
        print("✓ Encryption initialized with AES-256")
    
    def encrypt(self, message):
        """
        Encrypt a plain text message.
        
        Process:
        1. Create AES cipher in EAX mode
        2. Generate random nonce (number used once)
        3. Encrypt message and generate authentication tag
        4. Combine: nonce + tag + ciphertext
        5. Encode to Base64 for text transmission
        
        Args:
            message (str): Plain text message to encrypt
            
        Returns:
            str: Base64-encoded encrypted message
            
        Example:
            Input:  "Hello, World!"
            Output: "kJ8dK2jd9Kls0dkJ3k2jd9Kls0dkJ3k..."
        """
        try:
            # Create cipher object with EAX mode
            cipher = AES.new(self.key, AES.MODE_EAX)
            
            # Get the nonce (random value for this encryption)
            nonce = cipher.nonce
            
            # Encrypt the message and generate authentication tag
            # Tag allows us to verify message wasn't tampered with
            ciphertext, tag = cipher.encrypt_and_digest(message.encode('utf-8'))
            
            # Combine all components: nonce (16 bytes) + tag (16 bytes) + ciphertext
            # We need nonce and tag to decrypt later
            encrypted_data = nonce + tag + ciphertext
            
            # Encode to Base64 for safe text transmission
            # Base64 converts binary data to ASCII text
            encrypted_message = base64.b64encode(encrypted_data).decode('utf-8')
            
            return encrypted_message
            
        except Exception as e:
            print(f"✗ Encryption error: {e}")
            raise
    
    def decrypt(self, encrypted_message):
        """
        Decrypt an encrypted message back to plain text.
        
        Process:
        1. Decode from Base64 to binary
        2. Extract nonce (first 16 bytes)
        3. Extract tag (next 16 bytes)
        4. Extract ciphertext (remaining bytes)
        5. Create cipher with original nonce
        6. Decrypt and verify authentication tag
        
        Args:
            encrypted_message (str): Base64-encoded encrypted message
            
        Returns:
            str: Decrypted plain text message
            
        Raises:
            ValueError: If message was tampered with (tag verification fails)
        """
        try:
            # Decode from Base64 to binary
            encrypted_data = base64.b64decode(encrypted_message)
            
            # Extract components
            nonce = encrypted_data[:16]        # First 16 bytes
            tag = encrypted_data[16:32]        # Next 16 bytes
            ciphertext = encrypted_data[32:]   # Remaining bytes
            
            # Create cipher with the original nonce
            cipher = AES.new(self.key, AES.MODE_EAX, nonce=nonce)
            
            # Decrypt and verify authentication tag
            # If tag doesn't match, raises ValueError (message was tampered)
            plaintext = cipher.decrypt_and_verify(ciphertext, tag)
            
            return plaintext.decode('utf-8')
            
        except ValueError:
            # Authentication tag verification failed
            print("✗ Decryption failed: Message authentication failed (possible tampering)")
            raise
        except Exception as e:
            print(f"✗ Decryption error: {e}")
            raise
    
    def encrypt_bytes(self, data):
        """
        Encrypt binary data (for files, images, etc.).
        
        Args:
            data (bytes): Binary data to encrypt
            
        Returns:
            bytes: Encrypted binary data
        """
        try:
            cipher = AES.new(self.key, AES.MODE_EAX)
            nonce = cipher.nonce
            ciphertext, tag = cipher.encrypt_and_digest(data)
            return nonce + tag + ciphertext
        except Exception as e:
            print(f"✗ Binary encryption error: {e}")
            raise
    
    def decrypt_bytes(self, encrypted_data):
        """
        Decrypt binary data.
        
        Args:
            encrypted_data (bytes): Encrypted binary data
            
        Returns:
            bytes: Decrypted binary data
        """
        try:
            nonce = encrypted_data[:16]
            tag = encrypted_data[16:32]
            ciphertext = encrypted_data[32:]
            
            cipher = AES.new(self.key, AES.MODE_EAX, nonce=nonce)
            plaintext = cipher.decrypt_and_verify(ciphertext, tag)
            return plaintext
        except Exception as e:
            print(f"✗ Binary decryption error: {e}")
            raise


def test_encryption():
    """
    Test function to verify encryption/decryption works correctly.
    """
    print("\n" + "="*60)
    print("TESTING ENCRYPTION MODULE")
    print("="*60)
    
    # Create encryption object
    encryptor = MessageEncryption("test_key_12345")
    
    # Test messages
    test_messages = [
        "Hello, World!",
        "This is a secret message 🔒",
        "Testing with special chars: @#$%^&*()",
        "A" * 1000,  # Long message
        "Multi\nLine\nMessage",
        "Unicode: 你好世界 مرحبا العالم"
    ]
    
    print("\nTest 1: Basic Encryption/Decryption")
    print("-" * 60)
    
    for i, msg in enumerate(test_messages, 1):
        print(f"\nTest {i}:")
        print(f"  Original: {msg[:50]}{'...' if len(msg) > 50 else ''}")
        
        # Encrypt
        encrypted = encryptor.encrypt(msg)
        print(f"  Encrypted: {encrypted[:50]}...")
        
        # Decrypt
        decrypted = encryptor.decrypt(encrypted)
        print(f"  Decrypted: {decrypted[:50]}{'...' if len(decrypted) > 50 else ''}")
        
        # Verify
        if msg == decrypted:
            print("  ✓ PASS: Message matches!")
        else:
            print("  ✗ FAIL: Message doesn't match!")
            return False
    
    print("\n" + "-" * 60)
    print("Test 2: Encryption Uniqueness")
    print("-" * 60)
    
    # Same message encrypted twice should produce different ciphertext
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
    
    print("\n" + "-" * 60)
    print("Test 3: Tampering Detection")
    print("-" * 60)
    
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
    
    print("\n" + "="*60)
    print("✓ ALL ENCRYPTION TESTS PASSED!")
    print("="*60 + "\n")
    return True


if __name__ == "__main__":
    # Run tests when file is executed directly
    test_encryption()
