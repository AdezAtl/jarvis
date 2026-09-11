import React, { useState, useEffect } from 'react';
import { X, Key, ShieldCheck, Zap, Cpu, ExternalLink } from 'lucide-react';
import { AVAILABLE_MODELS } from './JarvisHUD';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [groqApiKey, setGroqApiKey] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('openai/gpt-oss-120b');
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && window.electronAPI) {
      if (window.electronAPI.getModelConfig) {
        window.electronAPI.getModelConfig().then((cfg) => {
          if (cfg) {
            setGroqApiKey(cfg.groqApiKey || '');
            setGeminiApiKey(cfg.geminiApiKey || '');
            if (cfg.model) setSelectedModel(cfg.model);
          }
        });
      } else {
        if (window.electronAPI.getApiKey) {
          window.electronAPI.getApiKey().then((k) => setGeminiApiKey(k || ''));
        }
        if (window.electronAPI.getGroqApiKey) {
          window.electronAPI.getGroqApiKey().then((k) => setGroqApiKey(k || ''));
        }
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (window.electronAPI) {
      if (window.electronAPI.setGroqApiKey) {
        await window.electronAPI.setGroqApiKey(groqApiKey);
      }
      if (window.electronAPI.setApiKey) {
        await window.electronAPI.setApiKey(geminiApiKey);
      }
      if (window.electronAPI.setModel) {
        const found = AVAILABLE_MODELS.find((m) => m.id === selectedModel);
        await window.electronAPI.setModel(selectedModel, found?.provider);
      }

      try {
        localStorage.setItem('jarvis_selected_model', selectedModel);
      } catch {}

      setStatus('NEURAL LINKS CALIBRATED & SAVED');
      setTimeout(() => {
        setStatus(null);
        onClose();
      }, 900);
    }
  };

  return (
    <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md rounded-3xl flex items-center justify-center p-6 z-50 border border-cyan-400/40 hud-glow app-no-drag">
      <div className="w-full max-w-lg bg-slate-900/95 border border-cyan-500/40 rounded-xl p-5 relative shadow-[0_0_35px_rgba(0,240,255,0.25)] select-none">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-cyan-400 hover:text-cyan-200 transition-colors"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-2 mb-3 text-cyan-400 font-bold tracking-wider font-display text-sm">
          <Key size={18} />
          <span>NEURAL MATRIX CONFIGURATION</span>
        </div>

        <p className="text-xs text-slate-300 mb-4 leading-relaxed font-sans">
          Configure API keys for <span className="text-amber-400 font-semibold">Groq</span> (recommended for ultra-fast response & free tier) and <span className="text-cyan-300 font-semibold">Google Gemini</span>.
        </p>

        {/* Model Selection Option */}
        <div className="mb-4">
          <label className="block text-[10px] text-cyan-400 font-mono mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Cpu size={12} /> ACTIVE NEURAL MODEL
            </span>
            <span className="text-slate-400 text-[9px]">Select default core</span>
          </label>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-full bg-slate-950 border border-cyan-500/30 rounded px-3 py-2 text-xs text-cyan-200 font-mono focus:outline-none focus:border-cyan-400"
          >
            <optgroup label="⚡ GROQ LPUs (Free Tier / High Speed)">
              {AVAILABLE_MODELS.filter((m) => m.provider === 'groq').map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} ({m.badge})
                </option>
              ))}
            </optgroup>
            <optgroup label="✨ GOOGLE GEMINI">
              {AVAILABLE_MODELS.filter((m) => m.provider === 'gemini').map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} ({m.badge})
                </option>
              ))}
            </optgroup>
          </select>
        </div>

        {/* Groq API Key Input */}
        <div className="mb-3.5">
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] text-amber-400 font-mono font-bold">
              GROQ_API_KEY (Recommended)
            </label>
            <a
              href="https://console.groq.com/keys"
              target="_blank"
              rel="noreferrer"
              className="text-[9px] text-amber-300/80 hover:text-amber-200 underline flex items-center gap-0.5"
            >
              Get Free Key <ExternalLink size={9} />
            </a>
          </div>
          <input
            type="password"
            value={groqApiKey}
            onChange={(e) => setGroqApiKey(e.target.value)}
            placeholder="gsk_..."
            className="w-full bg-slate-950 border border-amber-500/30 rounded px-3 py-2 text-xs text-amber-200 font-mono focus:outline-none focus:border-amber-400 focus:shadow-[0_0_10px_rgba(245,158,11,0.4)]"
          />
        </div>

        {/* Gemini API Key Input */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] text-cyan-400 font-mono font-bold">
              GEMINI_API_KEY
            </label>
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
              className="text-[9px] text-cyan-300/80 hover:text-cyan-200 underline flex items-center gap-0.5"
            >
              Google AI Studio <ExternalLink size={9} />
            </a>
          </div>
          <input
            type="password"
            value={geminiApiKey}
            onChange={(e) => setGeminiApiKey(e.target.value)}
            placeholder="AIzaSy..."
            className="w-full bg-slate-950 border border-cyan-500/30 rounded px-3 py-2 text-xs text-cyan-200 font-mono focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_10px_#00f0ff]"
          />
        </div>

        {status && (
          <div className="mb-3 text-[11px] text-emerald-400 flex items-center gap-1.5 font-mono">
            <ShieldCheck size={14} />
            <span>{status}</span>
          </div>
        )}

        {/* Global Shortcuts Quick Reference */}
        <div className="p-2.5 rounded bg-slate-950/70 border border-cyan-500/15 mb-4 text-[11px] text-slate-400 space-y-1">
          <div className="flex items-center gap-1.5 text-cyan-400/90 font-medium text-xs">
            <Zap size={12} />
            <span>Tactical Hotkeys</span>
          </div>
          <div className="font-mono text-[10px] text-cyan-300/80 grid grid-cols-2 gap-1">
            <div>• <span className="text-cyan-200">Shift + F9</span>: Voice Wake Combo</div>
            <div>• <span className="text-cyan-200">Alt + J</span>: Toggle HUD Overlay</div>
            <div>• <span className="text-cyan-200">Escape</span>: Minimize to Orb</div>
            <div>• Click Outside: Auto-minimize</div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded text-xs text-slate-400 hover:text-slate-200 border border-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 rounded text-xs bg-cyan-500/20 text-cyan-300 border border-cyan-400 hover:bg-cyan-500/30 transition-all shadow-[0_0_10px_#00f0ff]"
          >
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
};
