# clint/gui_client.py - Graphical User Interface Chat Client
"""
GUI chat client using Tkinter.

Features:
- User-friendly graphical interface
- Login/registration windows
- Scrollable chat display
- Message input field with send button
- Real-time message updates
- Modern, professional design with gradients and styling
- Emoji support and timestamps
- Online users list
- Typing indicators

Usage:
    python gui_client.py
"""

import socket
import threading
import tkinter as tk
from tkinter import scrolledtext, messagebox, simpledialog, ttk
import sys
import os
from datetime import datetime

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import config
from security.tls_setup import TLSConfig


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
        self.window.geometry("450x400")
        self.window.resizable(False, False)
        self.window.configure(bg='#1a1a2e')
        
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
        # Header with gradient effect
        header_frame = tk.Frame(self.window, bg='#0f3460', height=100)
        header_frame.pack(fill=tk.X, pady=(0, 20))
        header_frame.pack_propagate(False)
        
        title_label = tk.Label(
            header_frame,
            text="🔒 Secure Business Chat",
            font=("Segoe UI", 20, "bold"),
            bg='#0f3460',
            fg='#e94560'
        )
        title_label.pack(pady=10)
        
        subtitle_label = tk.Label(
            header_frame,
            text="Enterprise-Grade Encrypted Messaging",
            font=("Segoe UI", 9),
            bg='#0f3460',
            fg='#16213e'
        )
        subtitle_label.pack()
        
        # Main content frame
        content_frame = tk.Frame(self.window, bg='#1a1a2e')
        content_frame.pack(fill=tk.BOTH, expand=True, padx=40)
        
        # Username
        username_label = tk.Label(
            content_frame,
            text="Username",
            font=("Segoe UI", 10, "bold"),
            bg='#1a1a2e',
            fg='#ffffff',
            anchor='w'
        )
        username_label.pack(fill=tk.X, pady=(10, 5))
        
        self.username_entry = tk.Entry(
            content_frame,
            font=("Segoe UI", 11),
            bg='#16213e',
            fg='#ffffff',
            insertbackground='#e94560',
            relief=tk.FLAT,
            bd=0
        )
        self.username_entry.pack(fill=tk.X, ipady=8)
        
        # Password
        password_label = tk.Label(
            content_frame,
            text="Password",
            font=("Segoe UI", 10, "bold"),
            bg='#1a1a2e',
            fg='#ffffff',
            anchor='w'
        )
        password_label.pack(fill=tk.X, pady=(20, 5))
        
        self.password_entry = tk.Entry(
            content_frame,
            font=("Segoe UI", 11),
            bg='#16213e',
            fg='#ffffff',
            insertbackground='#e94560',
            show="●",
            relief=tk.FLAT,
            bd=0
        )
        self.password_entry.pack(fill=tk.X, ipady=8)
        
        # Buttons
        button_frame = tk.Frame(content_frame, bg='#1a1a2e')
        button_frame.pack(pady=30)
        
        login_btn = tk.Button(
            button_frame,
            text="LOGIN",
            width=15,
            command=self.login,
            bg="#e94560",
            fg="white",
            font=("Segoe UI", 11, "bold"),
            relief=tk.FLAT,
            cursor="hand2",
            activebackground="#d63447",
            activeforeground="white"
        )
        login_btn.pack(side=tk.LEFT, padx=5, ipady=5)
        
        register_btn = tk.Button(
            button_frame,
            text="REGISTER",
            width=15,
            command=self.register,
            bg="#0f3460",
            fg="white",
            font=("Segoe UI", 11, "bold"),
            relief=tk.FLAT,
            cursor="hand2",
            activebackground="#16213e",
            activeforeground="white"
        )
        register_btn.pack(side=tk.LEFT, padx=5, ipady=5)
        
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
        
        # Initialize TLS configuration
        self.tls_config = TLSConfig()
        
        # Client state
        self.running = False
        self.username = None
        
        # Create main window
        self.window = tk.Tk()
        self.window.title("Secure Business Chat")
        self.window.geometry(f"{config.GUI_WIDTH}x{config.GUI_HEIGHT}")
        self.window.configure(bg='#1a1a2e')
        
        # Online users list
        self.online_users = []
        
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
        menubar = tk.Menu(self.window, bg='#16213e', fg='white')
        self.window.config(menu=menubar)
        
        # File menu
        file_menu = tk.Menu(menubar, tearoff=0, bg='#16213e', fg='white')
        menubar.add_cascade(label="File", menu=file_menu)
        file_menu.add_command(label="Clear Chat History", command=self.clear_chat_display)
        file_menu.add_separator()
        file_menu.add_command(label="Logout / Switch User", command=self.logout)
        file_menu.add_separator()
        file_menu.add_command(label="Exit", command=self.on_closing)
        
        # Help menu
        help_menu = tk.Menu(menubar, tearoff=0, bg='#16213e', fg='white')
        menubar.add_cascade(label="Help", menu=help_menu)
        help_menu.add_command(label="Commands", command=self.show_help)
        help_menu.add_command(label="About", command=self.show_about)
        
        # Top frame - Header with gradient
        top_frame = tk.Frame(self.window, bg="#0f3460", height=70)
        top_frame.pack(side=tk.TOP, fill=tk.X)
        top_frame.pack_propagate(False)
        
        self.status_label = tk.Label(
            top_frame,
            text="🔒 Secure Business Chat - Not Connected",
            bg="#0f3460",
            fg="#e94560",
            font=("Segoe UI", 14, "bold")
        )
        self.status_label.pack(pady=10)
        
        self.connection_status = tk.Label(
            top_frame,
            text="● Offline (TLS)",
            bg="#0f3460",
            fg="#ff6b6b",
            font=("Segoe UI", 9)
        )
        self.connection_status.pack()
        
        # Main container
        main_container = tk.Frame(self.window, bg='#1a1a2e')
        main_container.pack(side=tk.TOP, fill=tk.BOTH, expand=True)
        
        # Left sidebar - Online users
        sidebar_frame = tk.Frame(main_container, bg='#16213e', width=200)
        sidebar_frame.pack(side=tk.LEFT, fill=tk.Y, padx=(10, 5), pady=10)
        sidebar_frame.pack_propagate(False)
        
        sidebar_title = tk.Label(
            sidebar_frame,
            text="👥 Online Users",
            bg='#16213e',
            fg='#e94560',
            font=("Segoe UI", 11, "bold")
        )
        sidebar_title.pack(pady=10, padx=10, anchor='w')
        
        self.users_listbox = tk.Listbox(
            sidebar_frame,
            bg='#0f3460',
            fg='#ffffff',
            font=("Segoe UI", 10),
            relief=tk.FLAT,
            selectbackground='#e94560',
            selectforeground='#ffffff',
            bd=0,
            highlightthickness=0
        )
        self.users_listbox.pack(fill=tk.BOTH, expand=True, padx=10, pady=(0, 10))
        
        # Right side - Chat area
        chat_container = tk.Frame(main_container, bg='#1a1a2e')
        chat_container.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True, padx=(5, 10), pady=10)
        
        # Chat display
        self.chat_display = scrolledtext.ScrolledText(
            chat_container,
            state='disabled',
            wrap=tk.WORD,
            font=("Segoe UI", 10),
            bg="#16213e",
            fg="#ffffff",
            relief=tk.FLAT,
            bd=0,
            padx=15,
            pady=15,
            insertbackground='#e94560',
            selectbackground='#0f3460'
        )
        self.chat_display.pack(fill=tk.BOTH, expand=True)
        
        # Configure tags for different message types
        self.chat_display.tag_config("server", foreground="#ff6b6b", font=("Segoe UI", 10, "bold"))
        self.chat_display.tag_config("self", foreground="#51cf66", font=("Segoe UI", 10, "bold"))
        self.chat_display.tag_config("other", foreground="#4dabf7", font=("Segoe UI", 10))
        self.chat_display.tag_config("timestamp", foreground="#868e96", font=("Segoe UI", 8))
        self.chat_display.tag_config("username", foreground="#ffd43b", font=("Segoe UI", 10, "bold"))
        
        # Bottom frame - Input area
        bottom_frame = tk.Frame(chat_container, bg="#0f3460", height=60)
        bottom_frame.pack(side=tk.BOTTOM, fill=tk.X, pady=(10, 0))
        bottom_frame.pack_propagate(False)
        
        # Input container
        input_container = tk.Frame(bottom_frame, bg='#0f3460')
        input_container.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        self.message_entry = tk.Entry(
            input_container,
            font=("Segoe UI", 11),
            bg='#16213e',
            fg='#ffffff',
            insertbackground='#e94560',
            relief=tk.FLAT,
            bd=0,
            state='disabled'
        )
        self.message_entry.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, ipady=8, padx=(0, 10))
        self.message_entry.bind('<Return>', lambda e: self.send_message())
        
        self.send_button = tk.Button(
            input_container,
            text="📤 SEND",
            width=12,
            command=self.send_message,
            bg="#e94560",
            fg="white",
            font=("Segoe UI", 10, "bold"),
            relief=tk.FLAT,
            cursor="hand2",
            state='disabled',
            activebackground="#d63447",
            activeforeground="white"
        )
        self.send_button.pack(side=tk.RIGHT, ipady=5)
        
        # Clear chat button (below send button)
        self.clear_button = tk.Button(
            input_container,
            text="🗑️ Clear",
            width=12,
            command=self.clear_chat_display,
            bg="#0f3460",
            fg="white",
            font=("Segoe UI", 9),
            relief=tk.FLAT,
            cursor="hand2",
            activebackground="#1a4d7a",
            activeforeground="white"
        )
        self.clear_button.pack(side=tk.RIGHT, ipady=5, padx=(0, 5))
    
    def clear_chat_display(self):
        """Clear the chat display (local only, doesn't affect database)."""
        try:
            if hasattr(self, 'chat_display') and self.chat_display.winfo_exists():
                self.chat_display.config(state='normal')
                self.chat_display.delete(1.0, tk.END)
                self.chat_display.config(state='disabled')
                # Show confirmation message
                self.display_message("[CLIENT] Chat display cleared (history still in database)", "server")
        except Exception as e:
            print(f"[!] Error clearing chat display: {e}")
    
    def display_message(self, message, tag="other"):
        """
        Display a message in the chat window with timestamp.
        Thread-safe method that works from background threads.
        
        Args:
            message (str): Message to display
            tag (str): Tag for formatting (server, self, other)
        """
        def _display():
            try:
                if self.chat_display.winfo_exists():
                    self.chat_display.config(state='normal')
                    
                    # Add timestamp
                    timestamp = datetime.now().strftime('%H:%M:%S')
                    self.chat_display.insert(tk.END, f"[{timestamp}] ", "timestamp")
                    
                    # Parse and format message
                    if ':' in message and not message.startswith('['):
                        parts = message.split(':', 1)
                        username = parts[0]
                        content = parts[1]
                        self.chat_display.insert(tk.END, username, "username")
                        self.chat_display.insert(tk.END, ':', tag)
                        self.chat_display.insert(tk.END, content + '\n', tag)
                    else:
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
        """Connect to the chat server using TLS."""
        try:
            self.display_message(f"[*] Connecting to {self.host}:{self.port} (TLS)...", "server")
            
            self.client_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            
            # Create TLS context for client
            tls_context = self.tls_config.create_client_context(verify=False)
            
            # Wrap socket with TLS
            self.client_socket = tls_context.wrap_socket(
                self.client_socket, 
                server_hostname=self.host
            )
            
            # Set socket options to prevent connection issues
            self.client_socket.setsockopt(socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1)
            self.client_socket.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
            
            # Set timeout for receive operations (30 seconds)
            self.client_socket.settimeout(30.0)
            
            # Connect to server
            self.client_socket.connect((self.host, self.port))
            
            self.display_message("✓ Connected to server with TLS encryption!", "server")
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
                self.status_label.config(text=f"🔒 Secure Business Chat - Connected as {self.username} (TLS)")
                self.connection_status.config(text="● Online (TLS)", fg="#51cf66")
                
                # Don't add self here - server will send complete user list via [USERS_LIST]
                
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
                # Receive message (TLS provides encryption)
                message_data = self.client_socket.recv(config.BUFFER_SIZE)
                
                if not message_data:
                    self.display_message("[!] Connection closed by server", "server")
                    self.running = False
                    break
                
                # Decode message (TLS provides transport encryption)
                message = message_data.decode('utf-8')
                
                # Determine message type and display
                # Note: We skip our own messages since we display them when sending
                if message.startswith("[USERS_LIST]"):
                    # Handle server-sent user list update
                    self.update_users_from_server(message)
                elif message.startswith("[SERVER]"):
                    # Don't display history headers, just the actual messages
                    if "Recent Chat History" not in message and "End of History" not in message:
                        self.display_message(message, "server")
                elif message.startswith(f"{self.username}:"):
                    pass
                else:
                    # Display all other messages (including history messages)
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
            
            # Send message (TLS provides encryption)
            message_data = message.encode('utf-8')
            self.client_socket.send(message_data)
        
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
• Real-time TLS-encrypted messaging
• Color-coded messages:
  - Red: Server messages
  - Green: Your messages
  - Blue: Other users' messages
