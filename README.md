# 🔒 Secure Business Chat System

A modern, real-time encrypted chat application featuring a Next.js web frontend and a FastAPI backend with WebSockets. Built for enterprise-grade scalability, security, and a beautiful user experience.

**Technologies:** FastAPI | WebSockets | SQLite (PostgreSQL Ready) | Next.js | React | TailwindCSS | Framer Motion | JWT

## 📋 Features

### Modern Web Architecture
- **WebSockets Migration**: Real-time persistent bidirectional communication powered by FastAPI WebSockets.
- **RESTful API**: Clean API endpoints for authentication, user management, and file uploads.
- **Next.js Frontend**: A beautiful, single-page application (SPA) built with React and styled with TailwindCSS and Framer Motion micro-animations.

### Security & Authentication
- **Stateless Auth**: Secure login via JSON Web Tokens (JWT) stored client-side.
- **Enhanced Registration**: Supports optional email and phone number fields alongside secure Argon2 password hashing.
- **Transport Security**: Backend built to enforce TLS, with groundwork laid for End-to-End Encryption (E2EE) in private chats.

### Communication Modes
- **Global Broadcast**: A unified room where all connected users can exchange messages.
- **Direct Messaging**: 1-on-1 private messaging routed securely via server-side session management.

### User Experience
- **Sleek Interface**: Glassmorphic dark-mode design system.
- **User Profiles**: Built-in support for avatar uploads and custom profile settings.
- **Interactive Search**: Search bar to easily find online users and initiate direct chats.

## 🚀 Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+ & npm
- pip (Python package installer)

### 1. Backend Setup (FastAPI)

1. **Navigate to the project root:**
```bash
cd messaging-system
```

2. **Install Python dependencies:**
```bash
pip install -r requirements.txt
```

3. **Environment Setup:**
Create a `.env` file in the root directory to store your secrets (JWT secret, DB URL).

4. **Start the FastAPI Server:**
```bash
python -m uvicorn backend.main:app --port 8000
```
*The server will start at `http://127.0.0.1:8000`. The SQLite database (`chat_system.db`) and `uploads/` directory will be created automatically.*

### 2. Frontend Setup (Next.js)

1. **Navigate to the frontend directory:**
```bash
cd frontend
```

2. **Install Node dependencies:**
```bash
npm install
```

3. **Start the Next.js Development Server:**
```bash
npm run dev -p 3005
```
*The frontend will be available at `http://localhost:3005`.*

## 📁 Project Structure

```
messaging-system/
│
├── backend/                  # FastAPI Application
│   ├── main.py               # REST API & WebSocket routing
│   ├── models.py             # SQLAlchemy Database Models
│   ├── schemas.py            # Pydantic validation schemas
│   ├── database.py           # DB connection setup
│   └── auth.py               # JWT and Password hashing
│
├── frontend/                 # Next.js Application
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx      # Main Chat UI & Auth UI
│   │   │   └── globals.css   # Tailwind configuration
│   └── package.json          
│
├── uploads/                  # User avatar storage
├── requirements.txt          # Python dependencies
└── README.md                 # This file
```

## 🔮 Future Enhancements (Roadmap)
- [ ] Complete End-to-End Encryption (E2EE) key exchange for Direct Messages.
- [ ] Migrate SQLite to Supabase (PostgreSQL) for cloud production.
- [ ] Integrate Redis Pub/Sub for horizontal scaling across multiple servers.
- [ ] Dockerize the entire stack with `docker-compose`.

---
## Authors:
- Laila mohamed
- Jana Ahmed
---
*Last updated: 2026*
