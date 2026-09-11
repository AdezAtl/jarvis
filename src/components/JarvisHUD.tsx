import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Send,
  Eye,
  Volume2,
  VolumeX,
  Play,
  SkipForward,
  Settings,
  Minimize2,
  Terminal,
  Activity,
  Layers,
  Globe,
  Radio,
  Music,
  Cpu,
  ChevronDown,
} from 'lucide-react';
import { animate } from 'animejs';
import { AudioVisualizer } from './AudioVisualizer';
import { TelemetryRadar } from './TelemetryRadar';
import { WeatherWidget } from './WeatherWidget';
import { SystemMetrics } from '../types/electron';
import { jarvisAudio } from '../services/soundEffects';
import { LogEntry } from '../App';

export const AVAILABLE_MODELS = [
  { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', provider: 'groq' as const, badge: '⚡ 70B' },
  { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B', provider: 'groq' as const, badge: '🚀 8B' },
  { id: 'deepseek-r1-distill-llama-70b', label: 'DeepSeek R1 70B', provider: 'groq' as const, badge: '🧠 R1' },
  { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash', provider: 'gemini' as const, badge: '✨ 3.6' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', provider: 'gemini' as const, badge: '⚡ 2.0' },
  { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', provider: 'gemini' as const, badge: '1.5' },
];

interface JarvisHUDProps {
  onCollapse: () => void;
  onOpenSettings: () => void;
  metrics: SystemMetrics | null;
  analyserNode: AnalyserNode | null;
  isAudioActive: boolean;
  onStartListening: () => void;
  onStopListening: () => void;
  logs: LogEntry[];
  onAddLog: (
    sender: 'user' | 'jarvis' | 'system',
    text: string,
    toolDetails?: { name: string; result?: string }
  ) => void;
  onClearLogs: () => void;
}

export const JarvisHUD: React.FC<JarvisHUDProps> = ({
  onCollapse,
  onOpenSettings,
  metrics,
  analyserNode,
  isAudioActive,
  onStartListening,
  onStopListening,
  logs,
  onAddLog,
  onClearLogs,
}) => {
  const addLog = onAddLog;
  const [inputPrompt, setInputPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCapturingScreen, setIsCapturingScreen] = useState(false);
  const [previewScreen, setPreviewScreen] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState('');
  const [systemVolume, setSystemVolume] = useState(70);
  const [isMuted, setIsMuted] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(jarvisAudio.getMuted());
  const [activeModel, setActiveModel] = useState<string>('llama-3.3-70b-versatile');
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);

  const toggleAudioMute = () => {
    const next = jarvisAudio.toggleMute();
    setIsAudioMuted(next);
  };

  useEffect(() => {
    const saved = localStorage.getItem('jarvis_selected_model');
    if (saved) {
      setActiveModel(saved);
      if (window.electronAPI?.setModel) {
        const found = AVAILABLE_MODELS.find((m) => m.id === saved);
        window.electronAPI.setModel(saved, found?.provider);
      }
    } else if (window.electronAPI?.getModelConfig) {
      window.electronAPI.getModelConfig().then((cfg) => {
        if (cfg?.model) {
          setActiveModel(cfg.model);
        }
      });
    }
  }, []);

  const handleModelSwitch = async (model: typeof AVAILABLE_MODELS[0]) => {
    setActiveModel(model.id);
    setIsModelDropdownOpen(false);
    jarvisAudio.playChirp();
    try {
      localStorage.setItem('jarvis_selected_model', model.id);
    } catch {}
    if (window.electronAPI?.setModel) {
      await window.electronAPI.setModel(model.id, model.provider);
    }
    addLog('system', `Neural core switched to ${model.label} [${model.provider.toUpperCase()}]. Ready, sir.`);
  };

  const logContainerRef = useRef<HTMLDivElement | null>(null);

  // Sci-Fi HUD Outline Drawing via Anime.js on Mount
  useEffect(() => {
    try {
      const paths = document.querySelectorAll<SVGPathElement>('.hud-anime-path');
      paths.forEach((path) => {
        const length = path.getTotalLength ? path.getTotalLength() : 800;
        path.style.strokeDasharray = `${length}`;
        path.style.strokeDashoffset = `${length}`;
      });

      animate('.hud-anime-path', {
        strokeDashoffset: 0,
        opacity: [0.1, 1],
        duration: 950,
        delay: (_el: any, i: number) => i * 65,
        ease: 'inOutSine',
      });
    } catch (err) {
      console.warn('Anime.js outline animation notice:', err);
    }
  }, []);

  // Live Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleSend = async (customText?: string, useVision = false) => {
    const query = (customText ?? inputPrompt).trim();
    if (!query) return;

    jarvisAudio.playChirp();
    setInputPrompt('');
    addLog('user', query);
    setIsProcessing(true);

    if (useVision) {
      setIsCapturingScreen(true);
    }

    try {
      if (window.electronAPI) {
        const response = await window.electronAPI.sendPrompt(query, useVision);
        addLog(
          'jarvis',
          response.text,
          response.toolCall ? { name: response.toolCall.name, result: response.toolCall.result } : undefined
        );
        jarvisAudio.playSuccess();
        jarvisAudio.speak(response.text);
      } else {
        setTimeout(() => {
          const simText = `Simulated response to "${query}". Systems fully operational, sir.`;
          addLog('jarvis', simText);
          jarvisAudio.playSuccess();
          jarvisAudio.speak(simText);
        }, 600);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      addLog('system', `Error: ${errorMsg}`);
    } finally {
      setIsProcessing(false);
      setIsCapturingScreen(false);
    }
  };

  const handleVolumeChange = async (vol: number) => {
    setSystemVolume(vol);
    setIsMuted(vol === 0);
    if (window.electronAPI) {
      const res = await window.electronAPI.adjustVolume(vol, true);
      addLog('system', res);
    }
  };

  const handleMedia = async (action: 'play_pause' | 'next' | 'prev') => {
    jarvisAudio.playChirp();
    if (window.electronAPI) {
      const res = await window.electronAPI.controlMedia(action);
      addLog('system', res);
    }
  };

  const handleQuickLaunch = async (target: string) => {
    jarvisAudio.playChirp();
    if (window.electronAPI) {
      const res = await window.electronAPI.launchApp(target);
      addLog('system', res);
    }
  };

  const handleScreenVisionInspect = async () => {
    try {
      setIsCapturingScreen(true);
      if (window.electronAPI) {
        const screen = await window.electronAPI.captureScreen();
        setPreviewScreen(screen.dataUrl);
        await handleSend('Inspect this screen and describe key open tasks or any items needing attention.', true);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      addLog('system', `Screen capture failed: ${errorMsg}`);
    } finally {
      setIsCapturingScreen(false);
    }
  };

  return (
    <div className="relative w-[1040px] h-[680px] rounded-2xl hud-panel border border-cyan-400/40 p-5 flex flex-col justify-between overflow-hidden shadow-[0_0_40px_rgba(0,240,255,0.2)] select-none">
      {/* Sci-Fi Animated Outline Drawing Overlay (Anime.js) */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none z-10"
        viewBox="0 0 1040 680"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Outer Perimeter Futuristic Beveled Frame */}
        <path
          className="hud-anime-path"
          d="M 28 10 L 1012 10 L 1030 28 L 1030 652 L 1012 670 L 28 670 L 10 652 L 10 28 Z"
          stroke="rgba(0, 240, 255, 0.75)"
          strokeWidth="1.5"
        />

        {/* Top-Left Corner Tactical Crosshairs */}
        <path
          className="hud-anime-path"
          d="M 6 42 L 6 14 L 42 14"
          stroke="rgba(0, 255, 230, 0.95)"
          strokeWidth="2.5"
        />
        <path
          className="hud-anime-path"
          d="M 14 6 L 42 6"
          stroke="rgba(0, 240, 255, 0.5)"
          strokeWidth="1"
        />

        {/* Top-Right Corner Tactical Crosshairs */}
        <path
          className="hud-anime-path"
          d="M 998 14 L 1034 14 L 1034 42"
          stroke="rgba(0, 255, 230, 0.95)"
          strokeWidth="2.5"
        />
        <path
          className="hud-anime-path"
          d="M 998 6 L 1026 6"
          stroke="rgba(0, 240, 255, 0.5)"
          strokeWidth="1"
        />

        {/* Bottom-Left Corner Tactical Crosshairs */}
        <path
          className="hud-anime-path"
          d="M 6 638 L 6 666 L 42 666"
          stroke="rgba(0, 255, 230, 0.95)"
          strokeWidth="2.5"
        />

        {/* Bottom-Right Corner Tactical Crosshairs */}
        <path
          className="hud-anime-path"
          d="M 998 666 L 1034 666 L 1034 638"
          stroke="rgba(0, 255, 230, 0.95)"
          strokeWidth="2.5"
        />

        {/* Header Dividing Neon Line */}
        <path
          className="hud-anime-path"
          d="M 20 68 L 1020 68"
          stroke="rgba(0, 240, 255, 0.45)"
          strokeWidth="1"
          strokeDasharray="6 3"
        />

        {/* Console Panel Sub-division Accents */}
        <path
          className="hud-anime-path"
          d="M 292 84 L 292 602"
          stroke="rgba(0, 240, 255, 0.35)"
          strokeWidth="1"
        />
      </svg>

      {/* Decorative Grid Corner Brackets */}
      <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-cyan-400 pointer-events-none" />
      <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-cyan-400 pointer-events-none" />
      <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-cyan-400 pointer-events-none" />
      <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-cyan-400 pointer-events-none" />

      {/* Top Header Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-cyan-500/20 app-drag">
        {/* Left: Brand / Title */}
        <div className="flex items-center gap-3">
          <div className="status-indicator" />
          <div>
            <div className="flex items-baseline gap-2">
              <h1 className="font-display text-xl font-bold text-cyan-300 text-glow tracking-wider">
                J.A.R.V.I.S.
              </h1>
              <span className="font-mono text-[10px] text-cyan-400 tracking-widest">
                // MK-VII
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-sans tracking-wider">
              JUST A RATHER VERY INTELLIGENT SYSTEM // SYSTEM CONSOLE
            </p>
          </div>
        </div>

        {/* Center: Live Digital Clock & Status */}
        <div className="flex items-center gap-3">
          <div className="font-mono text-xs text-cyan-300 tracking-widest bg-slate-950/80 px-3 py-1 rounded border border-cyan-500/30">
            {currentTime || '00:00:00'}
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-cyan-950/40 border border-cyan-500/30 text-[10px] font-mono text-cyan-300">
            <Radio size={10} className="text-cyan-400 animate-pulse" />
            <span>ONLINE // TELEMETRY SYNCED</span>
          </div>
        </div>

        {/* Right: Window & Configuration Controls */}
        <div className="flex items-center gap-2 app-no-drag">
          <button
            onClick={toggleAudioMute}
            className={`p-1.5 rounded-lg border transition-colors bg-slate-950/70 ${
              isAudioMuted
                ? 'border-amber-500/50 text-amber-400 hover:text-amber-200 hover:border-amber-300'
                : 'border-cyan-500/30 text-cyan-400 hover:text-cyan-200 hover:border-cyan-400 hover:bg-cyan-500/10'
            }`}
            title={isAudioMuted ? 'Unmute J.A.R.V.I.S. Audio & Voice' : 'Mute J.A.R.V.I.S. Audio & Voice'}
          >
            {isAudioMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
          <button
            onClick={onOpenSettings}
            className="p-1.5 rounded-lg border border-cyan-500/30 text-cyan-400 hover:text-cyan-200 hover:border-cyan-400 hover:bg-cyan-500/10 transition-colors bg-slate-950/70"
            title="Settings & Gemini API Key"
          >
            <Settings size={15} />
          </button>
          <button
            onClick={onCollapse}
            className="p-1.5 rounded-lg border border-cyan-500/30 text-cyan-400 hover:text-cyan-200 hover:border-cyan-400 hover:bg-cyan-500/10 transition-colors bg-slate-950/70"
            title="Collapse to Floating Orb (Alt+J)"
          >
            <Minimize2 size={15} />
          </button>
        </div>
      </div>

      {/* Main 3-Column Dashboard Body */}
      <div className="grid grid-cols-12 gap-4 h-[580px] max-h-[580px] pt-1 overflow-hidden app-no-drag">
        {/* ================= COLUMN 1: SENSORS & TELEMETRY (w-72 / 3 cols) ================= */}
        <div className="col-span-3 h-full min-h-0 flex flex-col gap-3 justify-between overflow-hidden">
          {/* Weather Widget */}
          <WeatherWidget />

          {/* Hardware Telemetry Radar */}
          <TelemetryRadar metrics={metrics} />

          {/* Core System Specs Banner */}
          <div className="p-3 rounded-xl hud-panel border border-cyan-500/20 text-[10px] font-mono text-slate-400 flex flex-col gap-1">
            <div className="flex justify-between text-cyan-400 font-bold">
              <span>HOST OPERATING SYSTEM</span>
              <span>WIN32 / X64</span>
            </div>
            <div className="flex justify-between">
              <span>WINDOW MANAGER</span>
              <span className="text-cyan-300">DWM ACCELERATED</span>
            </div>
            <div className="flex justify-between">
              <span>GLOBAL HOTKEY</span>
              <span className="text-cyan-300">ALT + J</span>
            </div>
          </div>
        </div>

        {/* ================= COLUMN 2: ARC REACTOR & CONTROLS (5 cols) ================= */}
        <div className="col-span-5 h-full min-h-0 flex flex-col justify-between items-center px-2 overflow-hidden">
          {/* Reactor Container with Rotating Sci-Fi Rings */}
          <div className="relative w-64 h-64 flex items-center justify-center my-auto">
            {/* Concentric rotating tech rings */}
            <div className="absolute inset-0 rounded-full border border-dashed border-cyan-500/25 animate-spin-slow pointer-events-none" />
            <div className="absolute inset-4 rounded-full border-2 border-t-cyan-400 border-r-transparent border-b-cyan-500/30 border-l-transparent animate-spin-reverse-slow pointer-events-none" />
            <div className="absolute inset-8 rounded-full border border-cyan-400/20 pointer-events-none" />

            {/* Audio Waveform Canvas */}
            <div className="relative z-10">
              <AudioVisualizer analyserNode={analyserNode} isActive={isAudioActive} size={210} />
            </div>

            {/* Center Core Reactor Button */}
            <button
              onClick={isAudioActive ? onStopListening : onStartListening}
              className={`absolute z-20 w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 ${
                isAudioActive
                  ? 'bg-emerald-500/20 border-2 border-emerald-400 shadow-[0_0_25px_#10b981]'
                  : 'bg-slate-950/90 border-2 border-cyan-400 shadow-[0_0_20px_#00f0ff] hover:scale-105'
              }`}
              title={isAudioActive ? 'Stop Listening' : 'Click to Speak'}
            >
              {isAudioActive ? (
                <Mic size={22} className="text-emerald-300 animate-pulse" />
              ) : (
                <Activity size={22} className={`text-cyan-300 ${isProcessing ? 'animate-spin' : ''}`} />
              )}
            </button>
          </div>

          {/* Voice Prompt Status */}
          <div className="text-center my-1">
            <p className="font-mono text-xs text-cyan-300 tracking-wider">
              {isAudioActive ? 'LISTENING FOR VOICE INSTRUCTION...' : 'VOICE ENGINE READY // CLICK MIC TO SPEAK'}
            </p>
          </div>

          {/* Quick System Action Docks */}
          <div className="w-full p-3 rounded-xl hud-panel border border-cyan-500/25 flex flex-col gap-2.5">
            <div className="flex items-center justify-between text-[11px] font-mono text-cyan-400 border-b border-cyan-500/20 pb-1.5">
              <span>SYSTEM QUICK DOCKS</span>
              <span className="text-slate-400">WIN32 API</span>
            </div>

            {/* Volume Control Bar */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleVolumeChange(isMuted ? 50 : 0)}
                className="text-cyan-400 hover:text-cyan-200 transition-colors"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <input
                type="range"
                min="0"
                max="100"
                value={systemVolume}
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                className="w-full accent-cyan-400 h-1.5 bg-slate-900 rounded-lg cursor-pointer"
              />
              <span className="font-mono text-xs text-cyan-300 w-8 text-right">
                {systemVolume}%
              </span>
            </div>

            {/* Media Player Controls */}
            <div className="flex items-center justify-between pt-1 border-t border-cyan-500/10">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleMedia('prev')}
                  className="p-1 rounded hover:bg-cyan-500/20 text-cyan-400 transition-colors"
                  title="Previous Track"
                >
                  <SkipForward size={14} className="rotate-180" />
                </button>
                <button
                  onClick={() => handleMedia('play_pause')}
                  className="p-1.5 rounded-full bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 transition-colors border border-cyan-400/40"
                  title="Play / Pause"
                >
                  <Play size={14} />
                </button>
                <button
                  onClick={() => handleMedia('next')}
                  className="p-1 rounded hover:bg-cyan-500/20 text-cyan-400 transition-colors"
                  title="Next Track"
                >
                  <SkipForward size={14} />
                </button>
              </div>

              {/* Mic Toggle Button */}
              <button
                onClick={isAudioActive ? onStopListening : onStartListening}
                className={`p-2 rounded-full border transition-all duration-300 flex items-center justify-center ${
                  isAudioActive
                    ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-pulse'
                    : 'border-cyan-500/30 bg-slate-950/70 text-cyan-400 hover:border-cyan-400 hover:bg-cyan-500/10'
                }`}
                title={isAudioActive ? 'Stop Listening' : 'Start Voice Input'}
              >
                {isAudioActive ? <MicOff size={15} /> : <Mic size={15} />}
              </button>
            </div>

            {/* Quick App Launch Icons */}
            <div className="grid grid-cols-4 gap-2 pt-1 border-t border-cyan-500/10">
              <button
                onClick={() => handleQuickLaunch('chrome')}
                className="flex items-center justify-center gap-1 py-1.5 px-2 rounded bg-slate-950/70 border border-cyan-500/20 text-cyan-300 hover:border-cyan-400 hover:bg-cyan-500/10 transition-colors text-[10px] font-mono"
              >
                <Globe size={11} /> CHROME
              </button>
              <button
                onClick={() => handleQuickLaunch('spotify')}
                className="flex items-center justify-center gap-1 py-1.5 px-2 rounded bg-slate-950/70 border border-cyan-500/20 text-cyan-300 hover:border-cyan-400 hover:bg-cyan-500/10 transition-colors text-[10px] font-mono"
              >
                <Music size={11} /> SPOTIFY
              </button>
              <button
                onClick={() => handleQuickLaunch('terminal')}
                className="flex items-center justify-center gap-1 py-1.5 px-2 rounded bg-slate-950/70 border border-cyan-500/20 text-cyan-300 hover:border-cyan-400 hover:bg-cyan-500/10 transition-colors text-[10px] font-mono"
              >
                <Terminal size={11} /> TERMINAL
              </button>
              <button
                onClick={() => handleQuickLaunch('taskmgr')}
                className="flex items-center justify-center gap-1 py-1.5 px-2 rounded bg-slate-950/70 border border-cyan-500/20 text-cyan-300 hover:border-cyan-400 hover:bg-cyan-500/10 transition-colors text-[10px] font-mono"
              >
                <Layers size={11} /> TASKS
              </button>
            </div>
          </div>
        </div>

        {/* ================= COLUMN 3: NEURAL TERMINAL & VISION (4 cols) ================= */}
        <div className="col-span-4 h-full min-h-0 flex flex-col gap-2.5 overflow-hidden">
          {/* Terminal Header & Screen Vision Bar */}
          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/70 border border-cyan-500/25 text-xs font-mono shrink-0 relative z-30">
            {/* Interactive Model Switcher Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-900/90 border border-cyan-500/40 text-cyan-300 hover:border-cyan-300 hover:bg-cyan-500/15 transition-all text-[10px] font-mono tracking-wide"
                title="Click to switch AI Model & Provider"
              >
                <Cpu size={12} className="text-cyan-400 animate-pulse" />
                <span className="font-bold text-cyan-200">
                  {AVAILABLE_MODELS.find((m) => m.id === activeModel)?.label || activeModel}
                </span>
                <span
                  className={`px-1 rounded text-[8px] font-bold ${
                    AVAILABLE_MODELS.find((m) => m.id === activeModel)?.provider === 'groq'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  }`}
                >
                  {AVAILABLE_MODELS.find((m) => m.id === activeModel)?.provider.toUpperCase() || 'AI'}
                </span>
                <ChevronDown
                  size={11}
                  className={`text-cyan-400 transition-transform ${isModelDropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Dropdown Menu */}
              {isModelDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-slate-950/98 border border-cyan-500/50 rounded-xl shadow-[0_0_30px_rgba(0,240,255,0.35)] p-2 z-50 backdrop-blur-md space-y-1.5 font-mono">
                  <div className="text-[9px] text-amber-400/90 font-bold px-1.5 uppercase tracking-wider flex items-center gap-1">
                    <span>⚡ GROQ LPUs (Ultra-Fast)</span>
                  </div>
                  {AVAILABLE_MODELS.filter((m) => m.provider === 'groq').map((m) => (
                    <button
                      key={m.id}
                      onClick={() => handleModelSwitch(m)}
                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-left transition-colors text-[10px] ${
                        activeModel === m.id
                          ? 'bg-amber-500/20 border border-amber-400/60 text-amber-200 font-bold'
                          : 'hover:bg-slate-900 text-slate-300 hover:text-cyan-200'
                      }`}
                    >
                      <span>{m.label}</span>
                      <span className="text-[8px] px-1 py-0.5 rounded bg-amber-950/60 border border-amber-500/30 text-amber-300">
                        {m.badge}
                      </span>
                    </button>
                  ))}

                  <div className="text-[9px] text-cyan-400/90 font-bold px-1.5 pt-1 uppercase tracking-wider border-t border-cyan-500/20 flex items-center gap-1">
                    <span>✨ GOOGLE GEMINI</span>
                  </div>
                  {AVAILABLE_MODELS.filter((m) => m.provider === 'gemini').map((m) => (
                    <button
                      key={m.id}
                      onClick={() => handleModelSwitch(m)}
                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-left transition-colors text-[10px] ${
                        activeModel === m.id
                          ? 'bg-cyan-500/20 border border-cyan-400/60 text-cyan-200 font-bold'
                          : 'hover:bg-slate-900 text-slate-300 hover:text-cyan-200'
                      }`}
                    >
                      <span>{m.label}</span>
                      <span className="text-[8px] px-1 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/30 text-cyan-300">
                        {m.badge}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={onClearLogs}
                className="px-2 py-1 rounded bg-slate-900/80 border border-slate-700/50 text-slate-400 hover:text-cyan-300 hover:border-cyan-500/40 transition-colors text-[10px] font-mono"
                title="Clear conversation history"
              >
                CLEAR
              </button>
              <button
                onClick={handleScreenVisionInspect}
                disabled={isCapturingScreen}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-cyan-500/15 border border-cyan-400/50 text-cyan-300 hover:bg-cyan-500/25 transition-colors text-[10px] font-mono"
              >
                <Eye size={11} className={isCapturingScreen ? 'animate-pulse text-amber-400' : 'text-cyan-400'} />
                <span>{isCapturingScreen ? 'SCANNING...' : 'SCAN SCREEN'}</span>
              </button>
            </div>
          </div>

          {/* Screenshot Preview Strip if captured */}
          {previewScreen && (
            <div className="p-2 rounded bg-slate-950/90 border border-cyan-500/30 flex items-center justify-between text-[10px] font-mono text-cyan-300 shrink-0">
              <span className="flex items-center gap-1">
                <Eye size={10} /> SCREEN BUFFER ATTACHED
              </span>
              <button
                onClick={() => setPreviewScreen(null)}
                className="text-slate-400 hover:text-cyan-300 transition-colors"
              >
                DISMISS
              </button>
            </div>
          )}

          {/* Chat Feed Scroll Area */}
          <div
            ref={logContainerRef}
            className="flex-1 min-h-0 rounded-xl bg-slate-950/85 border border-cyan-500/30 p-3 overflow-y-auto font-mono text-[11px] space-y-2.5 select-text break-words"
          >
            {logs.map((log) => {
              const isJarvis = log.sender === 'jarvis';
              const isUser = log.sender === 'user';
              return (
                <div
                  key={log.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-1.5 text-[9px] text-cyan-500/70 mb-0.5 font-bold">
                    <Terminal size={9} />
                    <span>{log.sender.toUpperCase()}</span>
                    <span>[{log.time}]</span>
                  </div>
                  <div
                    className={`px-3 py-2 rounded-lg max-w-[95%] leading-relaxed break-words break-all whitespace-pre-wrap overflow-hidden ${
                      isUser
                        ? 'bg-cyan-950/70 text-cyan-200 border border-cyan-400/40'
                        : isJarvis
                        ? 'bg-slate-900/90 text-cyan-300 border border-cyan-500/20'
                        : 'bg-amber-950/40 text-amber-300 border border-amber-500/30 text-[10px]'
                    }`}
                  >
                    {log.text}
                  </div>
                  {log.toolDetails && (
                    <div className="mt-1 text-[9px] text-amber-300 font-mono px-2 py-0.5 rounded bg-amber-950/50 border border-amber-500/40 break-words break-all">
                      ⚡ EXECUTED [{log.toolDetails.name}]: {log.toolDetails.result}
                    </div>
                  )}
                </div>
              );
            })}
            {isProcessing && (
              <div className="text-[10px] text-cyan-400/90 animate-pulse flex items-center gap-1.5">
                <Activity size={12} className="animate-spin text-cyan-400" />
                <span>Synthesizing neural telemetry...</span>
              </div>
            )}
          </div>

          {/* Bottom Command Bar */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Instruct J.A.R.V.I.S. (e.g. 'Set volume 40%', 'Launch Spotify')..."
                className="w-full bg-slate-950/90 border border-cyan-500/40 rounded-lg px-3 py-2 text-xs text-cyan-200 placeholder-cyan-600/60 font-mono focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_12px_#00f0ff]"
              />
            </div>

            <button
              onClick={isAudioActive ? onStopListening : onStartListening}
              className={`p-2 rounded-lg border transition-all ${
                isAudioActive
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-[0_0_12px_#10b981]'
                  : 'bg-slate-950/90 border-cyan-500/40 text-cyan-400 hover:border-cyan-400'
              }`}
              title={isAudioActive ? 'Mute Mic' : 'Voice Input'}
            >
              {isAudioActive ? <Mic size={16} /> : <MicOff size={16} />}
            </button>

            <button
              onClick={() => handleSend()}
              disabled={isProcessing}
              className="p-2 rounded-lg bg-cyan-500/20 border border-cyan-400 text-cyan-300 hover:bg-cyan-500/30 transition-all shadow-[0_0_10px_#00f0ff] disabled:opacity-50"
              title="Transmit"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
