import { contextBridge, ipcRenderer } from 'electron';

export interface IElectronAPI {
  // Window State & Positioning
  toggleExpand: (expand: boolean) => Promise<{ expanded: boolean }>;
  setWindowPosition: (x: number, y: number) => Promise<void>;
  getWindowPosition: () => Promise<{ x: number; y: number }>;
  onToggleHotkey: (callback: () => void) => void;
  onVoiceHotkey: (callback: () => void) => void;
  onWindowStateChanged: (callback: (expanded: boolean) => void) => void;

  // System Automation
  getMetrics: () => Promise<any>;
  adjustVolume: (level: number, isAbsolute?: boolean) => Promise<string>;
  getVolume?: () => Promise<{ volume: number; isMuted: boolean }>;
  setMute?: (mute: boolean) => Promise<{ volume: number; isMuted: boolean }>;
  controlMedia: (action: 'play_pause' | 'next' | 'prev') => Promise<string>;
  launchApp: (target: string) => Promise<string>;
  focusApp: (target: string) => Promise<string>;
  terminateApp: (target: string) => Promise<string>;
  captureScreen: () => Promise<{ dataUrl: string; width: number; height: number }>;

  // Multi-Model AI (Groq & Gemini)
  sendPrompt: (prompt: string, useVision?: boolean) => Promise<{ text: string; toolCall?: any }>;
  sendAudioPrompt: (base64Audio: string, mimeType?: string) => Promise<{ text: string; toolCall?: any }>;
  setApiKey: (key: string) => Promise<void>;
  getApiKey: () => Promise<string>;
  setGroqApiKey: (key: string) => Promise<void>;
  getGroqApiKey: () => Promise<string>;
  setModel: (model: string, provider?: 'groq' | 'gemini') => Promise<any>;
  getModelConfig: () => Promise<{
    provider: 'groq' | 'gemini';
    model: string;
    hasGeminiKey: boolean;
    hasGroqKey: boolean;
    geminiApiKey?: string;
    groqApiKey?: string;
  }>;
}

const api: IElectronAPI = {
  toggleExpand: (expand: boolean) => ipcRenderer.invoke('window:toggle-expand', expand),
  setWindowPosition: (x: number, y: number) => ipcRenderer.invoke('window:set-position', { x, y }),
  getWindowPosition: () => ipcRenderer.invoke('window:get-position'),
  onToggleHotkey: (callback: () => void) => {
    ipcRenderer.on('hotkey:toggle', () => callback());
  },
  onVoiceHotkey: (callback: () => void) => {
    ipcRenderer.on('voice:hotkey-listening', () => callback());
  },
  onWindowStateChanged: (callback: (expanded: boolean) => void) => {
    ipcRenderer.on('window:state-changed', (_event, expanded: boolean) => callback(expanded));
  },

  getMetrics: () => ipcRenderer.invoke('system:get-metrics'),
  adjustVolume: (level: number, isAbsolute = false) =>
    ipcRenderer.invoke('system:adjust-volume', { level, isAbsolute }),
  getVolume: () => ipcRenderer.invoke('system:get-volume'),
  setMute: (mute: boolean) => ipcRenderer.invoke('system:set-mute', mute),
  controlMedia: (action: 'play_pause' | 'next' | 'prev') =>
    ipcRenderer.invoke('system:control-media', action),
  launchApp: (target: string) => ipcRenderer.invoke('system:launch-app', target),
  focusApp: (target: string) => ipcRenderer.invoke('system:focus-app', target),
  terminateApp: (target: string) => ipcRenderer.invoke('system:terminate-app', target),
  captureScreen: () => ipcRenderer.invoke('system:capture-screen'),

  sendPrompt: (prompt: string, useVision = false) =>
    ipcRenderer.invoke('gemini:send-prompt', { prompt, useVision }),
  sendAudioPrompt: (base64Audio: string, mimeType = 'audio/webm') =>
    ipcRenderer.invoke('gemini:send-audio-prompt', { base64Audio, mimeType }),
  setApiKey: (key: string) => ipcRenderer.invoke('gemini:set-key', key),
  getApiKey: () => ipcRenderer.invoke('gemini:get-key'),
  setGroqApiKey: (key: string) => ipcRenderer.invoke('ai:set-groq-key', key),
  getGroqApiKey: () => ipcRenderer.invoke('ai:get-groq-key'),
  setModel: (model: string, provider?: 'groq' | 'gemini') =>
    ipcRenderer.invoke('ai:set-model', { model, provider }),
  getModelConfig: () => ipcRenderer.invoke('ai:get-config'),
};

contextBridge.exposeInMainWorld('electronAPI', api);
