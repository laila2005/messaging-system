"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Globe, LogOut, Shield, Search, Smile, Paperclip, Mic, ArrowLeft, Phone, Video, PhoneOff, VideoOff, MicOff, PhoneCall, Sparkles, Play, Pause } from "lucide-react";


const AudioPlayer = ({ src }: { src: string }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) audioRef.current.pause();
      else audioRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };
  
  return (
    <div className="flex items-center gap-3 bg-[#1E1E1E] border border-white/10 rounded-full py-2 px-4 mb-2 w-max shadow-md">
      <button onClick={togglePlay} className="w-8 h-8 flex items-center justify-center rounded-full bg-purple-600 text-white hover:bg-purple-500 transition-colors">
        {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
      </button>
      <div className="flex items-center gap-1">
        <div className="w-1 h-3 bg-white/40 rounded-full animate-pulse"></div>
        <div className="w-1 h-5 bg-purple-500/60 rounded-full animate-pulse" style={{ animationDelay: '0.1s' }}></div>
        <div className="w-1 h-4 bg-white/40 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
        <div className="w-1 h-6 bg-purple-500/80 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }}></div>
        <div className="w-1 h-4 bg-white/40 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
        <div className="w-1 h-3 bg-white/40 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
      </div>
      <span className="text-xs font-medium text-white/70 ml-2">Voice Note</span>
      <audio ref={audioRef} src={src} onEnded={() => setIsPlaying(false)} />
    </div>
  );
};

