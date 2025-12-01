# server/server.py - Multi-threaded Chat Server with Authentication
"""
This is the HEART of the chat system. The server:
- Listens for client connections on a TCP socket
- Authenticates users (login/registration)
- Receives encrypted messages from clients
- Broadcasts messages to all connected clients
- Logs all messages to database
- Handles multiple clients simultaneously using threads

Architecture:
- Main thread: Accepts new connections
- Client threads: One per connected client
- Thread-safe: Uses locks for shared data structures
"""

import socket
import threading
import sys
import os

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import config
from database.database import Database
from security.encryption import MessageEncryption


class ChatServer:
    """
    Multi-threaded chat server with encryption and authentication.
    
    Features:
    - TCP socket server
    - User authentication (login/register)
    - AES-256 message encryption
    - Real-time message broadcasting
    - Database logging
    - Multi-client support with threading
    """
    
    def __init__(self, host=None, port=None):
        """
        Initialize the chat server.
        
        Args:
            host (str): Server IP address (default from config)
            port (int): Server port number (default from config)
        """
        self.host = host or config.SERVER_HOST
        self.port = port or config.SERVER_PORT
        
        # Create TCP socket
        self.server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        
        # Allow address reuse (prevents "Address already in use" errors)
        self.server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        
        # Connected clients: {socket: username}
        self.clients = {}
        
        # Thread lock for thread-safe operations on shared data
        self.clients_lock = threading.Lock()
        
        # Initialize database
        self.database = Database(config.DATABASE_NAME)
        
        # Initialize encryption
        self.encryption = MessageEncryption(config.ENCRYPTION_KEY)
        
        # Server running flag
        self.running = False
        
        print("\n" + "="*60)
        print(" SECURE BUSINESS CHAT SERVER")
        print("="*60)
        print(f"Host: {self.host}")
        print(f"Port: {self.port}")
        print(f"Max Connections: {config.MAX_CONNECTIONS}")
        print(f"Database: {config.DATABASE_NAME}")
        print("="*60 + "\n")
    
    def start(self):
        """
        Start the server and begin accepting connections.
        
        This method:
        1. Binds to the specified host and port
        2. Starts listening for connections
        3. Accepts connections in an infinite loop
        4. Creates a new thread for each client
        """
        try:
            # Bind socket to address
            self.server_socket.bind((self.host, self.port))
            
            # Start listening (max queued connections)
            self.server_socket.listen(config.MAX_CONNECTIONS)
            
            self.running = True
            print(f" Server started successfully!")
            print(f" Listening on {self.host}:{self.port}")
            print(f" Waiting for connections...\n")
            
            # Main server loop - accept connections
            while self.running:
                try:
                    # Accept new connection (blocks until client connects)
                    client_socket, address = self.server_socket.accept()
                    
                    print(f"[+] New connection from {address[0]}:{address[1]}")
                    
                    # Handle client in separate thread
                    client_thread = threading.Thread(
                        target=self.handle_client,
                        args=(client_socket, address)
                    )
                    client_thread.daemon = True  # Thread dies when main thread dies
                    client_thread.start()
                    
                except KeyboardInterrupt:
                    print("\n[!] Server shutdown requested...")
                    break
                except Exception as e:
                    if self.running:
                        print(f"[!] Error accepting connection: {e}")
        
        except Exception as e:
            print(f" Server startup failed: {e}")
        finally:
            self.shutdown()
    
    def handle_client(self, client_socket, address):
        """
        Handle a connected client (runs in separate thread).
        
        Process:
        1. Authenticate user (login or register)
        2. Add to clients list
        3. Receive and broadcast messages
        4. Handle disconnection
        
        Args:
            client_socket: Socket object for this client
            address: Tuple of (ip, port)
        """
        username = None
        
        try:
            # Step 1: Authenticate user
            username = self.authenticate_client(client_socket)
            
            if not username:
                print(f"[-] Authentication failed for {address[0]}:{address[1]}")
                client_socket.close()
                return
            
            # Step 2: Add to clients list (thread-safe)
            with self.clients_lock:
                self.clients[client_socket] = username
            
            print(f"[+] {username} authenticated from {address[0]}:{address[1]}")
            print(f"[*] Active users: {len(self.clients)}")
            
            # Step 3: Send welcome message
            welcome_msg = f"[SERVER] {username} joined the chat!"
            self.broadcast_message(welcome_msg, client_socket)
            
            # Step 4: Main message loop
            while self.running:
                try:
                    # Receive encrypted message
                    encrypted_data = client_socket.recv(config.BUFFER_SIZE)
                    
                    if not encrypted_data:
                        break  # Client disconnected
                    
                    # Decrypt message
                    encrypted_message = encrypted_data.decode('utf-8')
                    message = self.encryption.decrypt(encrypted_message)
                    
                    # Check for disconnect command
                    if message.strip().upper() == '/QUIT':
                        break
                    
                    # Format message with username
                    formatted_message = f"{username}: {message}"
                    
                    # Log to database
                    self.database.log_message(username, message)
                    
                    # Broadcast to all clients
                    self.broadcast_message(formatted_message, client_socket)
                    
                    print(f"[MSG] {formatted_message}")
                
                except Exception as e:
                    print(f"[!] Error handling message from {username}: {e}")
                    break
        
        except Exception as e:
            print(f"[!] Error handling client {address}: {e}")
        
        finally:
            # Client disconnected - cleanup
            if username:
                # Remove from clients list (thread-safe)
                with self.clients_lock:
                    if client_socket in self.clients:
                        del self.clients[client_socket]
                
                # Broadcast leave message
                leave_msg = f"[SERVER] {username} left the chat."
                self.broadcast_message(leave_msg, None)
                
                print(f"[-] {username} disconnected")
                print(f"[*] Active users: {len(self.clients)}")
            
            # Close socket
            try:
                client_socket.close()
            except:
                pass
    
    def authenticate_client(self, client_socket):
        """
        Authenticate a client (login or registration).
        
        Protocol:
        1. Server: AUTH_REQUIRED
        2. Client: LOGIN or REGISTER
        3. Server: ENTER_USERNAME
        4. Client: <username>
        5. Server: ENTER_PASSWORD
        6. Client: <password>
        7. Server: AUTH_SUCCESS or AUTH_FAILED
        
        Args:
            client_socket: Client socket object
            
        Returns:
            str: Username if successful, None if failed
        """
        try:
            # Send authentication required
            client_socket.send(config.AUTH_REQUIRED.encode('utf-8'))
            
            # Receive login or register choice
            choice = client_socket.recv(1024).decode('utf-8').strip().upper()
            
            if choice not in [config.LOGIN, config.REGISTER]:
                client_socket.send(config.AUTH_FAILED.encode('utf-8'))
                return None
            
            # Request username
            client_socket.send(config.ENTER_USERNAME.encode('utf-8'))
            username = client_socket.recv(1024).decode('utf-8').strip()
            
            if not username or len(username) < 3:
                client_socket.send("ERROR: Username must be at least 3 characters".encode('utf-8'))
                return None
            
            # Request password
            client_socket.send(config.ENTER_PASSWORD.encode('utf-8'))
            password = client_socket.recv(1024).decode('utf-8').strip()
            
            if not password or len(password) < 4:
                client_socket.send("ERROR: Password must be at least 4 characters".encode('utf-8'))
                return None
            
            # Process authentication
            if choice == config.REGISTER:
                # Registration
                if self.database.register_user(username, password):
                    client_socket.send(f"{config.AUTH_SUCCESS}|{username}".encode('utf-8'))
                    return username
                else:
                    client_socket.send(f"{config.USERNAME_EXISTS}".encode('utf-8'))
                    return None
            
            elif choice == config.LOGIN:
                # Login
                if self.database.authenticate_user(username, password):
                    client_socket.send(f"{config.AUTH_SUCCESS}|{username}".encode('utf-8'))
                    return username
                else:
                    client_socket.send(config.AUTH_FAILED.encode('utf-8'))
                    return None
        
        except Exception as e:
            print(f"[!] Authentication error: {e}")
            return None
    
    def broadcast_message(self, message, sender_socket):
        """
        Broadcast a message to all connected clients except sender.
        
        Args:
            message (str): Message to broadcast
            sender_socket: Socket of sender (or None to send to all)
        """
        # Encrypt message
        encrypted_message = self.encryption.encrypt(message)
        encrypted_data = encrypted_message.encode('utf-8')
        
        # Send to all clients (thread-safe)
        with self.clients_lock:
            disconnected = []
            
            for client_socket in self.clients:
                # Don't send back to sender
                if client_socket == sender_socket:
                    continue
                
                try:
                    client_socket.send(encrypted_data)
                except Exception as e:
                    # Mark for removal if send fails
                    disconnected.append(client_socket)
            
            # Remove disconnected clients
            for client_socket in disconnected:
                if client_socket in self.clients:
                    username = self.clients[client_socket]
                    del self.clients[client_socket]
                    print(f"[-] Removed disconnected client: {username}")
    
    def shutdown(self):
        """
        Gracefully shutdown the server.
        """
        print("\n[!] Shutting down server...")
        self.running = False
        
        # Close all client connections
        with self.clients_lock:
            for client_socket in list(self.clients.keys()):
                try:
                    client_socket.close()
                except:
                    pass
            self.clients.clear()
        
        # Close server socket
        try:
            self.server_socket.close()
        except:
            pass
        
        # Close database
        self.database.close()
        
        print(" Server shutdown complete")


def main():
    """
    Main entry point for the server.
    """
    server = ChatServer()
    
    try:
        server.start()
    except KeyboardInterrupt:
        print("\n[!] Keyboard interrupt received")
    except Exception as e:
        print(f" Server error: {e}")
    finally:
        server.shutdown()


if __name__ == "__main__":
    main()