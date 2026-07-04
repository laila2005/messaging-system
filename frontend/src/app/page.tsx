"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Globe, LogOut, Search, Smile, Paperclip, Mic, ArrowLeft, Phone, Video, PhoneOff, VideoOff, MicOff, PhoneCall, Sparkles, Play, Pause, Trash2, MapPin, Map, UserX, UserPlus, Monitor, Share2, Reply, Check, CheckCheck, Download, X, Forward, EyeOff } from "lucide-react";
import { Contacts } from '@capacitor-community/contacts';
import { Geolocation } from '@capacitor/geolocation';


// Real waveform AudioPlayer using Web Audio API
const AudioPlayer = ({ src }: { src: string }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const animFrameRef = useRef<number>(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  const setupAnalyzer = () => {
    if (!audioRef.current || audioCtxRef.current) return;
    const ctx = new AudioContext();
    const analyzer = ctx.createAnalyser();
    analyzer.fftSize = 64;
    const source = ctx.createMediaElementSource(audioRef.current);
    source.connect(analyzer);
    analyzer.connect(ctx.destination);
    audioCtxRef.current = ctx;
    analyzerRef.current = analyzer;
    sourceRef.current = source;
  };

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const analyzer = analyzerRef.current;
    if (!canvas || !analyzer) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const bufferLength = analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyzer.getByteFrequencyData(dataArray);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const barWidth = (canvas.width / bufferLength) * 1.5;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (dataArray[i] / 255) * canvas.height;
      const gradient = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
      gradient.addColorStop(0, 'rgba(168,85,247,0.9)');
      gradient.addColorStop(1, 'rgba(236,72,153,0.6)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(x, canvas.height - barHeight, barWidth - 1, barHeight, 2);
      ctx.fill();
      x += barWidth + 1;
    }
    animFrameRef.current = requestAnimationFrame(drawWaveform);
  }, []);

  const togglePlay = () => {
    if (!audioRef.current) return;
    setupAnalyzer();
    if (isPlaying) {
      audioRef.current.pause();
      cancelAnimationFrame(animFrameRef.current);
    } else {
      audioRef.current.play();
      drawWaveform();
    }
    setIsPlaying(!isPlaying);
  };

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  return (
    <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl py-2.5 px-4 w-64 shadow-md">
      <button onClick={togglePlay} className="w-9 h-9 flex items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-pink-500 text-white hover:opacity-90 transition-opacity shrink-0 shadow-lg">
        {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
      </button>
      <div className="flex-1 flex flex-col gap-1">
        <canvas ref={canvasRef} width={120} height={24} className="w-full rounded" />
        <div className="flex justify-between text-[10px] text-white/40">
          <span>{fmtTime(currentTime)}</span>
          <span>{fmtTime(duration)}</span>
        </div>
      </div>
      <audio
        ref={audioRef}
        src={src}
        onEnded={() => { setIsPlaying(false); cancelAnimationFrame(animFrameRef.current); setCurrentTime(0); }}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
      />
    </div>
  );
};
const LinkPreview = ({ url }: { url: string }) => {
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchPreview = async () => {
      try {
        const res = await fetch(`https://laila-mf-zagel-backend.hf.space/api/link-preview?url=${encodeURIComponent(url)}`);
        if (res.ok && active) {
          const data = await res.json();
          if (data && (data.title || data.description || data.image)) {
            setPreview(data);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchPreview();
    return () => { active = false; };
  }, [url]);

  if (loading || !preview) return null;

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="mt-2 block bg-black/25 hover:bg-black/35 border border-white/10 rounded-2xl overflow-hidden shadow-md transition-all hover:scale-[1.01] max-w-[280px] text-left">
      {preview.image && (
        <img src={preview.image} alt={preview.title || "Preview"} className="w-full h-28 object-cover border-b border-white/5" />
      )}
      <div className="p-3.5 space-y-1">
        {preview.title && <div className="font-bold text-xs text-white/95 line-clamp-1">{preview.title}</div>}
        {preview.description && <div className="text-[10px] text-white/50 line-clamp-2 leading-relaxed">{preview.description}</div>}
        <div className="text-[9px] text-purple-400 font-mono font-medium truncate mt-1">{new URL(url).hostname}</div>
      </div>
    </a>
  );
};


export default function ChatApp() {
  const API_URL = "https://laila-mf-zagel-backend.hf.space";
  const WS_URL = "wss://laila-mf-zagel-backend.hf.space";

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
  const [connections, setConnections] = useState<any[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  const [connectedUsernames, setConnectedUsernames] = useState<string[]>([]);
  
  const currentUserRef = useRef<any>(null);
  const selectedUserRef = useRef<string | null>(null);
  const chatModeRef = useRef<string>("none");
  
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);
  useEffect(() => { selectedUserRef.current = selectedUser; }, [selectedUser]);
  useEffect(() => { chatModeRef.current = chatMode; }, [chatMode]);
  
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [smartReplies, setSmartReplies] = useState<string[]>([]);
  const [activeChats, setActiveChats] = useState<string[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
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

  // Advanced Features State
  const [showDialerModal, setShowDialerModal] = useState(false);
  const [dialerNumber, setDialerNumber] = useState("");
  const [suggestedContacts, setSuggestedContacts] = useState<any[]>([]);
  const [isSyncingContacts, setIsSyncingContacts] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [privacySettings, setPrivacySettings] = useState({
    requireMessageRequests: false,
    hidePhoneNumber: false,
  });
  const [isDisappearingChat, setIsDisappearingChat] = useState(false);

  // WebRTC Call State
  const [isCalling, setIsCalling] = useState(false);
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isCallFullscreen, setIsCallFullscreen] = useState(false);
  const [isRecordingCall, setIsRecordingCall] = useState(false);
  const callRecorderRef = useRef<MediaRecorder | null>(null);
  const callChunksRef = useRef<Blob[]>([]);
  const screenStreamRef = useRef<MediaStream | null>(null);
  
  // Reply-to / quoting
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [forwardMessage, setForwardMessage] = useState<any>(null);
  const [isCameraBlurred, setIsCameraBlurred] = useState(false);
  
  // Network status
  const [isOnline, setIsOnline] = useState(true);
  const offlineQueueRef = useRef<any[]>([]);
  
  // Push notification permission
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');
  
  const ws = useRef<WebSocket | null>(null);
  const pc = useRef<RTCPeerConnection | null>(null);
  const iceCandidatesQueue = useRef<RTCIceCandidateInit[]>([]);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Restore token from localStorage on mount (Bug 4: auto-login)
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
      setToken(savedToken);
      // Fetch user profile to restore session
      fetch(`${API_URL}/users/me`, { headers: { "Authorization": `Bearer ${savedToken}` } })
        .then(res => {
          if (res.ok) return res.json();
          throw new Error('Invalid token');
        })
        .then(userData => {
          setUserId(userData.id);
          setCurrentUser(userData);
          setUsername(userData.username);
          setProfileEmail(userData.email || '');
          setProfilePhone(userData.phone_number || '');
          setIsLoggedIn(true);
        })
        .catch(() => {
          localStorage.removeItem('token');
        });
    }
  }, []);

  // Auto-scroll to bottom when messages change (Bug 9)
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const rtcConfig = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }] };

  // ── Network / offline queue ──────────────────────────────────────────────
  useEffect(() => {
    try {
      const stored = localStorage.getItem('zagel_offline_queue');
      if (stored) {
        offlineQueueRef.current = JSON.parse(stored);
      }
    } catch (e) { console.error('Failed to load offline queue', e); }

    const goOnline = () => { setIsOnline(true); flushOfflineQueue(); };
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    setIsOnline(navigator.onLine);
    if (navigator.onLine) {
      flushOfflineQueue();
    }
    return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline); };
  }, []);

  const flushOfflineQueue = () => {
    const queue = [...offlineQueueRef.current];
    offlineQueueRef.current = [];
    localStorage.removeItem('zagel_offline_queue');
    queue.forEach((payload) => {
      if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify(payload));
    });
  };

  // ── WebRTC Adaptive Bitrate ──────────────────────────────────────────────
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isCalling && pc.current) {
      interval = setInterval(async () => {
        if (!pc.current) return;
        try {
          const stats = await pc.current.getStats();
          stats.forEach(report => {
            if (report.type === 'inbound-rtp' && report.kind === 'video') {
              const packetsLost = report.packetsLost || 0;
              const packetsReceived = report.packetsReceived || 1;
              const lossRate = packetsLost / packetsReceived;
              if (lossRate > 0.05) { // more than 5% packet loss
                const sender = pc.current?.getSenders().find(s => s.track?.kind === 'video');
                if (sender) {
                  const params = sender.getParameters();
                  if (params.encodings && params.encodings.length > 0) {
                    params.encodings[0].maxBitrate = 100000; // cap at 100kbps on bad network
                    sender.setParameters(params).catch(console.error);
                  }
                }
              }
            }
          });
        } catch (e) { console.error('Failed to monitor WebRTC stats', e); }
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [isCalling]);

  // ── Push Notification setup ──────────────────────────────────────────────
  useEffect(() => {
    if ('Notification' in window) setNotifPermission(Notification.permission);
  }, []);

  const requestNotifPermission = async () => {
    if ('Notification' in window) {
      const perm = await Notification.requestPermission();
      setNotifPermission(perm);
    }
  };

  const showPushNotif = (title: string, body: string) => {
    if (notifPermission === 'granted' && document.hidden) {
      new Notification(title, { body, icon: '/logo.png', badge: '/logo.png' });
    }
  };

  // ── Screen Share ─────────────────────────────────────────────────────────
  const toggleScreenShare = async () => {
    if (!pc.current) return;
    if (isScreenSharing) {
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
      const videoTrack = localStream?.getVideoTracks()[0];
      if (videoTrack) {
        pc.current.getSenders().find(s => s.track?.kind === 'video')?.replaceTrack(videoTrack);
      }
      setIsScreenSharing(false);
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        screenStreamRef.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];
        pc.current.getSenders().find(s => s.track?.kind === 'video')?.replaceTrack(screenTrack);
        screenTrack.onended = () => { setIsScreenSharing(false); const vt = localStream?.getVideoTracks()[0]; if (vt) pc.current?.getSenders().find(s => s.track?.kind === 'video')?.replaceTrack(vt); };
        setIsScreenSharing(true);
      } catch (e) { console.error('Screen share denied', e); }
    }
  };

  // ── Call Recording ───────────────────────────────────────────────────────
  const toggleCallRecording = () => {
    if (isRecordingCall) {
      callRecorderRef.current?.stop();
      setIsRecordingCall(false);
    } else {
      if (!remoteStream) return;
      const chunks: Blob[] = [];
      callChunksRef.current = chunks;
      const recorder = new MediaRecorder(remoteStream);
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `zagel-call-${Date.now()}.webm`; a.click();
        URL.revokeObjectURL(url);
      };
      recorder.start();
      callRecorderRef.current = recorder;
      setIsRecordingCall(true);
    }
  };

  // ── Picture-in-Picture ───────────────────────────────────────────────────
  const togglePiP = async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (remoteVideoRef.current) {
        await remoteVideoRef.current.requestPictureInPicture();
      }
    } catch (e) { console.error('PiP error', e); }
  };



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

  const fetchConnections = async () => {
    if (!token || !currentUser) return;
    try {
      const res = await fetch(`${API_URL}/connections`, { headers: { "Authorization": `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        const friends = data.friends || [];
        setConnections(friends);
        const usernames = friends.map((f: any) => f.username);
        setConnectedUsernames(usernames);
        
        const incoming = data.incoming_requests || [];
        setIncomingRequests(incoming);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    let reconnectTimer: NodeJS.Timeout;
    
    const connectWebSocket = () => {
      if (isLoggedIn && token) {
        const socket = new WebSocket(`${WS_URL}/ws?token=${token}`);
        
        socket.onopen = () => {
          setSystemAlert(null); // Clear any alert on successful connection
          fetchOnlineUsers();
          fetchConnections();
        };
        
        socket.onmessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.type === "system") {
            fetchOnlineUsers();
            setSystemAlert(data.content);
            setTimeout(() => setSystemAlert(null), 5000);
          } else if (data.type === "message") {
            const isFromMe = data.sender_username === currentUserRef.current?.username;
            
            if (!isFromMe && data.sender_username !== selectedUserRef.current) {
              setUnreadCounts(prev => ({ ...prev, [data.sender_username]: (prev[data.sender_username] || 0) + 1 }));
              setActiveChats(prev => prev.includes(data.sender_username) ? prev : [...prev, data.sender_username]);
              showPushNotif(`Zagel – ${data.sender_username}`, data.content || '📎 Attachment');
            } else if (!isFromMe && data.sender_username === selectedUserRef.current) {
              if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: "mark_read", sender_id: data.sender_id }));
              }
            }

            setMessages(prev => {
              if (prev.some(m => m.id === data.id)) return prev;
              return [...prev, {
                id: data.id, sender: data.sender_username, content: data.content,
                type: data.recipient_id ? "direct" : "broadcast", recipient: data.recipient_username,
                attachment_url: data.attachment_url,
                location_lat: data.location_lat,
                location_lng: data.location_lng,
                is_disappearing: data.is_disappearing,
                reactions: data.reactions || [],
                reply_to_id: data.reply_to_id,
                reply_to_username: data.reply_to_username,
                reply_to_content: data.reply_to_content,
                timestamp: new Date(data.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                status: data.status
              }];
            });
          } else if (data.type === "typing") {
            if (chatModeRef.current === "direct" && selectedUserRef.current === data.sender_username) {
              setTypingUser(data.sender_username);
              if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
              typingTimeoutRef.current = setTimeout(() => setTypingUser(null), 3000);
            }
          } else if (data.type === "reaction") {
            setMessages(prev => prev.map(m => {
              if (m.id === data.message_id) {
                const reactions = m.reactions || [];
                return { ...m, reactions: [...reactions, { emoji: data.emoji, user_id: data.user_id }] };
              }
              return m;
            }));
          } else if (data.type === "messages_read") {
            if (chatModeRef.current === "direct" && selectedUserRef.current === data.reader_username) {
              setMessages(prev => prev.map(m => m.sender === currentUserRef.current?.username ? { ...m, status: 'read' } : m));
            }
          } else if (data.type === "connection_request") {
            fetchConnections();
            setSystemAlert("New connection request!");
            setTimeout(() => setSystemAlert(null), 5000);
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
        
        const pingInterval = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "ping" }));
          }
        }, 30000);

        socket.onclose = (e) => {
          clearInterval(pingInterval);
          if (e.code === 1008) {
            handleLogout();
            return;
          }
          setSystemAlert("Connection to server lost. Reconnecting...");
          // Try to reconnect in 3 seconds
          reconnectTimer = setTimeout(() => {
            connectWebSocket();
          }, 3000);
        };
        
        ws.current = socket;
        return () => {
          clearInterval(pingInterval);
          socket.close();
        };
      }
    };
    
    let cleanup = connectWebSocket();
    return () => {
      clearTimeout(reconnectTimer);
      if (cleanup) cleanup();
    };
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
          location_lat: data.location_lat,
          location_lng: data.location_lng,
          is_disappearing: data.is_disappearing,
          reactions: data.reactions || [],
          reply_to_id: data.reply_to_id,
          reply_to_username: data.reply_to_username,
          reply_to_content: data.reply_to_content,
          status: data.status || "sent",
          timestamp: new Date(data.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
        }));
        setMessages(formatted);
      } else if (res.status === 401) {
        handleLogout();
      }
    } catch (err) { console.error(err); }
  };

  const handleSyncContacts = async () => {
    setIsSyncingContacts(true);
    try {
      const permission = await Contacts.requestPermissions();
      if (permission.contacts !== 'granted') {
        setError("Contacts permission denied");
        setIsSyncingContacts(false);
        return;
      }
      
      const result = await Contacts.getContacts({
        projection: { name: true, phones: true }
      });
      
      const phoneNumbers: string[] = [];
      result.contacts.forEach(contact => {
        contact.phones?.forEach(phone => {
          const normalized = phone.number?.replace(/[\s\-\(\)]/g, "");
          if (normalized) phoneNumbers.push(normalized);
        });
      });
      
      if (phoneNumbers.length > 0) {
        const res = await fetch(`${API_URL}/contacts/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify(phoneNumbers)
        });
        
        if (res.ok) {
          const matches = await res.json();
          setSuggestedContacts(matches);
        }
      }
    } catch (err) {
      console.error(err);
      setError("Failed to sync contacts");
    }
    setIsSyncingContacts(false);
  };

  const handleShareLocation = async () => {
    try {
      const permission = await Geolocation.requestPermissions();
      if (permission.location !== 'granted') {
        setError("Location permission denied");
        return;
      }
      const position = await Geolocation.getCurrentPosition();
      const { latitude, longitude } = position.coords;
      
      if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
        setSystemAlert("Cannot send: disconnected from server. Reconnecting...");
        setTimeout(() => setSystemAlert(null), 3000);
        return;
      }
      
      const recipient_id = chatMode === "direct" && selectedUser
        ? connections.find(c => c.requester_username === selectedUser || c.target_username === selectedUser)?.target_id
        : null;

      ws.current.send(JSON.stringify({ 
        type: "message",
        content: "📍 Shared Location", 
        recipient_username: chatMode === "direct" ? selectedUser : null,
        recipient_id: recipient_id,
        location_lat: latitude.toString(),
        location_lng: longitude.toString(),
        is_disappearing: isDisappearingChat
      }));
    } catch (err) {
      console.error(err);
      setError("Failed to get location");
    }
  };

  const handleReactToMessage = async (messageId: number, emoji: string) => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) return;
    ws.current.send(JSON.stringify({
      type: "reaction",
      message_id: messageId,
      emoji: emoji
    }));
  };

  useEffect(() => {
    if (chatMode === "broadcast") fetchChatHistory(null);
    else if (chatMode === "direct" && selectedUser) fetchChatHistory(selectedUser);
  }, [chatMode, selectedUser, token]);

  const handleClearChat = async () => {
    if (!token) return;
    if (!confirm("Are you sure you want to clear this chat history?")) return;
    try {
      let url = `${API_URL}/messages`;
      if (chatMode === "direct" && selectedUser) {
        url += `?target_username=${encodeURIComponent(selectedUser)}`;
      }
      const res = await fetch(url, { method: "DELETE", headers: { "Authorization": `Bearer ${token}` } });
      if (res.ok) {
        setMessages([]);
        setSystemAlert("Chat cleared.");
        setTimeout(() => setSystemAlert(null), 3000);
      }
    } catch(e) {
      console.error(e);
    }
  };

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

  // Compute sorted sidebar users
  const allSidebarUsers = Array.from(new Set([...onlineUsers, ...activeChats]));
  const filteredUsers = allSidebarUsers
    .filter(user => user.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      // Bubble unread users to top
      const aUnread = unreadCounts[a] || 0;
      const bUnread = unreadCounts[b] || 0;
      if (aUnread > 0 && bUnread === 0) return -1;
      if (bUnread > 0 && aUnread === 0) return 1;
      return a.localeCompare(b);
    });

  const startNewChat = () => {
    if (searchQuery.trim() && !allSidebarUsers.includes(searchQuery.toLowerCase())) {
      setActiveChats([...activeChats, searchQuery.toLowerCase()]);
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

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setCurrentUser(null);
    setIsLoggedIn(false);
    setMessages([]);
    setConnections([]);
    setIncomingRequests([]);
    setSystemAlert(null);
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
      localStorage.setItem('token', data.access_token);
      const userRes = await fetch(`${API_URL}/users/me`, { headers: { "Authorization": `Bearer ${data.access_token}` } });
      const userData = await userRes.json();
      setUserId(userData.id); setCurrentUser(userData); setProfileEmail(userData.email || ""); setProfilePhone(userData.phone_number || "");
      setIsLoggedIn(true);
    } catch (err) { setError("Cannot connect to server."); }
  };

  const handleSendMessage = async (e: any) => {
    if (e.preventDefault) e.preventDefault();
    if (!inputMessage.trim() && !attachmentFile) return;
    
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

    const payload = {
      content: inputMessage,
      recipient_id: recipient_id,
      attachment_url: attachment_url,
      reply_to_id: replyingTo?.id || null,
      reply_to_username: replyingTo?.sender || null,
      reply_to_content: replyingTo?.content || null
    };

    if (!isOnline || !ws.current || ws.current.readyState !== WebSocket.OPEN) {
      // Offline queueing
      offlineQueueRef.current.push(payload);
      try {
        localStorage.setItem('zagel_offline_queue', JSON.stringify(offlineQueueRef.current));
      } catch (e) { console.error(e); }

      // Optimistic local message add
      const pendingMsg = {
        id: Date.now(),
        sender: username,
        recipient: selectedUser,
        content: inputMessage,
        attachment_url: attachment_url,
        reply_to_id: replyingTo?.id || null,
        reply_to_username: replyingTo?.sender || null,
        reply_to_content: replyingTo?.content || null,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'pending',
        type: chatMode === "broadcast" ? "broadcast" : "direct"
      };
      setMessages(prev => [...prev, pendingMsg]);
      setInputMessage("");
      setReplyingTo(null);
      setAttachmentFile(null);
      setSystemAlert("Message queued offline. It will be sent automatically when you are back online.");
      setTimeout(() => setSystemAlert(null), 3000);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      return;
    }

    ws.current.send(JSON.stringify({ 
      content: inputMessage, 
      recipient_id: recipient_id, 
      attachment_url: attachment_url,
      reply_to_id: replyingTo?.id || null
    }));
    
    setInputMessage("");
    setReplyingTo(null);
    setAttachmentFile(null);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleForwardTo = async (targetUser: string | null) => {
    if (!forwardMessage) return;
    
    let recipient_id = null;
    if (targetUser) {
      recipient_id = await getUserId(targetUser);
    }

    const payload = {
      content: forwardMessage.content ? `[Forwarded]: ${forwardMessage.content}` : "[Forwarded Attachment]",
      recipient_id: recipient_id,
      attachment_url: forwardMessage.attachment_url,
      location_lat: forwardMessage.location_lat,
      location_lng: forwardMessage.location_lng
    };

    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(payload));
      setSystemAlert("Message forwarded!");
    } else {
      offlineQueueRef.current.push(payload);
      try {
        localStorage.setItem('zagel_offline_queue', JSON.stringify(offlineQueueRef.current));
      } catch (e) { console.error(e); }
      setSystemAlert("Message queued for forwarding offline!");
    }
    
    setTimeout(() => setSystemAlert(null), 3000);
    setForwardMessage(null);
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
        body: JSON.stringify({ 
          email: profileEmail || null, 
          phone_number: profilePhone || null,
          require_message_requests: privacySettings.requireMessageRequests,
          hide_phone_number: privacySettings.hidePhoneNumber
        })
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
      <div className="min-h-[100dvh] flex items-start md:items-center justify-center p-4 py-12 md:py-4 bg-[#050505] overflow-y-auto relative">
        <div className="absolute top-[10%] left-[10%] w-96 h-96 bg-purple-600/20 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-[10%] right-[10%] w-96 h-96 bg-pink-600/20 rounded-full blur-[120px] pointer-events-none"></div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white/[0.03] backdrop-blur-2xl w-full max-w-md p-8 rounded-3xl shadow-[0_0_40px_rgba(0,0,0,0.5)] relative overflow-hidden border border-white/10 z-10">
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
    <div className="flex h-[100dvh] w-full bg-[#080808] text-white overflow-hidden selection:bg-purple-500/30">
      
      {/* System Alert Banner */}
      <AnimatePresence>
        {systemAlert && (
          <motion.div initial={{ y: -50 }} animate={{ y: 0 }} exit={{ y: -50 }} className="absolute top-0 left-0 w-full bg-purple-600 text-white text-sm font-medium py-2 px-4 text-center z-[100] shadow-lg">
            {systemAlert}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDialerModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-[#1E1E1E] w-full max-w-sm rounded-3xl p-6 border border-white/10 shadow-2xl">
              <h3 className="text-xl font-bold mb-4">New Message</h3>
              <p className="text-sm text-white/50 mb-4">Enter a phone number to start a conversation or send a connection request.</p>
              <input type="tel" value={dialerNumber} onChange={e => setDialerNumber(e.target.value)} placeholder="+1 (555) 000-0000" className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 mb-4 text-white focus:outline-none focus:border-purple-500" />
              <div className="flex gap-3">
                <button onClick={() => setShowDialerModal(false)} className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 font-medium">Cancel</button>
                <button onClick={async () => {
                  if (!dialerNumber) return;
                  const res = await fetch(`${API_URL}/contacts/sync`, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }, body: JSON.stringify({ phone_numbers: [dialerNumber] }) });
                  if (res.ok) {
                    const matches = await res.json();
                    if (matches.length > 0) {
                      setShowDialerModal(false);
                      const user = matches[0].username;
                      if (connectedUsernames.includes(user)) {
                        setChatMode("direct");
                        setSelectedUser(user);
                      } else {
                        await fetch(`${API_URL}/connections/request/${user}`, { method: "POST", headers: { "Authorization": `Bearer ${token}` } });
                        setSystemAlert("Connection request sent to " + user);
                        setTimeout(() => setSystemAlert(null), 3000);
                        fetchConnections();
                      }
                    } else {
                      setSystemAlert("No Zagel user found with that number.");
                      setTimeout(() => setSystemAlert(null), 3000);
                    }
                  }
                }} className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 font-medium shadow-lg">Find User</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sidebar: Shows full width on mobile if no chat is selected, hidden otherwise */}
      <div className={`w-full md:w-80 h-full flex flex-col border-r border-white/5 bg-[#0d0d12] z-40 shrink-0 ${chatMode !== "none" ? "hidden md:flex" : "flex"}`}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-8"><div className="flex items-center gap-3"><img src="/logo.png" alt="Zagel" className="w-8 h-8 object-contain drop-shadow-md" /><h2 className="text-xl font-bold tracking-wide">Zagel</h2></div></div>
          <div className="relative mb-6 flex gap-2">
            <div className="relative flex-1"><Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" /><input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && startNewChat()} className="w-full bg-[#121212] border border-white/5 rounded-full pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-white/20 transition-colors" /></div>
            <button onClick={() => setShowDialerModal(true)} className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center hover:bg-purple-500 shadow-lg shrink-0" title="Message unsaved number"><Phone size={16}/></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1 custom-scrollbar">
          <button onClick={() => { setChatMode("broadcast"); setSelectedUser(null); }} className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all ${chatMode === "broadcast" ? "bg-white/5 shadow-[inset_4px_0_0_0_rgba(168,85,247,1)]" : "hover:bg-white/5"}`}><div className="w-10 h-10 rounded-full bg-[#121212] border border-white/10 text-white/70 flex items-center justify-center"><Globe size={20} /></div><div className="flex flex-col items-start"><span className="font-semibold text-[15px]">Global Room</span><span className="text-xs text-white/40">Public Broadcast</span></div></button>
          {filteredUsers.map(user => {
            const isUserOnline = onlineUsers.includes(user);
            const unread = unreadCounts[user] || 0;
            const isConnected = connectedUsernames.includes(user);
            return (
            <button key={user} onClick={async () => { 
              if (isConnected || user === currentUser?.username) {
                setChatMode("direct"); 
                setSelectedUser(user); 
                if (unread > 0) {
                  setUnreadCounts(prev => ({ ...prev, [user]: 0 }));
                  if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                    getUserId(user).then(uid => {
                      ws.current?.send(JSON.stringify({ type: "mark_read", sender_id: uid }));
                    });
                  }
                }
              } else {
                // Open chat directly (WhatsApp-style) and send connection request in background
                setChatMode("direct"); 
                setSelectedUser(user);
                if (unread > 0) {
                  setUnreadCounts(prev => ({ ...prev, [user]: 0 }));
                }
                // Auto-send connection request in background (non-blocking)
                fetch(`${API_URL}/connections/request/${user}`, {
                  method: "POST",
                  headers: { "Authorization": `Bearer ${token}` }
                }).then(() => fetchConnections()).catch(() => {});
              }
            }} className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all relative ${chatMode === "direct" && selectedUser === user ? "bg-white/5 shadow-[inset_4px_0_0_0_rgba(168,85,247,1)]" : "hover:bg-white/5"}`}>
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-[#121212] border border-white/10 flex items-center justify-center font-bold text-lg text-white/80">{user.charAt(0).toUpperCase()}</div>
                {isUserOnline && <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#0f1123] shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>}
              </div>
              <div className="flex flex-col items-start flex-1 overflow-hidden">
                <span className={`font-semibold text-[15px] truncate w-full text-left ${unread > 0 ? "text-white" : "text-white/80"}`}>{user}</span>
                <span className={`text-xs ${isUserOnline ? "text-green-400" : "text-white/40"}`}>{isUserOnline ? "online" : "offline"}</span>
              </div>
              {unread > 0 && (
                <div className="flex items-center justify-center bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.5)]">
                  {unread}
                </div>
              )}
            </button>
            );
          })}
          {incomingRequests.length > 0 && (
            <div className="pt-4">
              <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-2 px-4">Incoming Requests</h3>
              {incomingRequests.map(req => (
                <div key={req.id} className="w-full flex flex-col gap-2 px-4 py-3 bg-white/5 rounded-2xl mb-2 border border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#121212] flex items-center justify-center font-bold text-sm text-white/80">{(req.requester_username || `User ${req.sender_id}`)?.charAt(0).toUpperCase()}</div>
                    <span className="font-semibold text-[14px] truncate flex-1">{req.requester_username || `User #${req.sender_id}`}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <button 
                      onClick={async () => {
                        try {
                          await fetch(`${API_URL}/connections/accept/${req.id}`, { method: 'POST', headers: { "Authorization": `Bearer ${token}` } });
                          fetchConnections();
                        } catch(e) {}
                      }}
                      className="flex-1 bg-purple-600 hover:bg-purple-500 text-white text-xs py-1.5 rounded-lg transition-colors font-medium shadow-md">Accept</button>
                    <button 
                      onClick={async () => {
                        try {
                          await fetch(`${API_URL}/connections/reject/${req.id}`, { method: 'POST', headers: { "Authorization": `Bearer ${token}` } });
                          fetchConnections();
                        } catch(e) {}
                      }}
                      className="flex-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-500/30 text-xs py-1.5 rounded-lg transition-colors font-medium">Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="p-4 border-t border-white/5"><div className="flex items-center gap-3 cursor-pointer hover:bg-white/5 p-3 rounded-2xl transition-colors" onClick={() => setShowProfileModal(true)}>{currentUser?.avatar_url ? (<img src={`${API_URL}${currentUser.avatar_url}`} alt="Avatar" className="w-10 h-10 rounded-full object-cover border border-white/10 shadow-md" />) : (<div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center font-bold">{username.charAt(0).toUpperCase()}</div>)}<div className="flex-1 overflow-hidden"><h3 className="font-semibold truncate text-[15px]">{username}</h3><p className="text-xs text-white/40">Edit Profile</p></div><button onClick={(e) => { e.stopPropagation(); handleLogout(); }} className="w-11 h-11 flex items-center justify-center text-white/40 hover:text-white transition-colors rounded-full hover:bg-white/10"><LogOut size={18} /></button></div></div>
      </div>

      {/* Main Area: Empty State OR Chat View */}
      {chatMode === "none" ? (
        <div className="hidden md:flex flex-1 items-center justify-center bg-[#080808] relative">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-900/10 via-[#080808] to-[#080808] pointer-events-none"></div>
          <div className="text-center opacity-30 z-10">
            <img src="/logo.png" alt="Zagel" className="w-28 h-28 mx-auto mb-6 object-contain opacity-50 drop-shadow-[0_0_30px_rgba(168,85,247,0.5)]" />
            <h2 className="text-3xl font-bold mb-2 tracking-tight">Zagel Messaging</h2>
            <p className="text-lg">Select a user or room to start messaging</p>
          </div>
        </div>
      ) : (
        <div className={`flex-1 flex flex-col h-full bg-[#080808] relative z-0`}>
          <div className="h-[88px] px-4 md:px-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02] backdrop-blur-xl">
            <div className="flex items-center gap-2 md:gap-4">
              <button className="md:hidden w-11 h-11 flex items-center justify-center text-white/70 hover:text-white rounded-full hover:bg-white/5" onClick={() => setChatMode("none")}><ArrowLeft size={24} /></button>
              {chatMode === "broadcast" ? (<div className="flex-1 min-w-0"><h2 className="font-bold text-base md:text-lg tracking-wide truncate">Global Broadcast</h2><p className="text-[10px] md:text-xs text-white/40 truncate">Everyone can see these messages</p></div>) : (<div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0"><div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-[#121212] border border-white/10 flex items-center justify-center font-bold text-lg md:text-xl text-white/90 shrink-0">{selectedUser?.charAt(0).toUpperCase()}</div><div className="flex-1 min-w-0"><h2 className="font-bold text-base md:text-lg tracking-wide truncate">{selectedUser}</h2><p className="text-[10px] md:text-xs text-purple-400 flex items-center gap-1 truncate"><Lock size={10} className="shrink-0" /> <span className="truncate">End-to-End Encrypted</span></p></div></div>)}
            </div>
            <div className="flex items-center gap-0 md:gap-2 text-white/40 shrink-0">
              <button onClick={handleSummarize} className="w-9 h-9 md:w-11 md:h-11 flex items-center justify-center rounded-full hover:bg-white/5 text-purple-400 hover:text-purple-300 transition-colors shrink-0" title="Summarize Chat"><Sparkles size={18} /></button>
              {chatMode === "direct" && (
                <div className="flex items-center gap-0 md:gap-1">
                  <button onClick={async () => {
                    await fetch(`${API_URL}/users/block/${selectedUser}`, { method: 'POST', headers: { "Authorization": `Bearer ${token}` } });
                    setSystemAlert(`Blocked ${selectedUser}`);
                    setTimeout(() => setSystemAlert(null), 3000);
                  }} className="w-9 h-9 md:w-11 md:h-11 flex items-center justify-center rounded-full hover:bg-white/5 text-white/70 hover:text-white transition-colors shrink-0" title="Block User"><UserX size={18} /></button>
                  <button onClick={() => startCall(false)} className="w-9 h-9 md:w-11 md:h-11 flex items-center justify-center rounded-full hover:bg-white/5 text-white/70 hover:text-white transition-colors shrink-0"><Phone size={18} /></button>
                  <button onClick={() => startCall(true)} className="w-9 h-9 md:w-11 md:h-11 flex items-center justify-center rounded-full hover:bg-white/5 text-white/70 hover:text-white transition-colors shrink-0"><Video size={18} /></button>
                </div>
              )}
              <button onClick={handleClearChat} className="w-9 h-9 md:w-11 md:h-11 flex items-center justify-center rounded-full hover:bg-white/5 text-red-400 hover:text-red-300 transition-colors shrink-0" title="Clear Chat"><Trash2 size={18} /></button>
              <div className="w-9 h-9 md:w-11 md:h-11 flex items-center justify-center cursor-pointer hover:bg-white/5 rounded-full hover:text-white shrink-0"><Search size={18} /></div>
            </div>
          </div>

          {/* Active Call — Theater Mode */}
          {isCalling && (
            <div className={`relative bg-black overflow-hidden shrink-0 shadow-2xl transition-all duration-500 ${isCallFullscreen ? 'fixed inset-0 z-[200]' : 'h-[42%] min-h-[260px] border-b border-white/10'}`}>
              {/* Remote video (main view) */}
              <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
              {/* No-signal overlay */}
              {!remoteStream && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
                  <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mb-3 text-3xl font-bold">{selectedUser?.charAt(0).toUpperCase()}</div>
                  <p className="text-white/60 text-sm">Connecting…</p>
                </div>
              )}
              {/* Local PiP video (bottom-right) */}
              <div className="absolute bottom-4 right-4 w-28 h-40 md:w-36 md:h-52 bg-black rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl cursor-pointer" onClick={togglePiP} title="Pop out video">
                <video ref={localVideoRef} autoPlay playsInline muted className={`w-full h-full object-cover transition-all ${!isScreenSharing ? 'scale-x-[-1]' : ''} ${isCameraBlurred ? 'blur-md scale-110 brightness-90' : ''}`} />
              </div>
              {/* Screen share badge */}
              {isScreenSharing && (
                <div className="absolute top-4 left-4 bg-purple-600/90 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg">
                  <Monitor size={12} /> Sharing screen
                </div>
              )}
              {/* Recording badge */}
              {isRecordingCall && (
                <div className="absolute top-4 left-32 bg-red-600/90 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg animate-pulse">
                  <span className="w-2 h-2 bg-white rounded-full"></span> REC
                </div>
              )}
              {/* Controls bar */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 md:gap-3 bg-black/60 backdrop-blur-md rounded-full px-4 py-2.5 shadow-2xl border border-white/10">
                <button onClick={toggleAudio} title={isAudioMuted ? 'Unmute' : 'Mute'} className={`w-11 h-11 flex items-center justify-center rounded-full transition-all ${isAudioMuted ? 'bg-white text-black scale-95' : 'bg-white/10 text-white hover:bg-white/20'}`}>{isAudioMuted ? <MicOff size={18} /> : <Mic size={18} />}</button>
                <button onClick={toggleVideo} title={isVideoMuted ? 'Start video' : 'Stop video'} className={`w-11 h-11 flex items-center justify-center rounded-full transition-all ${isVideoMuted ? 'bg-white text-black scale-95' : 'bg-white/10 text-white hover:bg-white/20'}`}>{isVideoMuted ? <VideoOff size={18} /> : <Video size={18} />}</button>
                <button onClick={toggleScreenShare} title={isScreenSharing ? 'Stop sharing' : 'Share screen'} className={`w-11 h-11 flex items-center justify-center rounded-full transition-all ${isScreenSharing ? 'bg-purple-600 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}><Monitor size={18} /></button>
                <button onClick={() => setIsCameraBlurred(!isCameraBlurred)} title={isCameraBlurred ? 'Disable privacy blur' : 'Enable privacy blur'} className={`w-11 h-11 flex items-center justify-center rounded-full transition-all ${isCameraBlurred ? 'bg-purple-600 text-white scale-95' : 'bg-white/10 text-white hover:bg-white/20'}`}><EyeOff size={18} /></button>
                <button onClick={toggleCallRecording} title={isRecordingCall ? 'Stop recording' : 'Record call'} className={`w-11 h-11 flex items-center justify-center rounded-full transition-all ${isRecordingCall ? 'bg-red-600 text-white animate-pulse' : 'bg-white/10 text-white hover:bg-white/20'}`}><Download size={18} /></button>
                <button onClick={togglePiP} title="Picture-in-Picture" className="w-11 h-11 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-all"><Share2 size={18} /></button>
                <button onClick={() => setIsCallFullscreen(!isCallFullscreen)} title={isCallFullscreen ? 'Exit fullscreen' : 'Fullscreen'} className="w-11 h-11 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-all"><Forward size={18} /></button>
                <div className="w-px h-6 bg-white/20 mx-1"></div>
                <button onClick={endCall} title="End call" className="w-12 h-12 flex items-center justify-center rounded-full bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.6)] hover:bg-red-600 transition-colors"><PhoneOff size={20} /></button>
              </div>
            </div>
          )}


          <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 custom-scrollbar">
            <AnimatePresence>
              {messages.filter(m => (chatMode === "broadcast" && m.type === "broadcast") || (chatMode === "direct" && m.type === "direct" && (m.recipient === selectedUser || m.sender === selectedUser))).map((msg) => (
                <motion.div id={`msg-${msg.id}`} key={msg.id} initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className={`flex ${msg.sender === username ? "justify-end" : "justify-start"}`}>
                  <div className={`flex gap-3 max-w-[85%] md:max-w-[70%] ${msg.sender === username ? "flex-row-reverse" : "flex-row"}`}>
                    <div className="flex-shrink-0 mt-auto mb-1">{msg.sender === username && currentUser?.avatar_url ? (<img src={`${API_URL}${currentUser.avatar_url}`} className="w-8 h-8 rounded-full border border-white/10 object-cover" />) : (<div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${msg.sender === username ? 'bg-gradient-primary' : 'bg-[#1E1E1E]'}`}>{msg.sender.charAt(0).toUpperCase()}</div>)}</div>
                    <div className={`flex flex-col gap-1 ${msg.sender === username ? "items-end" : "items-start"}`}>
                      <div className="flex items-baseline gap-2 mx-1">
                        <span className="text-sm font-semibold text-white/90">{msg.sender === username ? "You" : msg.sender}</span>
                        <span className="text-[10px] text-white/40 flex items-center gap-1">
                          {msg.timestamp}
                          {msg.sender === username && (
                            <span className="inline-flex items-center">
                              {msg.status === 'pending' ? (
                                <span className="text-[10px] text-white/30">⏳</span>
                              ) : msg.status === 'read' ? (
                                <CheckCheck size={13} className="text-purple-400" />
                              ) : msg.status === 'delivered' ? (
                                <CheckCheck size={13} className="text-white/40" />
                              ) : (
                                <Check size={13} className="text-white/40" />
                              )}
                            </span>
                          )}
                          {msg.is_disappearing && <Lock size={8} className="inline text-white/30" />}
                        </span>
                      </div>
                      <div className={`px-5 py-3.5 shadow-sm relative group cursor-pointer ${msg.sender === username ? "bg-gradient-primary text-white rounded-3xl rounded-tr-sm" : "bg-[#2A2A2A] text-white/90 rounded-3xl rounded-tl-sm"}`}
                           onDoubleClick={() => handleReactToMessage(msg.id, "❤️")}>
                        {/* Reply Quote preview inside bubble */}
                        {msg.reply_to_username && (
                          <div className="mb-2 pl-3 py-1 border-l-2 border-purple-500 bg-white/5 rounded-r-lg text-xs cursor-pointer select-none text-left" onClick={() => {
                            const el = document.getElementById(`msg-${msg.reply_to_id}`);
                            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }}>
                            <div className="font-semibold text-purple-400">{msg.reply_to_username}</div>
                            <div className="text-white/60 truncate max-w-[200px]">{msg.reply_to_content}</div>
                          </div>
                        )}

                        {renderAttachment(msg.attachment_url)}
                        {msg.location_lat && msg.location_lng && (
                          <div className="w-48 h-32 bg-[#121212]/50 rounded-xl mb-2 flex items-center justify-center border border-white/10 overflow-hidden relative shadow-inner">
                            <Map className="absolute inset-0 w-full h-full text-white/10 p-4" />
                            <MapPin size={24} className="text-red-500 relative z-10" />
                            <span className="absolute bottom-2 right-2 text-[10px] font-mono bg-black/50 px-1.5 py-0.5 rounded text-white/70">{msg.location_lat.slice(0, 7)}, {msg.location_lng.slice(0, 7)}</span>
                          </div>
                        )}
                        {msg.content && (
                          <>
                            <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">{parseMarkdown(msg.content)}</p>
                            {msg.content.match(/(https?:\/\/[^\s]+)/g)?.map((url: string, index: number) => (
                              <LinkPreview key={index} url={url} />
                            ))}
                          </>
                        )}
                        
                        {msg.reactions && msg.reactions.length > 0 && (
                          <div className="absolute -bottom-3 right-4 flex items-center gap-1 bg-[#1E1E1E] border border-white/10 rounded-full px-2 py-0.5 shadow-md z-10">
                            {Array.from(new Set(msg.reactions.map((r: any) => r.emoji))).map((emoji: any) => (
                              <span key={emoji} className="text-xs">{emoji}</span>
                            ))}
                            {msg.reactions.length > 1 && <span className="text-[10px] text-white/50 ml-0.5">{msg.reactions.length}</span>}
                          </div>
                        )}
                        
                        {/* Hover React / Action Menu */}
                        <div className="absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-[#1E1E1E] border border-white/10 rounded-full px-3 py-1.5 shadow-lg flex items-center gap-2 z-20"
                             style={{ [msg.sender === username ? 'left' : 'right']: '-115px' }}>
                          <button onClick={() => handleReactToMessage(msg.id, "👍")} className="hover:scale-125 transition-transform text-sm">👍</button>
                          <button onClick={() => handleReactToMessage(msg.id, "❤️")} className="hover:scale-125 transition-transform text-sm">❤️</button>
                          <div className="w-px h-3 bg-white/10 mx-0.5"></div>
                          <button onClick={() => setReplyingTo({ id: msg.id, sender: msg.sender, content: msg.content })} title="Reply" className="hover:scale-125 transition-transform text-white/50 hover:text-white"><Reply size={13} /></button>
                          <button onClick={() => setForwardMessage(msg)} title="Forward" className="hover:scale-125 transition-transform text-white/50 hover:text-white"><Forward size={13} /></button>
                        </div>
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
              <div ref={messagesEndRef} />
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
            <AnimatePresence>
              {replyingTo && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="mx-4 md:mx-8 mb-2 p-3 bg-white/[0.04] backdrop-blur-2xl rounded-2xl border border-white/10 flex justify-between items-center relative z-20">
                  <div className="pl-3 border-l-2 border-purple-500 text-xs text-left">
                    <span className="font-semibold text-purple-400">Replying to {replyingTo.sender}</span>
                    <p className="text-white/60 truncate max-w-[250px] sm:max-w-[400px]">{replyingTo.content || "Attachment"}</p>
                  </div>
                  <button type="button" onClick={() => setReplyingTo(null)} className="text-white/40 hover:text-white p-1 rounded-full hover:bg-white/5 transition-colors">
                    <X size={16} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
            <form onSubmit={handleSendMessage} className="pb-6 pt-2 bg-gradient-to-t from-[#080808] via-[#080808]/80 to-transparent relative z-10">
              <div className="mx-4 md:mx-8 mb-6 relative bg-white/[0.04] backdrop-blur-2xl rounded-[2rem] border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
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
                
                <button type="button" onClick={handleShareLocation} className="w-11 h-11 flex items-center justify-center text-white/40 hover:text-white transition-colors hidden sm:flex rounded-full hover:bg-white/5" title="Share Location"><MapPin size={20} /></button>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="w-11 h-11 flex items-center justify-center text-white/40 hover:text-white transition-colors hidden sm:flex rounded-full hover:bg-white/5" title="Attach File"><Paperclip size={20} /></button>
                <button type="button" onClick={toggleRecording} className={`w-11 h-11 flex items-center justify-center transition-colors hidden sm:flex rounded-full hover:bg-white/5 ${isRecording ? "text-red-500 animate-pulse bg-red-500/10" : "text-white/40 hover:text-white"}`} title="Voice Note"><Mic size={20} /></button>
                <button type="button" onClick={() => setIsDisappearingChat(!isDisappearingChat)} className={`w-11 h-11 flex items-center justify-center transition-colors hidden sm:flex rounded-full hover:bg-white/5 ${isDisappearingChat ? "text-purple-400 bg-purple-500/10 shadow-[0_0_10px_rgba(168,85,247,0.3)]" : "text-white/40 hover:text-white"}`} title="24h Disappearing Messages"><Lock size={18} /></button>
                <button type="button" onClick={handleSendMessage} disabled={!inputMessage.trim() && !attachmentFile} className={`ml-1 px-5 py-2.5 rounded-full flex items-center gap-2 font-medium transition-all ${(inputMessage.trim() || attachmentFile) ? "bg-gradient-primary glow-primary text-white scale-100" : "bg-white/5 text-white/30 scale-95"}`}>Send <span className={(inputMessage.trim() || attachmentFile) ? "translate-x-0.5 transition-transform" : ""}>→</span></button>
              </div>
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
                
                <div className="pt-4 border-t border-white/10 space-y-4">
                  <h3 className="text-sm font-bold text-white/50 uppercase tracking-wider mb-2">Privacy & Contacts</h3>
                  
                  <button type="button" onClick={handleSyncContacts} className="w-full bg-white/5 hover:bg-white/10 border border-white/10 py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors">
                    {isSyncingContacts ? <span className="animate-spin text-purple-400">⏳</span> : <UserPlus size={18} className="text-purple-400" />}
                    Sync Phone Contacts
                  </button>

                  <label className="flex items-center justify-between cursor-pointer group">
                    <div className="flex flex-col">
                      <span className="font-medium text-[15px]">Require Message Requests</span>
                      <span className="text-xs text-white/40">Unknown users must send a request first</span>
                    </div>
                    <div className={`w-12 h-6 rounded-full p-1 transition-colors ${privacySettings.requireMessageRequests ? 'bg-purple-600' : 'bg-white/10'}`}>
                      <input type="checkbox" className="hidden" checked={privacySettings.requireMessageRequests} onChange={(e) => setPrivacySettings(prev => ({...prev, requireMessageRequests: e.target.checked}))} />
                      <div className={`w-4 h-4 bg-white rounded-full transition-transform ${privacySettings.requireMessageRequests ? 'translate-x-6' : 'translate-x-0'}`}></div>
                    </div>
                  </label>

                  <label className="flex items-center justify-between cursor-pointer group">
                    <div className="flex flex-col">
                      <span className="font-medium text-[15px]">Hide Phone Number</span>
                      <span className="text-xs text-white/40">Prevent others from seeing your number</span>
                    </div>
                    <div className={`w-12 h-6 rounded-full p-1 transition-colors ${privacySettings.hidePhoneNumber ? 'bg-purple-600' : 'bg-white/10'}`}>
                      <input type="checkbox" className="hidden" checked={privacySettings.hidePhoneNumber} onChange={(e) => setPrivacySettings(prev => ({...prev, hidePhoneNumber: e.target.checked}))} />
                      <div className={`w-4 h-4 bg-white rounded-full transition-transform ${privacySettings.hidePhoneNumber ? 'translate-x-6' : 'translate-x-0'}`}></div>
                    </div>
                  </label>
                </div>
                <div className="flex gap-3 mt-8"><button type="button" onClick={() => setShowProfileModal(false)} className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 font-medium text-white/80 transition-colors">Cancel</button><button type="submit" className="flex-1 py-3 rounded-xl bg-gradient-primary glow-primary active:scale-95 font-medium transition-transform">Save Changes</button></div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Forward Message Modal */}
      <AnimatePresence>
        {forwardMessage && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setForwardMessage(null)}></div>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-[#1E1E1E] relative rounded-3xl p-6 w-full max-w-sm shadow-2xl z-10 border border-white/10">
              <h3 className="text-lg font-bold mb-4">Forward message to...</h3>
              <div className="max-h-[300px] overflow-y-auto space-y-2 custom-scrollbar pr-1">
                {/* Broadcast / general channel */}
                <button onClick={() => handleForwardTo(null)} className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/5 border border-white/5 transition-colors text-left">
                  <div>
                    <div className="font-semibold text-sm">Global Broadcast</div>
                    <div className="text-xs text-white/40">Send to all users</div>
                  </div>
                  <Forward size={16} className="text-purple-400" />
                </button>

                {/* Connections */}
                {connections.map((friend: any) => (
                  <button key={friend.id} onClick={() => handleForwardTo(friend.username)} className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/5 border border-white/5 transition-colors text-left">
                    <div>
                      <div className="font-semibold text-sm">{friend.username}</div>
                    </div>
                    <Forward size={16} className="text-purple-400" />
                  </button>
                ))}
              </div>
              <button onClick={() => setForwardMessage(null)} className="w-full mt-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 font-medium transition-colors text-center text-sm">Cancel</button>
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