export default function ChatApp() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8000";
  const WS_URL = API_URL.replace("http", "ws");

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [chatMode, setChatMode] = useState<"none" | "broadcast" | "direct">("none");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [systemAlert, setSystemAlert] = useState<string | null>(null);
  
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [smartReplies, setSmartReplies] = useState<string[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingSentRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Emojis & Recording
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojis = ["👍", "❤️", "😂", "🔥", "🎉", "😮", "😢", "👏", "🙌", "🤔"];
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Profile settings state
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // WebRTC Call State
  const [isCalling, setIsCalling] = useState(false);
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  
  const ws = useRef<WebSocket | null>(null);
  const pc = useRef<RTCPeerConnection | null>(null);
  const iceCandidatesQueue = useRef<RTCIceCandidateInit[]>([]);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const rtcConfig = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

  const fetchOnlineUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/users`);
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
      const socket = new WebSocket(`${WS_URL}/ws?token=${token}`);
      
      socket.onopen = () => fetchOnlineUsers();
      
      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "system") {
          fetchOnlineUsers();
          setSystemAlert(data.content);
          setTimeout(() => setSystemAlert(null), 5000);
        } else if (data.type === "message") {
          setMessages(prev => {
            if (prev.some(m => m.id === data.id)) return prev;
            return [...prev, {
              id: data.id, sender: data.sender_username, content: data.content,
              type: data.recipient_id ? "direct" : "broadcast", recipient: data.recipient_username,
              attachment_url: data.attachment_url,
              timestamp: new Date(data.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
            }];
          });
        } else if (data.type === "typing") {
          if (chatMode === "direct" && selectedUser === data.sender_username) {
            setTypingUser(data.sender_username);
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => setTypingUser(null), 3000);
          }
        } else if (data.type === "webrtc_offer") {
          setIncomingCall({ sender: data.sender_username, senderId: data.sender_id, offer: data.payload, withVideo: data.withVideo });
        } else if (data.type === "webrtc_answer") {
          if (pc.current) {
            pc.current.setRemoteDescription(new RTCSessionDescription(data.payload)).then(() => {
              while (iceCandidatesQueue.current.length > 0) {
                pc.current?.addIceCandidate(new RTCIceCandidate(iceCandidatesQueue.current.shift()!));
              }
            });
          }
        } else if (data.type === "webrtc_ice") {
          if (pc.current && pc.current.remoteDescription) {
            pc.current.addIceCandidate(new RTCIceCandidate(data.payload));
          } else {
            iceCandidatesQueue.current.push(data.payload);
          }
        }
      };
      
      socket.onclose = () => {
        setSystemAlert("Connection to server lost. Reconnecting...");
      };
      
      ws.current = socket;
      return () => socket.close();
    }
  }, [isLoggedIn, token]);

  const fetchChatHistory = async (targetUser: string | null) => {
    if (!token) return;
    try {
      let url = `${API_URL}/messages`;
      if (targetUser) url += `?target_username=${encodeURIComponent(targetUser)}`;
      const res = await fetch(url, { headers: { "Authorization": `Bearer ${token}` } });
      if (res.ok) {
        const history = await res.json();
        const formatted = history.map((data: any) => ({
          id: data.id, sender: data.sender_username, content: data.content,
          type: data.recipient_id ? "direct" : "broadcast", recipient: data.recipient_username,
          attachment_url: data.attachment_url,
          timestamp: new Date(data.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
        }));
        setMessages(formatted);
      }
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (chatMode === "broadcast") fetchChatHistory(null);
    else if (chatMode === "direct" && selectedUser) fetchChatHistory(selectedUser);
  }, [chatMode, selectedUser, token]);

  const fetchSmartReplies = async (contextMsgs: any[]) => {
    if (!token) return;
    const msgsContent = contextMsgs.map(m => m.content).filter(Boolean).slice(-5);
    try {
      const res = await fetch(`${API_URL}/ai/smart-replies`, {
         method: "POST", headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
         body: JSON.stringify({ messages: msgsContent })
      });
      if (res.ok) {
         const data = await res.json();
         setSmartReplies(data.replies);
      }
    } catch(e) {}
  };

  useEffect(() => {
    const activeMsgs = messages.filter(m => (chatMode === "direct" && m.type === "direct" && (m.recipient === selectedUser || m.sender === selectedUser)));
    if (activeMsgs.length > 0) {
      const lastMsg = activeMsgs[activeMsgs.length - 1];
      if (lastMsg.sender === selectedUser) fetchSmartReplies(activeMsgs);
      else setSmartReplies([]);
    } else { setSmartReplies([]); }
  }, [messages, chatMode, selectedUser]);

  useEffect(() => {
    if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream;
  }, [localStream, isCalling]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) remoteVideoRef.current.srcObject = remoteStream;
  }, [remoteStream, isCalling]);

  const filteredUsers = onlineUsers.filter(user => user.toLowerCase().includes(searchQuery.toLowerCase()));

  const startNewChat = () => {
    if (searchQuery.trim() && !onlineUsers.includes(searchQuery.toLowerCase())) {
      setOnlineUsers([...onlineUsers, searchQuery.toLowerCase()]);
      setSelectedUser(searchQuery.toLowerCase());
      setChatMode("direct");
      setSearchQuery("");
    }
  };

  const getUserId = async (uname: string) => {
    const res = await fetch(`${API_URL}/users`);
    const users = await res.json();
    return users.find((u: any) => u.username === uname)?.id;
  };

  const startCall = async (withVideo: boolean) => {
    if (!selectedUser) return;
    const targetId = await getUserId(selectedUser);
    if (!targetId) return;

    setIsCalling(true);
    const stream = await navigator.mediaDevices.getUserMedia({ video: withVideo, audio: true });
    setLocalStream(stream);

    const peer = new RTCPeerConnection(rtcConfig);
    pc.current = peer;

    stream.getTracks().forEach(track => peer.addTrack(track, stream));
    peer.ontrack = (event) => setRemoteStream(event.streams[0]);

    peer.onicecandidate = (event) => {
      if (event.candidate && ws.current) {
        ws.current.send(JSON.stringify({ type: "webrtc_ice", recipient_id: targetId, payload: event.candidate }));
      }
    };

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    ws.current?.send(JSON.stringify({ type: "webrtc_offer", recipient_id: targetId, payload: offer, withVideo: withVideo }));
  };

  const acceptCall = async () => {
    if (!incomingCall) return;
    setIsCalling(true);
    
    const stream = await navigator.mediaDevices.getUserMedia({ video: incomingCall.withVideo ?? true, audio: true });
    setLocalStream(stream);

    const peer = new RTCPeerConnection(rtcConfig);
    pc.current = peer;

    stream.getTracks().forEach(track => peer.addTrack(track, stream));
    peer.ontrack = (event) => setRemoteStream(event.streams[0]);

    peer.onicecandidate = (event) => {
      if (event.candidate && ws.current) {
        ws.current.send(JSON.stringify({ type: "webrtc_ice", recipient_id: incomingCall.senderId, payload: event.candidate }));
      }
    };

    await peer.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
    while (iceCandidatesQueue.current.length > 0) {
      peer.addIceCandidate(new RTCIceCandidate(iceCandidatesQueue.current.shift()!));
    }
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);

    ws.current?.send(JSON.stringify({ type: "webrtc_answer", recipient_id: incomingCall.senderId, payload: answer }));
    setIncomingCall(null);
  };

  const endCall = () => {
    if (pc.current) { pc.current.close(); pc.current = null; }
    if (localStream) { localStream.getTracks().forEach(t => t.stop()); setLocalStream(null); }
    setRemoteStream(null);
    setIsCalling(false);
    setIncomingCall(null);
    iceCandidatesQueue.current = [];
  };

  const toggleAudio = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(t => t.enabled = !t.enabled);
      setIsAudioMuted(!isAudioMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(t => t.enabled = !t.enabled);
      setIsVideoMuted(!isVideoMuted);
    }
  };

  const toggleRecording = async () => {
    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      return;
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], "voice_message.webm", { type: 'audio/webm' });
        setAttachmentFile(audioFile);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setIsRecording(true);
    } catch (e) {
      console.error("Microphone access denied", e);
      setSystemAlert("Microphone permission denied.");
      setTimeout(() => setSystemAlert(null), 3000);
    }
  };

  const handleInput = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputMessage(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
    
    if (chatMode === "direct" && selectedUser && ws.current) {
      const now = Date.now();
      if (now - lastTypingSentRef.current > 2000) {
        lastTypingSentRef.current = now;
        const targetId = await getUserId(selectedUser);
        ws.current.send(JSON.stringify({ type: "typing", recipient_id: targetId }));
      }
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (username.length < 3) return setError("Username must be at least 3 characters");
    setError("");
    try {
      const regRes = await fetch(`${API_URL}/register`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, email: email || undefined, phone_number: phoneNumber || undefined })
      });
      if (!regRes.ok) {
        try {
          const errorData = await regRes.json();
          return setError(errorData.detail || "Invalid credentials or username already taken.");
        } catch {
          return setError("Server error or connection failed");
        }
      }
      handleLogin(e);
    } catch (err) { setError("Cannot connect to server."); }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (username.length < 3) return setError("Username must be at least 3 characters");
    setError("");
    try {
      const formData = new URLSearchParams();
      formData.append("username", username);
      formData.append("password", password);
      let res = await fetch(`${API_URL}/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: formData });
      if (!res.ok) {
        try {
          const errorData = await res.json();
          return setError(errorData.detail || "Invalid username or password.");
        } catch {
          return setError("Server error or connection failed");
        }
      }
      const data = await res.json();
      setToken(data.access_token);
      const userRes = await fetch(`${API_URL}/users/me`, { headers: { "Authorization": `Bearer ${data.access_token}` } });
      const userData = await userRes.json();
      setUserId(userData.id); setCurrentUser(userData); setProfileEmail(userData.email || ""); setProfilePhone(userData.phone_number || "");
      setIsLoggedIn(true);
    } catch (err) { setError("Cannot connect to server."); }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputMessage.trim() && !attachmentFile) || !ws.current || ws.current.readyState !== WebSocket.OPEN) return;
    
    let recipient_id = null;
    if (chatMode === "direct" && selectedUser) {
      recipient_id = await getUserId(selectedUser);
    }

    let attachment_url = null;
    if (attachmentFile && token) {
      const formData = new FormData();
      formData.append("file", attachmentFile);
      try {
        const uploadRes = await fetch(`${API_URL}/messages/attachment`, {
          method: "POST", headers: { "Authorization": `Bearer ${token}` }, body: formData
        });
        if (uploadRes.ok) {
          const data = await uploadRes.json();
          attachment_url = data.attachment_url;
        }
      } catch (err) { console.error(err); }
    }

    ws.current.send(JSON.stringify({ content: inputMessage, recipient_id: recipient_id, attachment_url: attachment_url }));
    setInputMessage("");
    setAttachmentFile(null);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const parseMarkdown = (text: string) => {
    if (!text) return text;
    let htmlText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    htmlText = htmlText.replace(/\*(.*?)\*/g, '<em>$1</em>');
    htmlText = htmlText.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" class="text-blue-400 underline hover:text-blue-300">$1</a>');
    return <span dangerouslySetInnerHTML={{ __html: htmlText }} />;
  };

  const renderAttachment = (url: string) => {
    if (!url) return null;
    const isImage = url.match(/\.(jpeg|jpg|gif|png|webp)$/i);
    const isAudio = url.match(/\.(webm|mp3|wav|ogg)$/i);
    if (isImage) return <img src={`${API_URL}${url}`} alt="attachment" className="max-w-[250px] rounded-xl mb-2 border border-white/10 shadow-md" />;
    if (isAudio) return <AudioPlayer src={`${API_URL}${url}`} />;
    return <a href={`${API_URL}${url}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-white/10 p-3 rounded-xl mb-2 text-sm hover:bg-white/20 transition-colors w-max"><Paperclip size={16} /> Download File</a>;
  };

  const handleSummarize = async () => {
    if (!token) return;
    try {
      const msgsToSummarize = messages.filter(m => 
        (chatMode === "broadcast" && m.type === "broadcast") || 
        (chatMode === "direct" && m.type === "direct" && (m.recipient === selectedUser || m.sender === selectedUser))
      ).map(m => m.content).filter(Boolean);
      
      const res = await fetch(`${API_URL}/ai/summarize`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messages: msgsToSummarize })
      });
      if (res.ok) {
        const data = await res.json();
        setSystemAlert(`AI Summary: ${data.summary}`);
        setTimeout(() => setSystemAlert(null), 8000);
      }
    } catch (e) { console.error(e); }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      await fetch(`${API_URL}/users/me`, {
        method: "PUT", headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email: profileEmail || null, phone_number: profilePhone || null })
      });
      if (avatarFile) {
        const formData = new FormData();
        formData.append("file", avatarFile);
        await fetch(`${API_URL}/users/me/avatar`, { method: "POST", headers: { "Authorization": `Bearer ${token}` }, body: formData });
      }
      const userRes = await fetch(`${API_URL}/users/me`, { headers: { "Authorization": `Bearer ${token}` } });
      const userData = await userRes.json();
      setCurrentUser(userData);
      setShowProfileModal(false);
    } catch (err) { console.error(err); }
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-[100dvh] flex items-start md:items-center justify-center p-4 py-12 md:py-4 bg-[#121212] overflow-y-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-[#1E1E1E] w-full max-w-md p-8 rounded-3xl shadow-2xl relative overflow-hidden border border-white/5">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-primary"></div>
          <div className="text-center mb-8">
            <img src="/logo.png" alt="Zagel" className="w-24 h-24 mx-auto mb-4 object-contain drop-shadow-[0_0_15px_rgba(168,85,247,0.4)]" />
            <h1 className="text-3xl font-bold text-white mb-2">{authMode === "login" ? "Sign In" : "Create Account"}</h1>
            <p className="text-white/50">Enterprise-grade encrypted messaging</p>
          </div>
          <form onSubmit={authMode === "login" ? handleLogin : handleRegister} className="space-y-4">
            <div><label className="block text-sm font-medium text-white/70 mb-1.5">Username</label><input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-white/20 focus:outline-none transition-colors" placeholder="Enter your username" /></div>
            <AnimatePresence mode="popLayout">
              {authMode === "register" && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-4 overflow-hidden">
                  <div><label className="block text-sm font-medium text-white/70 mb-1.5">Email <span className="text-white/30">(Optional)</span></label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-white/20 focus:outline-none transition-colors" placeholder="john@example.com" /></div>
                  <div><label className="block text-sm font-medium text-white/70 mb-1.5">Phone <span className="text-white/30">(Optional)</span></label><input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-white/20 focus:outline-none transition-colors" placeholder="+1 (555) 000-0000" /></div>
                </motion.div>
              )}
            </AnimatePresence>
            <div><label className="block text-sm font-medium text-white/70 mb-1.5">Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-white/20 focus:outline-none transition-colors" placeholder="••••••••" /></div>
            <AnimatePresence>{error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-pink-400 text-sm text-center pt-2">{error}</motion.p>}</AnimatePresence>
            <button type="submit" className="w-full bg-gradient-primary glow-primary text-white font-medium py-3 rounded-xl active:scale-[0.98] mt-4">{authMode === "login" ? "Sign In" : "Register"}</button>
            <div className="text-center mt-6 border-t border-white/10 pt-6"><button type="button" onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setError(""); }} className="text-white/70 hover:text-white font-medium mt-2">{authMode === "login" ? "Create a new account" : "Sign in instead"}</button></div>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] w-full bg-[#121212] text-white overflow-hidden selection:bg-purple-500/30">
      
      {/* System Alert Banner */}
      <AnimatePresence>
        {systemAlert && (
          <motion.div initial={{ y: -50 }} animate={{ y: 0 }} exit={{ y: -50 }} className="absolute top-0 left-0 w-full bg-purple-600 text-white text-sm font-medium py-2 px-4 text-center z-[100] shadow-lg">
            {systemAlert}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar: Shows full width on mobile if no chat is selected, hidden otherwise */}
      <div className={`w-full md:w-80 h-full flex flex-col border-r border-white/5 bg-[#1E1E1E] z-40 shrink-0 ${chatMode !== "none" ? "hidden md:flex" : "flex"}`}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-8"><div className="flex items-center gap-3"><img src="/logo.png" alt="Zagel" className="w-8 h-8 object-contain drop-shadow-md" /><h2 className="text-xl font-bold tracking-wide">Zagel</h2></div></div>
          <div className="relative mb-6"><Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" /><input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && startNewChat()} className="w-full bg-[#121212] border border-white/5 rounded-full pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-white/20 transition-colors" /></div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1 custom-scrollbar">
          <button onClick={() => { setChatMode("broadcast"); setSelectedUser(null); }} className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all ${chatMode === "broadcast" ? "bg-white/5 shadow-[inset_4px_0_0_0_rgba(168,85,247,1)]" : "hover:bg-white/5"}`}><div className="w-10 h-10 rounded-full bg-[#121212] border border-white/10 text-white/70 flex items-center justify-center"><Globe size={20} /></div><div className="flex flex-col items-start"><span className="font-semibold text-[15px]">Global Room</span><span className="text-xs text-white/40">Public Broadcast</span></div></button>
          {filteredUsers.map(user => (
            <button key={user} onClick={() => { setChatMode("direct"); setSelectedUser(user); }} className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all relative ${chatMode === "direct" && selectedUser === user ? "bg-white/5 shadow-[inset_4px_0_0_0_rgba(168,85,247,1)]" : "hover:bg-white/5"}`}><div className="relative"><div className="w-10 h-10 rounded-full bg-[#121212] border border-white/10 flex items-center justify-center font-bold text-lg text-white/80">{user.charAt(0).toUpperCase()}</div><span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#0f1123] shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span></div><div className="flex flex-col items-start flex-1 overflow-hidden"><span className="font-semibold text-[15px] truncate w-full text-left">{user}</span><span className="text-xs text-green-400">online</span></div></button>
          ))}
        </div>
        <div className="p-4 border-t border-white/5"><div className="flex items-center gap-3 cursor-pointer hover:bg-white/5 p-3 rounded-2xl transition-colors" onClick={() => setShowProfileModal(true)}>{currentUser?.avatar_url ? (<img src={`${API_URL}${currentUser.avatar_url}`} alt="Avatar" className="w-10 h-10 rounded-full object-cover border border-white/10 shadow-md" />) : (<div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center font-bold">{username.charAt(0).toUpperCase()}</div>)}<div className="flex-1 overflow-hidden"><h3 className="font-semibold truncate text-[15px]">{username}</h3><p className="text-xs text-white/40">Edit Profile</p></div><button onClick={(e) => { e.stopPropagation(); setIsLoggedIn(false); }} className="w-11 h-11 flex items-center justify-center text-white/40 hover:text-white transition-colors rounded-full hover:bg-white/10"><LogOut size={18} /></button></div></div>
      </div>

      {/* Main Area: Empty State OR Chat View */}
      {chatMode === "none" ? (
        <div className="hidden md:flex flex-1 items-center justify-center bg-[#121212]">
          <div className="text-center opacity-30">
            <img src="/logo.png" alt="Zagel" className="w-28 h-28 mx-auto mb-6 object-contain opacity-50 drop-shadow-lg" />
            <h2 className="text-3xl font-bold mb-2 tracking-tight">Zagel Messaging</h2>
            <p className="text-lg">Select a user or room to start messaging</p>
          </div>
        </div>
      ) : (
        <div className={`flex-1 flex flex-col h-full bg-[#121212] relative z-0 flex`}>
          <div className="h-[88px] px-4 md:px-6 border-b border-white/5 flex items-center justify-between bg-[#1E1E1E]">
            <div className="flex items-center gap-2 md:gap-4">
              <button className="md:hidden w-11 h-11 flex items-center justify-center text-white/70 hover:text-white rounded-full hover:bg-white/5" onClick={() => setChatMode("none")}><ArrowLeft size={24} /></button>
              {chatMode === "broadcast" ? (<div><h2 className="font-bold text-lg tracking-wide">Global Broadcast</h2><p className="text-xs text-white/40">Everyone can see these messages</p></div>) : (<div className="flex items-center gap-3"><div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-[#121212] border border-white/10 flex items-center justify-center font-bold text-xl text-white/90">{selectedUser?.charAt(0).toUpperCase()}</div><div><h2 className="font-bold text-lg tracking-wide">{selectedUser}</h2><p className="text-xs text-purple-400 flex items-center gap-1"><Lock size={12} /> End-to-End Encrypted</p></div></div>)}
            </div>
            <div className="flex items-center gap-2 text-white/40">
              <button onClick={handleSummarize} className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-white/5 text-purple-400 hover:text-purple-300 transition-colors" title="Summarize Chat"><Sparkles size={20} /></button>
              {chatMode === "direct" && (
                <div className="flex items-center gap-1 mr-2">
                  <button onClick={() => startCall(false)} className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-white/5 text-white/70 hover:text-white transition-colors"><Phone size={20} /></button>
                  <button onClick={() => startCall(true)} className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-white/5 text-white/70 hover:text-white transition-colors"><Video size={20} /></button>
                </div>
              )}
              <div className="w-11 h-11 flex items-center justify-center cursor-pointer hover:bg-white/5 rounded-full hover:text-white"><Search size={20} /></div>
            </div>
          </div>

          {/* Active Call Split View */}
          {isCalling && (
            <div className="h-[40%] min-h-[250px] border-b border-white/10 relative bg-black flex items-center justify-center overflow-hidden shrink-0 shadow-2xl">
              <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
              <div className="absolute bottom-4 right-4 w-28 h-40 md:w-40 md:h-56 bg-black rounded-xl overflow-hidden border border-white/20 shadow-2xl">
                 <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1]" />
              </div>
              <div className="absolute top-4 right-4 flex gap-3 z-10">
                 <button onClick={toggleAudio} className={`w-12 h-12 flex items-center justify-center rounded-full backdrop-blur-md shadow-lg transition-colors ${isAudioMuted ? 'bg-white text-black' : 'bg-black/50 text-white hover:bg-black/70'}`}>{isAudioMuted ? <MicOff size={20} /> : <Mic size={20} />}</button>
                 <button onClick={toggleVideo} className={`w-12 h-12 flex items-center justify-center rounded-full backdrop-blur-md shadow-lg transition-colors ${isVideoMuted ? 'bg-white text-black' : 'bg-black/50 text-white hover:bg-black/70'}`}>{isVideoMuted ? <VideoOff size={20} /> : <Video size={20} />}</button>
                 <button onClick={endCall} className="w-12 h-12 flex items-center justify-center rounded-full bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)] hover:bg-red-600 transition-colors"><PhoneOff size={20} /></button>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 custom-scrollbar">
            <AnimatePresence>
              {messages.filter(m => (chatMode === "broadcast" && m.type === "broadcast") || (chatMode === "direct" && m.type === "direct" && (m.recipient === selectedUser || m.sender === selectedUser))).map((msg) => (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className={`flex ${msg.sender === username ? "justify-end" : "justify-start"}`}>
                  <div className={`flex gap-3 max-w-[85%] md:max-w-[70%] ${msg.sender === username ? "flex-row-reverse" : "flex-row"}`}>
                    <div className="flex-shrink-0 mt-auto mb-1">{msg.sender === username && currentUser?.avatar_url ? (<img src={`${API_URL}${currentUser.avatar_url}`} className="w-8 h-8 rounded-full border border-white/10 object-cover" />) : (<div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${msg.sender === username ? 'bg-gradient-primary' : 'bg-[#1E1E1E]'}`}>{msg.sender.charAt(0).toUpperCase()}</div>)}</div>
                    <div className={`flex flex-col gap-1 ${msg.sender === username ? "items-end" : "items-start"}`}>
                      <div className="flex items-baseline gap-2 mx-1">
                        <span className="text-sm font-semibold text-white/90">{msg.sender === username ? "You" : msg.sender}</span>
                        <span className="text-[10px] text-white/40">{msg.timestamp} {msg.sender === username && <span className="text-purple-400 ml-1 text-xs leading-none">✓✓</span>}</span>
                      </div>
                      <div className={`px-5 py-3.5 shadow-sm ${msg.sender === username ? "bg-gradient-primary text-white rounded-3xl rounded-tr-sm" : "bg-[#2A2A2A] text-white/90 rounded-3xl rounded-tl-sm"}`}>
                        {renderAttachment(msg.attachment_url)}
                        {msg.content && <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">{parseMarkdown(msg.content)}</p>}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
              {typingUser && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
                  <div className="bg-[#2A2A2A] px-4 py-2 rounded-3xl rounded-tl-sm text-white/50 text-sm italic shadow-sm">
                    {typingUser} is typing...
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="p-4 md:p-6 bg-[#121212] border-t border-white/5 relative">
            <AnimatePresence>
              {smartReplies.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute -top-12 left-4 md:left-6 flex gap-2">
                  {smartReplies.map((reply, idx) => (
                    <button key={idx} onClick={() => { setInputMessage(reply); setSmartReplies([]); }} className="bg-[#1E1E1E] hover:bg-white/10 border border-white/10 px-4 py-2 rounded-full text-sm text-purple-300 font-medium shadow-lg transition-colors flex items-center gap-1">
                      <Sparkles size={14} /> {reply}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
            <form onSubmit={handleSendMessage} className="relative flex items-end bg-[#1E1E1E] rounded-3xl border border-white/5 shadow-inner">
              <textarea 
                ref={textareaRef}
                value={inputMessage} 
                onChange={handleInput} 
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); } }}
                placeholder="Type a message..." 
                className="w-full bg-transparent py-4 pl-6 pr-40 text-[15px] text-white focus:outline-none placeholder-white/30 resize-none max-h-[120px] custom-scrollbar leading-tight"
                rows={1}
              />
              <div className="absolute right-2 bottom-2 flex items-center gap-1">
                {attachmentFile && (
                  <div className="absolute -top-12 right-0 bg-[#2A2A2A] px-3 py-1.5 rounded-lg text-xs text-white border border-white/10 flex items-center gap-2 shadow-lg truncate max-w-[200px]">
                    <Paperclip size={12} /> {attachmentFile.name}
                    <button type="button" onClick={() => setAttachmentFile(null)} className="text-white/50 hover:text-white">x</button>
                  </div>
                )}
                <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => { if(e.target.files) setAttachmentFile(e.target.files[0]) }} />
                
                <div className="relative">
                  <AnimatePresence>
                    {showEmojiPicker && (
                      <motion.div initial={{ opacity: 0, scale: 0.9, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 10 }} className="absolute bottom-14 -left-16 bg-[#2A2A2A] border border-white/10 rounded-2xl p-3 shadow-2xl flex gap-2 w-max z-50">
                        {emojis.map(emoji => (
                          <button key={emoji} type="button" onClick={() => { setInputMessage(prev => prev + emoji); setShowEmojiPicker(false); }} className="text-xl hover:scale-125 transition-transform">{emoji}</button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="w-11 h-11 flex items-center justify-center text-white/40 hover:text-white transition-colors hidden sm:flex rounded-full hover:bg-white/5"><Smile size={20} /></button>
                </div>
                
                <button type="button" onClick={() => fileInputRef.current?.click()} className="w-11 h-11 flex items-center justify-center text-white/40 hover:text-white transition-colors hidden sm:flex rounded-full hover:bg-white/5"><Paperclip size={20} /></button>
                <button type="button" onClick={toggleRecording} className={`w-11 h-11 flex items-center justify-center transition-colors hidden sm:flex rounded-full hover:bg-white/5 ${isRecording ? "text-red-500 animate-pulse bg-red-500/10" : "text-white/40 hover:text-white"}`}><Mic size={20} /></button>
                <button type="submit" disabled={!inputMessage.trim() && !attachmentFile} className={`ml-1 px-5 py-2.5 rounded-full flex items-center gap-2 font-medium transition-all ${(inputMessage.trim() || attachmentFile) ? "bg-gradient-primary glow-primary text-white scale-100" : "bg-white/5 text-white/30 scale-95"}`}>Send <span className={(inputMessage.trim() || attachmentFile) ? "translate-x-0.5 transition-transform" : ""}>→</span></button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      <AnimatePresence>
        {showProfileModal && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowProfileModal(false)}></div>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="bg-[#1E1E1E] relative rounded-3xl p-8 w-full max-w-md shadow-2xl z-10 border border-white/5">
              <h2 className="text-2xl font-bold mb-6 text-center">Edit Profile</h2>
              <form onSubmit={handleSaveProfile} className="space-y-5">
                <div className="flex justify-center mb-6"><label className="cursor-pointer group relative">{avatarPreview || currentUser?.avatar_url ? (<img src={avatarPreview || `${API_URL}${currentUser.avatar_url}`} alt="Avatar" className="w-24 h-24 rounded-full object-cover border-[3px] border-purple-500 shadow-lg" />) : (<div className="w-24 h-24 rounded-full bg-gradient-primary flex items-center justify-center text-3xl font-bold border-[3px] border-transparent shadow-lg">{username.charAt(0).toUpperCase()}</div>)}<div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><span className="text-sm font-medium text-white">Change</span></div><input type="file" className="hidden" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) { setAvatarFile(file); setAvatarPreview(URL.createObjectURL(file)); } }} /></label></div>
                <div><label className="block text-sm font-medium text-white/70 mb-2">Email Address</label><input type="email" value={profileEmail} onChange={(e) => setProfileEmail(e.target.value)} className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-white/20 focus:outline-none" /></div>
                <div><label className="block text-sm font-medium text-white/70 mb-2">Phone Number</label><input type="tel" value={profilePhone} onChange={(e) => setProfilePhone(e.target.value)} className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-white/20 focus:outline-none" /></div>
                <div className="flex gap-3 mt-8"><button type="button" onClick={() => setShowProfileModal(false)} className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 font-medium text-white/80 transition-colors">Cancel</button><button type="submit" className="flex-1 py-3 rounded-xl bg-gradient-primary glow-primary active:scale-95 font-medium transition-transform">Save Changes</button></div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Incoming Call Modal */}
      <AnimatePresence>
        {incomingCall && !isCalling && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md"></div>
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="bg-[#1E1E1E] relative rounded-3xl p-8 w-full max-w-sm shadow-2xl z-10 border border-white/10 text-center">
              <div className="w-20 h-20 bg-gradient-primary rounded-full mx-auto mb-4 flex items-center justify-center animate-pulse shadow-[0_0_30px_rgba(236,72,153,0.5)]"><PhoneCall size={32} className="text-white" /></div>
              <h2 className="text-2xl font-bold mb-1">{incomingCall.sender}</h2>
              <p className="text-white/50 mb-8">Incoming {(incomingCall.withVideo ?? true) ? "video" : "audio"} call...</p>
              <div className="flex gap-4 justify-center"><button onClick={() => { setIncomingCall(null); iceCandidatesQueue.current = []; }} className="w-14 h-14 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors border border-red-500/50"><PhoneOff size={24} /></button><button onClick={acceptCall} className="w-14 h-14 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center hover:bg-green-500 hover:text-white transition-colors border border-green-500/50"><Phone size={24} /></button></div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
