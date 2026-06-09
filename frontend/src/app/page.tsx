"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Lock, Globe, User as UserIcon, LogOut, Shield, Search, UserPlus } from "lucide-react";

export default function ChatApp() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [chatMode, setChatMode] = useState<"broadcast" | "direct">("broadcast");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Profile settings state
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  
  const ws = useRef<WebSocket | null>(null);

  // Fetch all users periodically or on load
  const fetchOnlineUsers = async () => {
    try {
      const res = await fetch("http://localhost:8000/users");
      if (res.ok) {
        const users = await res.json();
        setOnlineUsers(users.map((u: any) => u.username).filter((u: string) => u !== username));
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (isLoggedIn && token) {
      // Connect WebSocket
      const socket = new WebSocket(`ws://localhost:8000/ws?token=${token}`);
      
      socket.onopen = () => {
        console.log("WebSocket connected");
        fetchOnlineUsers();
      };
      
      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "system") {
          fetchOnlineUsers(); // Refresh users list when someone joins/leaves
          setMessages(prev => [...prev, {
            id: Date.now(),
            sender: "System",
            content: data.content,
            type: "system",
            timestamp: new Date().toLocaleTimeString()
          }]);
        } else if (data.type === "message") {
          setMessages(prev => [...prev, {
            id: data.id,
            sender: data.sender_username,
            content: data.content,
            type: data.recipient_id ? "direct" : "broadcast",
            recipient: data.recipient_id ? (data.sender_username === username ? selectedUser : data.sender_username) : null,
            timestamp: new Date(data.timestamp).toLocaleTimeString()
          }]);
        }
      };
      
      socket.onclose = () => {
        console.log("WebSocket disconnected");
        setMessages(prev => [...prev, {
          id: Date.now(),
          sender: "System",
          content: "Connection to server lost.",
          type: "system",
          timestamp: new Date().toLocaleTimeString()
        }]);
      };
      
      ws.current = socket;
      
      return () => {
        socket.close();
      };
    }
  }, [isLoggedIn, token]);

  // Filter users based on search
  const filteredUsers = onlineUsers.filter(user => 
    user.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const startNewChat = () => {
    if (searchQuery.trim() && !onlineUsers.includes(searchQuery.toLowerCase())) {
      setOnlineUsers([...onlineUsers, searchQuery.toLowerCase()]);
      setSelectedUser(searchQuery.toLowerCase());
      setChatMode("direct");
      setSearchQuery("");
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (username.length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }
    setError("");

    try {
      const regRes = await fetch("http://localhost:8000/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          username, 
          password,
          email: email || undefined,
          phone_number: phoneNumber || undefined
        })
      });
      
      if (!regRes.ok) {
        setError("Invalid credentials or username already taken.");
        return;
      }
      
      // Auto-login after register
      handleLogin(e);
    } catch (err) {
      setError("Cannot connect to server.");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (username.length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }
    setError("");

    try {
      // Try logging in
      const formData = new URLSearchParams();
      formData.append("username", username);
      formData.append("password", password);
      
      let res = await fetch("http://localhost:8000/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData
      });

      if (!res.ok) {
        setError("Invalid username or password.");
        return;
      }

      const data = await res.json();
      setToken(data.access_token);
      
      // Get user info to get ID
      const userRes = await fetch("http://localhost:8000/users/me", {
        headers: { "Authorization": `Bearer ${data.access_token}` }
      });
      const userData = await userRes.json();
      setUserId(userData.id);
      setCurrentUser(userData);
      setProfileEmail(userData.email || "");
      setProfilePhone(userData.phone_number || "");

      setIsLoggedIn(true);
      setMessages([
        { id: 1, sender: "System", content: "Welcome to Secure Business Chat! 🔒", type: "system", timestamp: new Date().toLocaleTimeString() }
      ]);
    } catch (err) {
      setError("Cannot connect to server.");
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !ws.current || ws.current.readyState !== WebSocket.OPEN) return;

    let recipient_id = null;
    if (chatMode === "direct" && selectedUser) {
      // Find recipient ID by fetching all users and matching username
      const res = await fetch("http://localhost:8000/users");
      const users = await res.json();
      const target = users.find((u: any) => u.username === selectedUser);
      if (target) recipient_id = target.id;
    }

    const messagePayload = {
      content: inputMessage,
      recipient_id: recipient_id
    };

    ws.current.send(JSON.stringify(messagePayload));
    
    // Optimistically add the message to the UI if it's a direct message
    // (Broadcast messages are echoed back by the server)
    if (chatMode === "direct") {
      setMessages(prev => [...prev, {
        id: Date.now(),
        sender: username,
        content: inputMessage,
        type: "direct",
        recipient: selectedUser,
        timestamp: new Date().toLocaleTimeString()
      }]);
    }
    
    setInputMessage("");
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    try {
      // 1. Save text details
      await fetch("http://localhost:8000/users/me", {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email: profileEmail || null, phone_number: profilePhone || null })
      });

      // 2. Upload avatar if selected
      if (avatarFile) {
        const formData = new FormData();
        formData.append("file", avatarFile);
        await fetch("http://localhost:8000/users/me/avatar", {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}` },
          body: formData
        });
      }

      // 3. Refresh user data
      const userRes = await fetch("http://localhost:8000/users/me", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const userData = await userRes.json();
      setCurrentUser(userData);
      setShowProfileModal(false);
    } catch (err) {
      console.error(err);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[url('https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center">
        <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm z-0"></div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="z-10 w-full max-w-md p-8 rounded-2xl bg-slate-800/60 backdrop-blur-xl border border-slate-700 shadow-2xl"
        >
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/20 text-blue-400 mb-4">
              <Shield size={32} />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">{authMode === "login" ? "Sign In" : "Create Account"}</h1>
            <p className="text-slate-400">Enterprise-grade encrypted messaging</p>
          </div>

          <form onSubmit={authMode === "login" ? handleLogin : handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Username</label>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                placeholder="Enter your username"
              />
            </div>
            
            <AnimatePresence mode="popLayout">
              {authMode === "register" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 overflow-hidden"
                >
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Email <span className="text-slate-500 font-normal">(Optional)</span></label>
                    <input 
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      placeholder="john@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Phone <span className="text-slate-500 font-normal">(Optional)</span></label>
                    <input 
                      type="tel" 
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                placeholder="••••••••"
              />
            </div>
            
            <AnimatePresence>
              {error && (
                <motion.p 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-red-400 text-sm text-center pt-2"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-lg transition-all shadow-lg shadow-blue-500/30 active:scale-[0.98] mt-4"
            >
              {authMode === "login" ? "Sign In" : "Register"}
            </button>

            <div className="text-center mt-6 border-t border-slate-700 pt-6">
              <p className="text-slate-400 text-sm">
                {authMode === "login" ? "Don't have an account?" : "Already have an account?"}
              </p>
              <button
                type="button"
                onClick={() => {
                  setAuthMode(authMode === "login" ? "register" : "login");
                  setError("");
                }}
                className="text-blue-400 hover:text-blue-300 font-medium mt-2 transition-colors"
              >
                {authMode === "login" ? "Create a new account" : "Sign in instead"}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-900 text-white overflow-hidden selection:bg-blue-500/30">
      {/* Sidebar */}
      <div className="w-72 flex flex-col bg-slate-800/40 backdrop-blur-md border-r border-slate-700/50 z-10">
        <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer hover:bg-slate-700/50 p-2 rounded-lg transition-colors -ml-2" onClick={() => setShowProfileModal(true)}>
            {currentUser?.avatar_url ? (
              <img src={`http://localhost:8000${currentUser.avatar_url}`} alt="Avatar" className="w-10 h-10 rounded-full object-cover shadow-lg shadow-blue-500/20 border border-slate-600" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center font-bold shadow-lg shadow-blue-500/20">
                {username.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h3 className="font-semibold">{username}</h3>
              <p className="text-xs text-green-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-400"></span> Online
              </p>
            </div>
          </div>
          <button onClick={() => setIsLoggedIn(false)} className="p-2 text-slate-400 hover:text-white transition-colors">
            <LogOut size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Channels</h4>
            <button 
              onClick={() => { setChatMode("broadcast"); setSelectedUser(null); }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${chatMode === "broadcast" ? "bg-blue-500/20 text-blue-400" : "hover:bg-slate-700/50 text-slate-300"}`}
            >
              <Globe size={18} />
              <span>Global Broadcast</span>
            </button>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center justify-between">
              <span>Direct Messages</span>
              <span className="bg-slate-700 text-xs px-2 py-0.5 rounded-full">{onlineUsers.length}</span>
            </h4>
            
            {/* Search Bar */}
            <div className="relative mb-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input 
                type="text" 
                placeholder="Search users..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && startNewChat()}
                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder-slate-500"
              />
            </div>

            <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
              {filteredUsers.length > 0 ? (
                filteredUsers.map(user => (
                  <button 
                    key={user}
                    onClick={() => { setChatMode("direct"); setSelectedUser(user); }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${chatMode === "direct" && selectedUser === user ? "bg-indigo-500/20 text-indigo-400" : "hover:bg-slate-700/50 text-slate-300"}`}
                  >
                    <div className="relative">
                      <UserIcon size={18} />
                      <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border border-slate-900"></span>
                    </div>
                    <span className="truncate">{user}</span>
                    {chatMode === "direct" && selectedUser === user && <Lock size={12} className="ml-auto opacity-50 flex-shrink-0" />}
                  </button>
                ))
              ) : (
                <div className="text-center py-4">
                  <p className="text-xs text-slate-500 mb-2">No users found</p>
                  {searchQuery && (
                    <button 
                      onClick={startNewChat}
                      className="text-xs flex items-center justify-center gap-1 w-full bg-slate-700/50 hover:bg-slate-700 text-blue-400 py-1.5 rounded-md transition-colors"
                    >
                      <UserPlus size={12} /> Message "{searchQuery}"
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative">
        {/* Background elements */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none"></div>

        {/* Chat Header */}
        <div className="h-16 px-6 border-b border-slate-700/50 flex items-center justify-between bg-slate-900/50 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            {chatMode === "broadcast" ? (
              <>
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                  <Globe size={20} />
                </div>
                <div>
                  <h2 className="font-semibold text-lg">Global Broadcast</h2>
                  <p className="text-xs text-slate-400">Messages are visible to everyone</p>
                </div>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center relative">
                  <UserIcon size={20} />
                  <Lock size={10} className="absolute bottom-2 right-2 text-indigo-300" />
                </div>
                <div>
                  <h2 className="font-semibold text-lg">{selectedUser}</h2>
                  <p className="text-xs text-indigo-400 flex items-center gap-1">
                    <Lock size={10} /> End-to-End Encrypted
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 z-10">
          <AnimatePresence>
            {messages.filter(m => 
              m.type === "system" || 
              (chatMode === "broadcast" && m.type === "broadcast") ||
              (chatMode === "direct" && m.type === "direct" && (m.recipient === selectedUser || m.sender === selectedUser))
            ).map((msg) => (
              <motion.div 
                key={msg.id}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={`flex ${msg.type === "system" ? "justify-center" : msg.sender === username ? "justify-end" : "justify-start"}`}
              >
                {msg.type === "system" ? (
                  <div className="bg-slate-800/80 px-4 py-1.5 rounded-full text-xs text-slate-400 border border-slate-700">
                    {msg.content}
                  </div>
                ) : (
                  <div className={`max-w-[70%] ${msg.sender === username ? "items-end" : "items-start"} flex flex-col gap-1`}>
                    <div className="flex items-baseline gap-2 mx-1">
                      <span className="text-xs font-medium text-slate-400">{msg.sender === username ? "You" : msg.sender}</span>
                      <span className="text-[10px] text-slate-500">{msg.timestamp}</span>
                    </div>
                    <div className={`px-4 py-2.5 rounded-2xl shadow-sm ${
                      msg.sender === username 
                        ? msg.type === "direct" 
                          ? "bg-indigo-600 text-white rounded-tr-sm" 
                          : "bg-blue-600 text-white rounded-tr-sm" 
                        : "bg-slate-800 text-slate-100 rounded-tl-sm border border-slate-700"
                    }`}>
                      <p className="text-sm">{msg.content}</p>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Message Input */}
        <div className="p-4 bg-slate-900/80 backdrop-blur-md z-10 border-t border-slate-800">
          <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto relative flex items-end gap-2 bg-slate-800/50 border border-slate-700 p-2 rounded-2xl focus-within:ring-2 focus-within:ring-blue-500/50 transition-all">
            <textarea 
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
              placeholder={chatMode === "broadcast" ? "Message everyone..." : `Message ${selectedUser}...`}
              className="flex-1 bg-transparent border-none text-white placeholder-slate-400 resize-none max-h-32 min-h-[44px] py-3 px-4 focus:outline-none text-sm"
              rows={1}
            />
            <button 
              type="submit"
              disabled={!inputMessage.trim()}
              className={`p-3 rounded-xl transition-all flex-shrink-0 mb-0.5 ${
                inputMessage.trim() 
                  ? "bg-blue-600 text-white hover:bg-blue-500 shadow-md shadow-blue-500/20" 
                  : "bg-slate-700/50 text-slate-500"
              }`}
            >
              <Send size={18} className={inputMessage.trim() ? "translate-x-0.5" : ""} />
            </button>
          </form>
          <div className="text-center mt-2">
            <span className="text-[10px] text-slate-500 flex items-center justify-center gap-1">
              <Lock size={10} /> 
              {chatMode === "direct" ? "Messages are end-to-end encrypted." : "Messages are secured with TLS transport encryption."}
            </span>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showProfileModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setShowProfileModal(false)}></div>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl z-10"
            >
              <h2 className="text-xl font-bold mb-4">Edit Profile</h2>
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="flex justify-center mb-4">
                  <label className="cursor-pointer group relative">
                    {avatarPreview || currentUser?.avatar_url ? (
                      <img src={avatarPreview || `http://localhost:8000${currentUser.avatar_url}`} alt="Avatar" className="w-20 h-20 rounded-full object-cover border-2 border-blue-500" />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center text-2xl font-bold border-2 border-blue-500">
                        {username.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-xs font-medium text-white">Upload</span>
                    </div>
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setAvatarFile(file);
                        setAvatarPreview(URL.createObjectURL(file));
                      }
                    }} />
                  </label>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
                  <input type="email" value={profileEmail} onChange={(e) => setProfileEmail(e.target.value)} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Phone Number</label>
                  <input type="tel" value={profilePhone} onChange={(e) => setProfilePhone(e.target.value)} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button type="button" onClick={() => setShowProfileModal(false)} className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors">Cancel</button>
                  <button type="submit" className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 transition-colors">Save Changes</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
