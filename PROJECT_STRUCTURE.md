# Project Structure

```
messaging-system/
│
├── config.py                    # Central configuration file
├── requirements.txt             # Python dependencies
├── README.md                    # Quick start guide
├── DOCUMENTATION.md             # Complete technical documentation
│
├── server/
│   ├── __init__.py
│   └── server.py               # Multi-threaded chat server
│
├── clint/
│   ├── __init__.py
│   ├── client.py               # CLI client
│   └── gui_client.py           # GUI client (Tkinter)
│
├── database/
│   ├── __init__.py
│   └── database.py             # SQLite database management
│
├── security/
│   ├── __init__.py
│   └── encryption.py           # AES-256 encryption
│
├── tests/
│   ├── test_database.py        # Database tests
│   └── test_encryption.py      # Encryption tests
│
├── scripts/
│   ├── start_server.bat        # Windows: Start server
│   ├── start_cli_client.bat    # Windows: Start CLI client
│   ├── start_gui_client.bat    # Windows: Start GUI client
│   └── run_tests.bat           # Windows: Run all tests
│
└── data/
    ├── chat_system.db          # SQLite database (auto-created)
    └── logs/                   # Log files (optional)
```

## File Descriptions

### Core Files

- **config.py** - All configuration settings (host, port, encryption key, etc.)
- **requirements.txt** - Python package dependencies (pycryptodome)

### Server

- **server/server.py** - Main server that handles all clients, authentication, and message broadcasting

### Clients

- **clint/client.py** - Command-line interface client
- **clint/gui_client.py** - Graphical user interface client using Tkinter

### Database

- **database/database.py** - Handles user registration, authentication, and message logging

### Security

- **security/encryption.py** - AES-256-EAX encryption and decryption

### Tests

- **tests/test_database.py** - Tests for database operations
- **tests/test_encryption.py** - Tests for encryption/decryption

### Scripts

- **scripts/*.bat** - Windows batch files for easy launching

### Data

- **data/chat_system.db** - SQLite database file (created automatically on first run)
- **data/logs/** - Directory for log files

## Quick Start

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Start server
python server/server.py

# 3. Start client (new terminal)
python clint/gui_client.py
```

## Key Components

| Component | File | Purpose |
|-----------|------|---------|
| Server | `server/server.py` | Handles connections, authentication, broadcasting |
| GUI Client | `clint/gui_client.py` | User-friendly graphical interface |
| CLI Client | `clint/client.py` | Terminal-based interface |
| Database | `database/database.py` | User accounts and message storage |
| Encryption | `security/encryption.py` | Message encryption/decryption |
| Config | `config.py` | Centralized settings |

## Data Flow

```
User Input → Client → Encryption → Network → Server → Database
                                              ↓
                                         Broadcast
                                              ↓
                                    Other Clients → Decryption → Display
```
