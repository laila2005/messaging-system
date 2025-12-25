import socket
import threading
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import config
from database.database import Database
from security.tls_setup import TLSConfig


class ChatServer:
    
    def __init__(self, host=None, port=None):
        self.host = host or config.SERVER_HOST
        self.port = port or config.SERVER_PORT
        
        self.server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        
        self.server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        

        self.clients = {}
        
        self.clients_lock = threading.Lock()
        
        self.database = Database(config.DATABASE_NAME)
       
        self.tls_config = TLSConfig()
        if not self.tls_config.verify_certificates():
            print("[!] TLS certificates not found. Generating new ones...")
            self.tls_config.generate_self_signed_cert()
        
        self.running = False
        
        print("\n" + "="*60)
        print(" SECURE BUSINESS CHAT SERVER")
        print("="*60)
        print(f"Host: {self.host}")
        print(f"Port: {self.port}")
        print(f"Max Connections: {config.MAX_CONNECTIONS}")
        print(f"Database: {config.DATABASE_NAME}")
        print(f"TLS: Enabled (self-signed certificate)")
        print("="*60 + "\n")
    
    def start(self):
        try:
            tls_context = self.tls_config.create_server_context()
            self.server_socket = tls_context.wrap_socket(self.server_socket, server_side=True)
            
            self.server_socket.bind((self.host, self.port))
            
            self.server_socket.listen(config.MAX_CONNECTIONS)
            
            self.running = True
            print(f" Server started successfully!")
            print(f" Listening on {self.host}:{self.port} (TLS)")
            print(f" Waiting for secure connections...\n")
            
            while self.running:
                try:
                    client_socket, address = self.server_socket.accept()
                    
                    print(f"[+] New connection from {address[0]}:{address[1]}")
                    
                    client_thread = threading.Thread(
                        target=self.handle_client,
                        args=(client_socket, address)
                    )
                    client_thread.daemon = True
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
        username = None
        
        try:
            username = self.authenticate_client(client_socket)
            
            if not username:
                print(f"[-] Authentication failed for {address[0]}:{address[1]}")
                client_socket.close()
                return
            
            with self.clients_lock:
                self.clients[client_socket] = username
            
            print(f"[+] {username} authenticated from {address[0]}:{address[1]}")
            print(f"[*] Active users: {len(self.clients)}")
            
            import time
            time.sleep(0.1)
            
            self.send_chat_history(client_socket)
            
            time.sleep(0.05)
            
            self.broadcast_user_list()
            
            welcome_msg = f"[SERVER] {username} joined the chat!"
            self.broadcast_message(welcome_msg, client_socket)
            
            while self.running:
                try:
                    message_data = client_socket.recv(config.BUFFER_SIZE)
                    
                    if not message_data:
                        break  
                    
                    message = message_data.decode('utf-8')
                    
                    if message.strip().upper() == '/QUIT':
                        break
                    
                    formatted_message = f"{username}: {message}"
                    
                    self.database.log_message(username, message)
                    
                    self.broadcast_message(formatted_message, client_socket)
                    
                    print(f"[MSG] {formatted_message}")
                
                except Exception as e:
                    print(f"[!] Error handling message from {username}: {e}")
                    break
        
        except Exception as e:
            print(f"[!] Error handling client {address}: {e}")
        
        finally:
            if username:
                with self.clients_lock:
                    if client_socket in self.clients:
                        del self.clients[client_socket]
                
                leave_msg = f"[SERVER] {username} left the chat."
                self.broadcast_message(leave_msg, None)
                
                self.broadcast_user_list()
                
                print(f"[-] {username} disconnected")
                print(f"[*] Active users: {len(self.clients)}")
            
            try:
                client_socket.close()
            except:
                pass
    
    def authenticate_client(self, client_socket):
        try:
            client_socket.send(config.AUTH_REQUIRED.encode('utf-8'))
            
            choice = client_socket.recv(1024).decode('utf-8').strip().upper()
            
            if choice not in [config.LOGIN, config.REGISTER]:
                client_socket.send(config.AUTH_FAILED.encode('utf-8'))
                return None
            
            client_socket.send(config.ENTER_USERNAME.encode('utf-8'))
            username = client_socket.recv(1024).decode('utf-8').strip()
            
            if not username or len(username) < 3:
                client_socket.send("ERROR: Username must be at least 3 characters".encode('utf-8'))
                return None
            
            client_socket.send(config.ENTER_PASSWORD.encode('utf-8'))
            password = client_socket.recv(1024).decode('utf-8').strip()
            
            if not password or len(password) < 4:
                client_socket.send("ERROR: Password must be at least 4 characters".encode('utf-8'))
                return None
            
            if choice == config.REGISTER:
                if self.database.register_user(username, password):
                    client_socket.send(f"{config.AUTH_SUCCESS}|{username}".encode('utf-8'))
                    return username
                else:
                    client_socket.send(f"{config.USERNAME_EXISTS}".encode('utf-8'))
                    return None
            
            elif choice == config.LOGIN:
                if self.database.authenticate_user(username, password):
                    client_socket.send(f"{config.AUTH_SUCCESS}|{username}".encode('utf-8'))
                    return username
                else:
                    client_socket.send(config.AUTH_FAILED.encode('utf-8'))
                    return None
        
        except Exception as e:
            print(f"[!] Authentication error: {e}")
            return None
    
    def send_chat_history(self, client_socket, limit=20):
        try:
            history = self.database.get_chat_history(limit)
            
            if history:
                header_msg = f"[SERVER] === Recent Chat History ({len(history)} messages) ==="
                client_socket.send(header_msg.encode('utf-8'))
                
                import time
                for username, message, timestamp in history:
                    formatted_msg = f"{username}: {message}"
                    client_socket.send(formatted_msg.encode('utf-8'))
                    time.sleep(0.01)
                
                footer_msg = "[SERVER] === End of History ==="
                client_socket.send(footer_msg.encode('utf-8'))
                
                print(f"[*] Sent {len(history)} messages from history")
        
        except Exception as e:
            print(f"[!] Error sending chat history: {e}")

    def broadcast_user_list(self):
        try:
            with self.clients_lock:
                online_users = list(self.clients.values())
            
            if not online_users:
                return
                
            users_msg = f"[USERS_LIST] {','.join(online_users)}"
                
            message_data = users_msg.encode('utf-8')
                
            with self.clients_lock:
                disconnected = []
                for client_socket in self.clients:
                    try:
                        client_socket.send(message_data)
                    except Exception as e:
                        print(f"[!] Error sending user list to client: {e}")
                        disconnected.append(client_socket)
                
                for client_socket in disconnected:
                    if client_socket in self.clients:
                        username = self.clients[client_socket]
                        del self.clients[client_socket]
                        print(f"[-] Removed disconnected client: {username}")
            
            print(f"[*] Broadcasted user list: {online_users}")
        
        except Exception as e:
            print(f"[!] Error broadcasting user list: {e}")

    def broadcast_message(self, message, sender_socket):
        message_data = message.encode('utf-8')
        
        with self.clients_lock:
            disconnected = []
            
            for client_socket in self.clients:
                if client_socket == sender_socket:
                    continue
                
                try:
                    client_socket.send(message_data)
                except Exception as e:
                    disconnected.append(client_socket)
            
            for client_socket in disconnected:
                if client_socket in self.clients:
                    username = self.clients[client_socket]
                    del self.clients[client_socket]
                    print(f"[-] Removed disconnected client: {username}")

    def shutdown(self):
        print("\n[!] Shutting down server...")
        self.running = False
        
        with self.clients_lock:
            for client_socket in list(self.clients.keys()):
                try:
                    client_socket.close()
                except:
                    pass
            self.clients.clear()
        
        try:
            self.server_socket.close()
        except:
            pass
            
        self.database.close()
        
        print(" Server shutdown complete")


def main():
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