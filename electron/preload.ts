import { contextBridge, ipcRenderer } from 'electron';

export interface IElectronAPI {
  // Window State & Positioning
  toggleExpand: (expand: boolean) => Promise<{ expanded: boolean }>;
  setWindowPosition: (x: number, y: number) => Promise<void>;
  getWindowPosition: () => Promise<{ x: number; y: number }>;
  onToggleHotkey: (callback: () => void) => void;
  onWindowStateChanged: (callback: (expanded: boolean) => void) => void;

  // System Automation
  getMetrics: () => Promise<any>;
  adjustVolume: (level: number, isAbsolute?: boolean) => Promise<string>;
  controlMedia: (action: 'play_pause' | 'next' | 'prev') => Promise<string>;
  launchApp: (target: string) => Promise<string>;
  focusApp: (target: string) => Promise<string>;
  terminateApp: (target: string) => Promise<string>;
  captureScreen: () => Promise<{ dataUrl: string; width: number; height: number }>;

  // Gemini Intelligence
  sendPrompt: (prompt: string, useVision?: boolean) => Promise<{ text: string; toolCall?: any }>;
  sendAudioPrompt: (base64Audio: string, mimeType?: string) => Promise<{ text: string; toolCall?: any }>;
  setApiKey: (key: string) => Promise<void>;
  getApiKey: () => Promise<string>;
}

const api: IElectronAPI = {
  toggleExpand: (expand: boolean) => ipcRenderer.invoke('window:toggle-expand', expand),
  setWindowPosition: (x: number, y: number) => ipcRenderer.invoke('window:set-position', { x, y }),
  getWindowPosition: () => ipcRenderer.invoke('window:get-position'),
  onToggleHotkey: (callback: () => void) => {
    ipcRenderer.on('hotkey:toggle', () => callback());
  },
  onWindowStateChanged: (callback: (expanded: boolean) => void) => {
    ipcRenderer.on('window:state-changed', (_event, expanded: boolean) => callback(expanded));
  },

  getMetrics: () => ipcRenderer.invoke('system:get-metrics'),
  adjustVolume: (level: number, isAbsolute = false) =>
    ipcRenderer.invoke('system:adjust-volume', { level, isAbsolute }),
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
};

contextBridge.exposeInMainWorld('electronAPI', api);
