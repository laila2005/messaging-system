# client.py - Basic version
import socket
import threading

class ChatClient:
    def __init__(self, host='127.0.0.1', port=5555):
        self.client_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.client_socket.connect((host, port))
        
    def receive_messages(self):
        while True:
            try:
                message = self.client_socket.recv(1024).decode('utf-8')
                print(f"\n{message}")
            except:
                print("Connection closed")
                break
    
    def send_messages(self):
        while True:
            message = input()
            self.client_socket.send(message.encode('utf-8'))
    
    def start(self):
        receive_thread = threading.Thread(target=self.receive_messages)
        receive_thread.start()
        self.send_messages()

if __name__ == "__main__":
    client = ChatClient()
    client.start()