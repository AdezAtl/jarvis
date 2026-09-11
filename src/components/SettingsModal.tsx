import React, { useState, useEffect } from 'react';
import { X, Key, ShieldCheck, Zap } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && window.electronAPI) {
      window.electronAPI.getApiKey().then((k) => setApiKey(k || ''));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (window.electronAPI) {
      await window.electronAPI.setApiKey(apiKey);
      setStatus('API KEY REGISTERED TO SYSTEM CORE');
      setTimeout(() => {
        setStatus(null);
        onClose();
      }, 1000);
    }
  };

  return (
    <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md rounded-3xl flex items-center justify-center p-6 z-50 border border-cyan-400/40 hud-glow app-no-drag">
      <div className="w-full max-w-md bg-slate-900/90 border border-cyan-500/30 rounded-xl p-5 relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-cyan-400 hover:text-cyan-200 transition-colors"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-2 mb-4 text-cyan-400 font-bold tracking-wider">
          <Key size={18} />
          <span>NEURAL LINK CONFIGURATION</span>
        </div>

        <p className="text-xs text-slate-300 mb-3 leading-relaxed">
          Provide your <span className="text-cyan-300 font-semibold">Google Gemini API Key</span> to power J.A.R.V.I.S. voice, system intelligence, and multimodal screen vision.
        </p>

        <div className="mb-4">
          <label className="block text-[10px] text-cyan-500/80 mb-1 font-mono">GEMINI_API_KEY</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="AIzaSy..."
            className="w-full bg-slate-950 border border-cyan-500/30 rounded px-3 py-2 text-xs text-cyan-300 font-mono focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_10px_#00f0ff]"
          />
        </div>

        {status && (
          <div className="mb-3 text-[11px] text-emerald-400 flex items-center gap-1.5 font-mono">
            <ShieldCheck size={14} />
            <span>{status}</span>
          </div>
        )}

        <div className="p-2.5 rounded bg-slate-950/70 border border-cyan-500/15 mb-4 text-[11px] text-slate-400 space-y-1">
          <div className="flex items-center gap-1.5 text-cyan-400/90 font-medium">
            <Zap size={12} />
            <span>Global Activation Shortcuts</span>
          </div>
          <div className="font-mono text-[10px] text-cyan-300/80">
            • <span className="text-cyan-200">Alt + J</span>: Toggle HUD expand / collapse
          </div>
          <div className="font-mono text-[10px] text-cyan-300/80">
            • <span className="text-cyan-200">Ctrl + Shift + J</span>: Secondary toggle
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
            Save Neural Key
          </button>
        </div>
      </div>
    </div>
  );
};
