# clint/gui_client.py - Graphical User Interface Chat Client
"""
GUI chat client using Tkinter.

Features:
- User-friendly graphical interface
- Login/registration windows
- Scrollable chat display
- Message input field with send button
- Real-time message updates
- Clean, modern design

Usage:
    python gui_client.py
"""

import socket
import threading
import tkinter as tk
from tkinter import scrolledtext, messagebox, simpledialog
import sys
import os

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import config
from security.encryption import MessageEncryption


class LoginWindow:
    """
    Login/Registration window for authentication.
    """
    
    def __init__(self, parent):
        """
        Initialize login window.
        
        Args:
            parent: Parent Tkinter window
        """
        self.window = tk.Toplevel(parent)
        self.window.title("Login - Secure Business Chat")
        self.window.geometry("400x300")
        self.window.resizable(False, False)
        
        # Center window
        self.center_window()
        
        # Result variables
        self.username = None
        self.password = None
        self.is_register = False
        self.success = False
        
        # Create UI
        self.create_widgets()
        
        # Make modal
        self.window.transient(parent)
        self.window.grab_set()
    
    def center_window(self):
        """Center the window on screen."""
        self.window.update_idletasks()
        width = self.window.winfo_width()
        height = self.window.winfo_height()
        x = (self.window.winfo_screenwidth() // 2) - (width // 2)
        y = (self.window.winfo_screenheight() // 2) - (height // 2)
        self.window.geometry(f'{width}x{height}+{x}+{y}')
    
    def create_widgets(self):
        """Create login window widgets."""
        # Title
        title_label = tk.Label(
            self.window,
            text="🔒 Secure Business Chat",
            font=("Arial", 16, "bold")
        )
        title_label.pack(pady=20)
        
        # Username
        username_frame = tk.Frame(self.window)
        username_frame.pack(pady=10, padx=20, fill=tk.X)
        
        tk.Label(username_frame, text="Username:", width=12, anchor='w').pack(side=tk.LEFT)
        self.username_entry = tk.Entry(username_frame, width=25)
        self.username_entry.pack(side=tk.LEFT, padx=5)
        
        # Password
        password_frame = tk.Frame(self.window)
        password_frame.pack(pady=10, padx=20, fill=tk.X)
        
        tk.Label(password_frame, text="Password:", width=12, anchor='w').pack(side=tk.LEFT)
        self.password_entry = tk.Entry(password_frame, width=25, show="*")
        self.password_entry.pack(side=tk.LEFT, padx=5)
        
        # Buttons
        button_frame = tk.Frame(self.window)
        button_frame.pack(pady=20)
        
        login_btn = tk.Button(
            button_frame,
            text="Login",
            width=12,
            command=self.login,
            bg="#4CAF50",
            fg="white",
            font=("Arial", 10, "bold")
        )
        login_btn.pack(side=tk.LEFT, padx=5)
        
        register_btn = tk.Button(
            button_frame,
            text="Register",
            width=12,
            command=self.register,
            bg="#2196F3",
            fg="white",
            font=("Arial", 10, "bold")
        )
        register_btn.pack(side=tk.LEFT, padx=5)
        
        # Bind Enter key
        self.window.bind('<Return>', lambda e: self.login())
        
        # Focus username entry
        self.username_entry.focus()
    
    def login(self):
        """Handle login button click."""
        self.username = self.username_entry.get().strip()
        self.password = self.password_entry.get().strip()
        
        if not self.username or len(self.username) < 3:
            messagebox.showerror("Error", "Username must be at least 3 characters")
            return
        
        if not self.password or len(self.password) < 4:
            messagebox.showerror("Error", "Password must be at least 4 characters")
            return
        
        self.is_register = False
        self.success = True
        self.window.destroy()
    
    def register(self):
        """Handle register button click."""
        self.username = self.username_entry.get().strip()
        self.password = self.password_entry.get().strip()
        
        if not self.username or len(self.username) < 3:
            messagebox.showerror("Error", "Username must be at least 3 characters")
            return
        
        if not self.password or len(self.password) < 4:
            messagebox.showerror("Error", "Password must be at least 4 characters")
            return
        
        self.is_register = True
        self.success = True
        self.window.destroy()


class ChatGUI:
    """
    Main chat GUI window.
    """
    
    def __init__(self, host=None, port=None):
        """
        Initialize chat GUI.
        
        Args:
            host (str): Server IP address
            port (int): Server port number
        """
        self.host = host or config.SERVER_HOST
        self.port = port or config.SERVER_PORT
        
        # Create socket
        self.client_socket = None
        
        # Initialize encryption
        self.encryption = MessageEncryption(config.ENCRYPTION_KEY)
        
        # Client state
        self.running = False
        self.username = None
        
        # Create main window
        self.window = tk.Tk()
        self.window.title("Secure Business Chat")
        self.window.geometry(f"{config.GUI_WIDTH}x{config.GUI_HEIGHT}")
        
        # Center window
        self.center_window()
        
        # Create UI
        self.create_widgets()
        
        # Handle window close
        self.window.protocol("WM_DELETE_WINDOW", self.on_closing)
    
    def center_window(self):
        """Center the window on screen."""
        self.window.update_idletasks()
        width = self.window.winfo_width()
        height = self.window.winfo_height()
        x = (self.window.winfo_screenwidth() // 2) - (width // 2)
        y = (self.window.winfo_screenheight() // 2) - (height // 2)
        self.window.geometry(f'{width}x{height}+{x}+{y}')
    
    def create_widgets(self):
        """Create GUI widgets."""
        # Menu bar
        menubar = tk.Menu(self.window)
        self.window.config(menu=menubar)
        
        # File menu
        file_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="File", menu=file_menu)
        file_menu.add_command(label="Logout / Switch User", command=self.logout)
        file_menu.add_separator()
        file_menu.add_command(label="Exit", command=self.on_closing)
        
        # Help menu
        help_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="Help", menu=help_menu)
        help_menu.add_command(label="Commands", command=self.show_help)
        
        # Top frame - Status bar
        top_frame = tk.Frame(self.window, bg="#2c3e50", height=50)
        top_frame.pack(side=tk.TOP, fill=tk.X)
        top_frame.pack_propagate(False)
        
        self.status_label = tk.Label(
            top_frame,
            text="🔒 Secure Business Chat - Not Connected",
            bg="#2c3e50",
            fg="white",
            font=("Arial", 12, "bold")
        )
        self.status_label.pack(pady=15)
        
        # Middle frame - Chat display
        middle_frame = tk.Frame(self.window)
        middle_frame.pack(side=tk.TOP, fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        self.chat_display = scrolledtext.ScrolledText(
            middle_frame,
            state='disabled',
            wrap=tk.WORD,
            font=("Arial", 10),
            bg="#ecf0f1",
            fg="#2c3e50"
        )
        self.chat_display.pack(fill=tk.BOTH, expand=True)
        
        # Configure tags for different message types
        self.chat_display.tag_config("server", foreground="#e74c3c", font=("Arial", 10, "bold"))
        self.chat_display.tag_config("self", foreground="#27ae60", font=("Arial", 10, "bold"))
        self.chat_display.tag_config("other", foreground="#3498db", font=("Arial", 10, "bold"))
        
        # Bottom frame - Input area
        bottom_frame = tk.Frame(self.window, bg="#ecf0f1")
        bottom_frame.pack(side=tk.BOTTOM, fill=tk.X, padx=10, pady=10)
        
        self.message_entry = tk.Entry(
            bottom_frame,
            font=("Arial", 11),
            state='disabled'
        )
        self.message_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 10))
        self.message_entry.bind('<Return>', lambda e: self.send_message())
        
        self.send_button = tk.Button(
            bottom_frame,
            text="Send",
            width=10,
            command=self.send_message,
            bg="#27ae60",
            fg="white",
            font=("Arial", 10, "bold"),
            state='disabled'
        )
        self.send_button.pack(side=tk.RIGHT)
    
    def display_message(self, message, tag="other"):
        """
        Display a message in the chat window.
        Thread-safe method that works from background threads.
        
        Args:
            message (str): Message to display
            tag (str): Tag for formatting (server, self, other)
        """
        def _display():
            try:
                if self.chat_display.winfo_exists():
                    self.chat_display.config(state='normal')
                    self.chat_display.insert(tk.END, message + '\n', tag)
                    self.chat_display.see(tk.END)
                    self.chat_display.config(state='disabled')
            except Exception as e:
                pass
        
        # Use after() to ensure thread-safe GUI updates
        try:
            if hasattr(self, 'window') and self.window.winfo_exists():
                self.window.after(0, _display)
        except Exception as e:
            pass
    
    def connect(self):
        """Connect to the chat server."""
        try:
            self.display_message(f"[*] Connecting to {self.host}:{self.port}...", "server")
            
            self.client_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            
            # Set socket options to prevent connection issues
            self.client_socket.setsockopt(socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1)
            self.client_socket.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
            
            # Set timeout for receive operations (30 seconds)
            self.client_socket.settimeout(30.0)
            
            self.client_socket.connect((self.host, self.port))
            
            self.display_message("✓ Connected to server!", "server")
            return True
        
        except Exception as e:
            self.display_message(f"✗ Connection failed: {e}", "server")
            messagebox.showerror("Connection Error", f"Failed to connect to server:\n{e}")
            return False
    
    def authenticate(self):
        """Handle authentication with server."""
        try:
            # Receive AUTH_REQUIRED
            response = self.client_socket.recv(1024).decode('utf-8')
            
            if response != config.AUTH_REQUIRED:
                self.display_message(f"✗ Unexpected server response: {response}", "server")
                return False
            
            # Show login window
            login_window = LoginWindow(self.window)
            self.window.wait_window(login_window.window)
            
            if not login_window.success:
                return False
            
            # Send login or register
            if login_window.is_register:
                self.client_socket.send(config.REGISTER.encode('utf-8'))
            else:
                self.client_socket.send(config.LOGIN.encode('utf-8'))
            
            # Receive ENTER_USERNAME
            response = self.client_socket.recv(1024).decode('utf-8')
            if response != config.ENTER_USERNAME:
                self.display_message(f"✗ Error: {response}", "server")
                return False
            
            # Send username
            self.client_socket.send(login_window.username.encode('utf-8'))
            
            # Receive ENTER_PASSWORD
            response = self.client_socket.recv(1024).decode('utf-8')
            if response != config.ENTER_PASSWORD:
                self.display_message(f"✗ Error: {response}", "server")
                return False
            
            # Send password
            self.client_socket.send(login_window.password.encode('utf-8'))
            
            # Receive authentication result
            response = self.client_socket.recv(1024).decode('utf-8')
            
            if response.startswith(config.AUTH_SUCCESS):
                # Extract username
                parts = response.split('|')
                self.username = parts[1] if len(parts) > 1 else login_window.username
                
                self.display_message(f"✓ Logged in as: {self.username}", "server")
                self.status_label.config(text=f"🔒 Secure Business Chat - Connected as {self.username}")
                
                # Enable input
                self.message_entry.config(state='normal')
                self.send_button.config(state='normal')
                self.message_entry.focus()
                
                return True
            
            elif response == config.USERNAME_EXISTS:
                messagebox.showerror("Error", "Username already exists. Please try logging in.")
                return False
            
            elif response == config.AUTH_FAILED:
                messagebox.showerror("Error", "Authentication failed. Invalid credentials.")
                return False
            
            else:
                self.display_message(f"✗ Error: {response}", "server")
                return False
        
        except Exception as e:
            self.display_message(f"✗ Authentication error: {e}", "server")
            messagebox.showerror("Authentication Error", f"Authentication failed:\n{e}")
            return False
    
    def receive_messages(self):
        """Continuously receive messages from server (runs in separate thread)."""
        while self.running:
            try:
                # Receive encrypted message
                encrypted_data = self.client_socket.recv(config.BUFFER_SIZE)
                
                if not encrypted_data:
                    self.display_message("[!] Connection closed by server", "server")
                    self.running = False
                    break
                
                # Decrypt message
                encrypted_message = encrypted_data.decode('utf-8')
                message = self.encryption.decrypt(encrypted_message)
                
                # Determine message type and display
                # Note: We skip our own messages since we display them when sending
                if message.startswith("[SERVER]"):
                    self.display_message(message, "server")
                elif message.startswith(f"{self.username}:"):
                    pass
                else:
                    self.display_message(message, "other")
            
            except socket.timeout:
                continue
            except ConnectionAbortedError as e:
                if self.running:
                    self.display_message("[!] Connection lost. Please restart the client.", "server")
                break
            except ConnectionResetError as e:
                if self.running:
                    self.display_message("[!] Server disconnected. Please restart the client.", "server")
                break
            except OSError as e:
                # Handle Windows socket errors
                if e.winerror == 10053:
                    if self.running:
                        self.display_message("[!] Connection aborted. Check server status.", "server")
                else:
                    if self.running:
                        self.display_message(f"[!] Network error: {e}", "server")
                break
            except Exception as e:
                if self.running:
                    self.display_message(f"[!] Error: {e}", "server")
                break
    
    def send_message(self):
        """Send a message to the server."""
        try:
            message = self.message_entry.get().strip()
            
            # Don't send empty messages
            if not message:
                return
            
            # Clear input
            self.message_entry.delete(0, tk.END)
            
            # Display own message immediately (since server won't echo it back)
            formatted_message = f"{self.username}: {message}"
            self.display_message(formatted_message, "self")
            
            # Encrypt and send
            encrypted_message = self.encryption.encrypt(message)
            self.client_socket.send(encrypted_message.encode('utf-8'))
        
        except Exception as e:
            self.display_message(f"[!] Error sending message: {e}", "server")
            messagebox.showerror("Send Error", f"Failed to send message:\n{e}")
    
    def start(self):
        """Start the chat client."""
        # Connect to server
        if not self.connect():
            self.window.after(100, self.window.destroy)
            return
        
        # Authenticate
        if not self.authenticate():
            self.display_message("[!] Authentication failed. Exiting...", "server")
            self.window.after(2000, self.window.destroy)
            return
        
        # Start running
        self.running = True
        
        # Start receive thread
        receive_thread = threading.Thread(target=self.receive_messages)
        receive_thread.daemon = True
        receive_thread.start()
        
        # Start GUI main loop
        self.window.mainloop()
    
    def on_closing(self):
        """Handle window close event."""
        if messagebox.askokcancel("Quit", "Do you want to quit?"):
            self.disconnect()
            self.window.destroy()
    
    def disconnect(self):
        """Disconnect from server and cleanup."""
        self.running = False
        
        if self.client_socket:
            try:
                self.client_socket.close()
            except:
                pass
    
    def logout(self):
        """Logout and restart the application to login as different user."""
        if messagebox.askyesno("Logout", "Do you want to logout and login as a different user?"):
            self.disconnect()
            self.window.destroy()
            
            # Restart the GUI client
            import subprocess
            subprocess.Popen([sys.executable, __file__])
    
    def show_help(self):
        """Show help dialog with available commands."""
        help_text = """
🔒 SECURE BUSINESS CHAT - HELP

COMMANDS:
• Type message and press Enter to send
• /quit - Exit the chat

MENU OPTIONS:
• File → Logout / Switch User - Login as different user
• File → Exit - Close the application

FEATURES:
• Real-time encrypted messaging
• Color-coded messages:
  - Red: Server messages
  - Green: Your messages
  - Blue: Other users' messages

TIPS:
• Messages are encrypted with AES-256
• All messages are saved to database
• Use strong passwords for security
        """
        messagebox.showinfo("Help", help_text)


def main():
    """Main entry point for GUI client."""
    # Allow custom host/port via command line
    host = sys.argv[1] if len(sys.argv) > 1 else None
    port = int(sys.argv[2]) if len(sys.argv) > 2 else None
    
    gui = ChatGUI(host, port)
    gui.start()


if __name__ == "__main__":
    main()
