export interface SystemMetrics {
  cpuUsage: number;
  memoryUsedGb: number;
  memoryTotalGb: number;
  memoryPercent: number;
  batteryPercent: number | null;
  batteryCharging: boolean;
  diskUsedGb: number;
  diskTotalGb: number;
  diskPercent: number;
  osName: string;
}

export interface IElectronAPI {
  toggleExpand: (expand: boolean) => Promise<{ expanded: boolean }>;
  setWindowPosition: (x: number, y: number) => Promise<void>;
  getWindowPosition: () => Promise<{ x: number; y: number }>;
  onToggleHotkey: (callback: () => void) => void;
  onVoiceHotkey?: (callback: () => void) => void;
  onWindowStateChanged?: (callback: (expanded: boolean) => void) => void;

  getMetrics: () => Promise<SystemMetrics>;
  adjustVolume: (level: number, isAbsolute?: boolean) => Promise<string>;
  controlMedia: (action: 'play_pause' | 'next' | 'prev') => Promise<string>;
  launchApp: (target: string) => Promise<string>;
  focusApp: (target: string) => Promise<string>;
  terminateApp: (target: string) => Promise<string>;
  captureScreen: () => Promise<{ dataUrl: string; width: number; height: number }>;

  sendPrompt: (prompt: string, useVision?: boolean) => Promise<{
    text: string;
    toolCall?: {
      name: string;
      args: Record<string, unknown>;
      result?: string;
    };
  }>;
  sendAudioPrompt: (base64Audio: string, mimeType?: string) => Promise<{
    text: string;
    toolCall?: {
      name: string;
      args: Record<string, unknown>;
      result?: string;
    };
  }>;
  setApiKey: (key: string) => Promise<void>;
  getApiKey: () => Promise<string>;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
