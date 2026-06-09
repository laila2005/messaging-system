<div align="center">
  <h1>🕊️ Zagel (زاجل)</h1>
  <p><strong>Enterprise-Grade Real-Time Messaging & WebRTC Video Conferencing</strong></p>

  [![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
  [![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
  [![WebRTC](https://img.shields.io/badge/WebRTC-P2P-333333?logo=webrtc)](https://webrtc.org/)
  [![Capacitor](https://img.shields.io/badge/Capacitor-Mobile-119EFF?logo=capacitor)](https://capacitorjs.com/)
  [![Electron](https://img.shields.io/badge/Electron-Desktop-47848F?logo=electron)](https://www.electronjs.org/)
</div>

<br />

## 📖 Overview

A highly scalable, secure, and modern unified communications platform built to handle both global broadcast messaging and private, encrypted 1-on-1 chats. This platform completely bridges the gap between web, desktop, and mobile users by leveraging a powerful **Next.js** frontend wrapper in **Electron** and **Capacitor**, all backed by a high-performance **FastAPI** WebSocket server.

## ✨ Key Features

- **Real-Time WebSockets**: Sub-millisecond latency for instant text messaging, typing indicators, and read receipts.
- **WebRTC Audio & Video**: Fully integrated P2P architecture for zero-latency, high-fidelity video conferencing and voice calls without burdening the server.
- **Robust Security & Moderation**: JWT-based stateless authentication, real-time message toxicity filtering, and automated data retention policies for enterprise compliance.
- **Modern UI/UX**: A beautifully crafted "Glassmorphic" interface featuring dynamic animations, dark mode aesthetics, and fully responsive layouts.
- **Rich Media Sharing**: Built-in support for native voice memos (`MediaRecorder`), drag-and-drop file attachments, and an interactive emoji picker.
- **Cross-Platform Native**: Run the exact same codebase as a Progressive Web App (PWA), a Windows `.exe` via Electron, or an Android `.apk` via Capacitor.

---

## 🏗️ System Architecture

```mermaid
graph TD
    %% Frontend Clients
    subgraph Clients["Client Applications"]
        Web["Web App (Next.js)"]
        Desktop["Desktop (Electron)"]
        Mobile["Mobile (Capacitor)"]
    end

    %% API Gateway & Server
    subgraph Backend["FastAPI Backend Server"]
        REST["REST API (Auth, Uploads, Admin)"]
        WS["WebSocket Manager (Signaling & Chat)"]
    end

    %% Database Layer
    subgraph DataLayer["Persistence Layer"]
        DB[(PostgreSQL / SQLite)]
        Storage[Local / Cloud File Storage]
    end

    %% Connections
    Clients -->|HTTPS| REST
    Clients <-->|WSS| WS
    REST --> DB
    REST --> Storage
    WS --> DB
    
    %% WebRTC Connection
    Web <.->|WebRTC P2P (Video/Audio)| Web
    Desktop <.->|WebRTC P2P (Video/Audio)| Mobile
```

---

## 🚀 Quick Start Guide

### 1. Start the Backend
The backend runs on Python 3.10+ and uses FastAPI.
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

### 2. Start the Frontend Web App
The frontend is built on Next.js 14 and TailwindCSS.
```bash
cd frontend
npm install
npm run dev
```
Navigate to `http://localhost:3005` in your browser.

### 3. Run Native Wrappers
- **Windows Desktop:** `npm run electron`
- **Android App:** `npx cap sync android` -> `npx cap open android`

---

## 🗄️ Repository Structure
- `/backend` - FastAPI server, SQLAlchemy models, WebSockets, and AI endpoints.
- `/frontend` - Next.js React application, TailwindCSS styling, and native wrapper configurations.
- `/archive_v1` - Legacy Python TCP socket implementations (V1).
- `/docs` - Extensive project documentation and deployment guides.
