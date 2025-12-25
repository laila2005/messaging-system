# clint/client.py - Command-Line Chat Client
"""
CLI (Command-Line Interface) chat client.

Features:
- Connects to chat server
- User authentication (login/register)
- Send/receive encrypted messages
- Two-threaded design (send + receive simultaneously)
- Clean command-line interface

Usage:
    python client.py
"""

import socket
import threading
import sys
import os

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import config
from security.tls_setup import TLSConfig


class ChatClient:
    """
    Command-line chat client with TLS encryption and authentication.
    
    Architecture:
    - Main thread: Handles user input and sending messages
    - Receive thread: Constantly listens for incoming messages
    - TLS provides transport-layer encryption
    """
    
    def __init__(self, host=None, port=None):
        """
        Initialize chat client.
        
        Args:
            host (str): Server IP address
            port (int): Server port number
        """
        self.host = host or config.SERVER_HOST
        self.port = port or config.SERVER_PORT
        
        # Create socket
        self.client_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        
        # Initialize TLS configuration
        self.tls_config = TLSConfig()
        
        # Client state
        self.running = False
        self.username = None
        
        print("\n" + "="*60)
        print(" SECURE BUSINESS CHAT CLIENT")
        print("="*60)
    
    def connect(self):
        """
        Connect to the chat server using TLS.
        
        Returns:
            bool: True if connection successful
        """
        try:
            print(f"\n[*] Connecting to {self.host}:{self.port} (TLS)...")
            
            # Create TLS context for client
            tls_context = self.tls_config.create_client_context(verify=False)
            
            # Wrap socket with TLS
            self.client_socket = tls_context.wrap_socket(
                self.client_socket, 
                server_hostname=self.host
            )
            
            # Connect to server
            self.client_socket.connect((self.host, self.port))
            
            print(" Connected to server with TLS encryption!")
            return True
        except Exception as e:
            print(f" Connection failed: {e}")
            return False
    
    def authenticate(self):
        """
        Handle authentication with server.
        
        Returns:
            bool: True if authentication successful
        """
        try:
            # Receive AUTH_REQUIRED
            response = self.client_socket.recv(1024).decode('utf-8')
            
            if response != config.AUTH_REQUIRED:
                print(f" Unexpected server response: {response}")
                return False
            
            # Ask user for login or register
            print("\n" + "="*60)
            print("AUTHENTICATION")
            print("="*60)
            print("1. Login to existing account")
            print("2. Register new account")
            print("="*60)
            
            while True:
                choice = input("\nEnter choice (1 or 2): ").strip()
                
                if choice == '1':
                    self.client_socket.send(config.LOGIN.encode('utf-8'))
                    break
                elif choice == '2':
                    self.client_socket.send(config.REGISTER.encode('utf-8'))
                    break
                else:
                    print("Invalid choice. Please enter 1 or 2.")
            
            # Receive ENTER_USERNAME
            response = self.client_socket.recv(1024).decode('utf-8')
            
            if response != config.ENTER_USERNAME:
                print(f" Error: {response}")
                return False
            
            # Send username
            username = input("Username (min 3 characters): ").strip()
            self.client_socket.send(username.encode('utf-8'))
            
            # Receive ENTER_PASSWORD
            response = self.client_socket.recv(1024).decode('utf-8')
            
            if response != config.ENTER_PASSWORD:
                print(f" Error: {response}")
                return False
            
            # Send password
            password = input("Password (min 4 characters): ").strip()
            self.client_socket.send(password.encode('utf-8'))
            
            # Receive authentication result
            response = self.client_socket.recv(1024).decode('utf-8')
            
            if response.startswith(config.AUTH_SUCCESS):
                # Extract username from response
                parts = response.split('|')
                if len(parts) > 1:
                    self.username = parts[1]
                else:
                    self.username = username
                
                print(f"\n Authentication successful!")
                print(f" Logged in as: {self.username}")
                return True
            
            elif response == config.USERNAME_EXISTS:
                print("\n Username already exists. Please try logging in.")
                return False
            
            elif response == config.AUTH_FAILED:
                print("\n Authentication failed. Invalid credentials.")
                return False
            
            else:
                print(f"\n Error: {response}")
                return False
        
        except Exception as e:
            print(f" Authentication error: {e}")
            return False
    
    def receive_messages(self):
        """
        Continuously receive messages from server (runs in separate thread).
        """
        while self.running:
            try:
                # Receive message (TLS provides encryption)
                message_data = self.client_socket.recv(config.BUFFER_SIZE)
                
                if not message_data:
                    print("\n[!] Connection closed by server")
                    self.running = False
                    break
                
                # Decode message
                message = message_data.decode('utf-8')
                
                # Display message
                print(f"\n{message}")
                print(f"{self.username}> ", end='', flush=True)
            
            except Exception as e:
                if self.running:
                    print(f"\n[!] Error receiving message: {e}")
                break
    
    def send_messages(self):
        """
        Handle user input and send messages to server (runs in main thread).
        """
        print("\n" + "="*60)
        print("CHAT STARTED")
        print("="*60)
        print("Commands:")
        print("  /quit - Exit chat")
        print("  Just type to send messages")
        print("="*60 + "\n")
        
        while self.running:
            try:
                # Get user input
                message = input(f"{self.username}> ")
                
                # Check for quit command
                if message.strip().upper() == '/QUIT':
                    print("\n[*] Disconnecting...")
                    self.running = False
                    break
                
                # Don't send empty messages
                if not message.strip():
                    continue
                
                # Send message (TLS provides encryption)
                message_data = message.encode('utf-8')
                self.client_socket.send(message_data)
            
            except KeyboardInterrupt:
                print("\n[*] Disconnecting...")
                self.running = False
                break
            except Exception as e:
                if self.running:
                    print(f"\n[!] Error sending message: {e}")
                break
    
    def start(self):
        """
        Start the chat client.
        """
        try:
            # Connect to server
            if not self.connect():
                return
            
            # Authenticate
            if not self.authenticate():
                print("\n[!] Authentication failed. Exiting...")
                return
            
            # Start running
            self.running = True
            
            # Start receive thread
            receive_thread = threading.Thread(target=self.receive_messages)
            receive_thread.daemon = True
            receive_thread.start()
            
            # Start send loop (main thread)
            self.send_messages()
        
        except Exception as e:
            print(f"\n Client error: {e}")
        
        finally:
            self.disconnect()
    
    def disconnect(self):
        """
        Disconnect from server and cleanup.
        """
        self.running = False
        
        try:
            self.client_socket.close()
        except:
            pass
        
        print("\n Disconnected from server")
        print("="*60 + "\n")


def main():
    """
    Main entry point for CLI client.
    """
    # Allow custom host/port via command line
    host = sys.argv[1] if len(sys.argv) > 1 else None
    port = int(sys.argv[2]) if len(sys.argv) > 2 else None
    
    client = ChatClient(host, port)
    client.start()


if __name__ == "__main__":
    main()