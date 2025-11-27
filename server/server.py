# server.py - Basic version
import socket
import threading

class ChatServer:
    def __init__(self, host='127.0.0.1', port=5555):
        self.host = host
        self.port = port
        self.server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.clients = []  # List to store connected clients
        
    def start(self):
        self.server_socket.bind((self.host, self.port))
        self.server_socket.listen(5)
        print(f"Server listening on {self.host}:{self.port}")
        
        while True:
            client_socket, address = self.server_socket.accept()
            print(f"Connection from {address}")
            
            # Handle each client in a separate thread
            client_thread = threading.Thread(
                target=self.handle_client, 
                args=(client_socket,)
            )
            client_thread.start()
    
    def handle_client(self, client_socket):
        self.clients.append(client_socket)
        try:
            while True:
                message = client_socket.recv(1024).decode('utf-8')
                if not message:
                    break
                print(f"Received: {message}")
                self.broadcast(message, client_socket)
        except:
            pass
        finally:
            self.clients.remove(client_socket)
            client_socket.close()
    
    def broadcast(self, message, sender_socket):
        for client in self.clients:
            if client != sender_socket:
                try:
                    client.send(message.encode('utf-8'))
                except:
                    self.clients.remove(client)

if __name__ == "__main__":
    server = ChatServer()
    server.start()