• Timestamps on all messages
• Online users sidebar
• Modern professional UI

TIPS:
• Messages are encrypted with TLS 1.2+
• All messages are saved to database
• Use strong passwords for security
        """
        messagebox.showinfo("Help", help_text)
    
    def show_about(self):
        """Show about dialog."""
        about_text = """
🔒 Secure Business Chat System
Version 2.1 (TLS Edition)

Enterprise-Grade Secure Messaging

Features:
✓ TLS 1.2+ Transport Encryption
✓ Multi-threaded Server
✓ Real-time Communication
✓ User Authentication
✓ Message History
✓ Professional UI/UX
✓ Certificate-based Security

Developed with Python & Tkinter
© 2024 Secure Business Chat
        """
        messagebox.showinfo("About", about_text)
    
    def update_users_list(self):
        """Update the online users list."""
        try:
            self.users_listbox.delete(0, tk.END)
            for user in self.online_users:
                display_name = f"● {user}" if user == self.username else f"○ {user}"
                self.users_listbox.insert(tk.END, display_name)
        except Exception as e:
            pass
    
    def update_users_from_server(self, message):
        """Update users list based on server-sent user list."""
        try:
            # Extract users from message: [USERS_LIST] user1,user2,user3
            users_str = message.replace("[USERS_LIST]", "").strip()
            
            if users_str:
                # Split by comma and clean
                users_list = [user.strip() for user in users_str.split(',') if user.strip()]
            else:
                users_list = []
            
            # Update online users list
            self.online_users = users_list
            self.update_users_list()
            
            print(f"[*] Updated users list: {self.online_users}")
        
        except Exception as e:
            print(f"[!] Error updating users from server: {e}")
    
    def update_users_from_message(self, message):
        """Update users list based on server message (fallback method)."""
        try:
            if "joined the chat" in message:
                username = message.replace("[SERVER]", "").replace("joined the chat!", "").strip()
                if username and username not in self.online_users:
                    self.online_users.append(username)
                    self.update_users_list()
            elif "left the chat" in message:
                username = message.replace("[SERVER]", "").replace("left the chat.", "").strip()
                if username in self.online_users:
                    self.online_users.remove(username)
                    self.update_users_list()
        except Exception as e:
            pass


def main():
    """Main entry point for GUI client."""
    # Allow custom host/port via command line
    host = sys.argv[1] if len(sys.argv) > 1 else None
    port = int(sys.argv[2]) if len(sys.argv) > 2 else None
    
    gui = ChatGUI(host, port)
    gui.start()


if __name__ == "__main__":
    main()
