# Configuration File - Central settings for the chat system
import os
from dotenv import load_dotenv

load_dotenv()

# Server Configuration
SERVER_HOST = os.getenv('SERVER_HOST', '127.0.0.1')
SERVER_PORT = int(os.getenv('SERVER_PORT', 5555))
MAX_CONNECTIONS = int(os.getenv('MAX_CONNECTIONS', 100))

# Database Configuration
DATABASE_NAME = os.getenv('DATABASE_NAME', 'data/chat_system.db')

# Encryption Configuration
ENCRYPTION_KEY = os.getenv('ENCRYPTION_KEY', 'SecureBusinessChat2024Key!')

# Message Configuration
MAX_MESSAGE_LENGTH = int(os.getenv('MAX_MESSAGE_LENGTH', 4096))
BUFFER_SIZE = int(os.getenv('BUFFER_SIZE', 4096))

# GUI Configuration
GUI_WIDTH = int(os.getenv('GUI_WIDTH', 800))
GUI_HEIGHT = int(os.getenv('GUI_HEIGHT', 600))
CHAT_DISPLAY_HEIGHT = int(os.getenv('CHAT_DISPLAY_HEIGHT', 25))
CHAT_DISPLAY_WIDTH = int(os.getenv('CHAT_DISPLAY_WIDTH', 80))

# Protocol Messages
AUTH_REQUIRED = 'AUTH_REQUIRED'
AUTH_SUCCESS = 'AUTH_SUCCESS'
AUTH_FAILED = 'AUTH_FAILED'
ENTER_USERNAME = 'ENTER_USERNAME'
ENTER_PASSWORD = 'ENTER_PASSWORD'
REGISTRATION_SUCCESS = 'REGISTRATION_SUCCESS'
REGISTRATION_FAILED = 'REGISTRATION_FAILED'
USERNAME_EXISTS = 'USERNAME_EXISTS'
LOGIN = 'LOGIN'
REGISTER = 'REGISTER'
DISCONNECT = 'DISCONNECT'
