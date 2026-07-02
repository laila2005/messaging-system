const fs = require('fs');
let code = fs.readFileSync('g:/messaging system/frontend/src/app/page.tsx', 'utf8');

const audioPlayerComponent = `
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
`;

if (!code.includes('const AudioPlayer')) {
    code = code.replace('export default function ChatApp() {', audioPlayerComponent + '\nexport default function ChatApp() {\n  const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\\/$/, "") || "http://localhost:8000";\n  const WS_URL = API_URL.replace("http", "ws");\n');
}

fs.writeFileSync('g:/messaging system/frontend/src/app/page.tsx', code);
console.log("Fixed!");
