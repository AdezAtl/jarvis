import React, { useState, useEffect, useRef } from 'react';
import { CoreOrb } from './components/CoreOrb';
import { JarvisHUD } from './components/JarvisHUD';
import { SettingsModal } from './components/SettingsModal';
import { SystemMetrics } from './types/electron';
import { jarvisAudio } from './services/soundEffects';

export interface LogEntry {
  id: string;
  sender: 'user' | 'jarvis' | 'system';
  text: string;
  toolDetails?: { name: string; result?: string };
  time: string;
}

const STORAGE_KEY = 'jarvis_chat_history';

function loadInitialLogs(): LogEntry[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {}
  return [
    {
      id: '1',
      sender: 'jarvis',
      text: 'J.A.R.V.I.S. Mark-VII core online. Atmospheric, hardware, and neural matrices active. Ready for instructions, sir.',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ];
}

export const App: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [status, setStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');

  // Persistent conversation logs across minimize/maximize and app restarts
  const [logs, setLogs] = useState<LogEntry[]>(loadInitialLogs);

  const addLog = (
    sender: 'user' | 'jarvis' | 'system',
    text: string,
    toolDetails?: { name: string; result?: string }
  ) => {
    const entry: LogEntry = {
      id: Date.now().toString(),
      sender,
      text,
      toolDetails,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setLogs((prev) => {
      const next = [...prev, entry].slice(-80);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const clearLogs = () => {
    const initial: LogEntry[] = [
      {
        id: Date.now().toString(),
        sender: 'jarvis',
        text: 'Console history reset. Mark-VII core standing by, sir.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ];
    setLogs(initial);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    } catch {}
  };

  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  const [isAudioActive, setIsAudioActive] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const speechRecognitionRef = useRef<any>(null);

  const handleToggleExpand = async (targetState?: boolean) => {
    const nextState = targetState !== undefined ? targetState : !isExpanded;
    setIsExpanded(nextState);

    if (nextState) {
      jarvisAudio.playBoot();
    } else {
      jarvisAudio.playCollapse();
    }

    if (window.electronAPI) {
      await window.electronAPI.toggleExpand(nextState);
    }
  };

  // Hotkeys & Window state sync
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onToggleHotkey(() => {
        handleToggleExpand();
      });
      if (window.electronAPI.onWindowStateChanged) {
        window.electronAPI.onWindowStateChanged((expanded: boolean) => {
          setIsExpanded(expanded);
        });
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isExpanded) {
        handleToggleExpand(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded]);

  // Periodic metrics polling
  useEffect(() => {
    let isMounted = true;

    const fetchMetrics = async () => {
      if (window.electronAPI) {
        try {
          const data = await window.electronAPI.getMetrics();
          if (isMounted) setMetrics(data);
        } catch (err) {
          console.error('Error fetching metrics:', err);
        }
      }
    };

    fetchMetrics();
    // Optimized interval: 3.5s when active HUD is open, 12s when collapsed in background
    const interval = setInterval(fetchMetrics, isExpanded ? 3500 : 12000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isExpanded]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Start Wake-Word listener for "jarvis"
  const startWakeWordListener = () => {
    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionClass) return;

    try {
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch {}
      }

      const recognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript.toLowerCase();
          if (transcript.includes('jarvis')) {
            try {
              recognition.stop();
            } catch {}
            handleToggleExpand(true);
            jarvisAudio.playSuccess();
            jarvisAudio.speak('At your service, sir. Systems online.');
            break;
          }
        }
      };

      recognition.onerror = () => {};
      recognition.start();
      speechRecognitionRef.current = recognition;
    } catch (err) {
      console.warn('Wake word speech recognition notice:', err);
    }
  };

  // Listen for Shift+F9 combo from Electron
  useEffect(() => {
    if (window.electronAPI?.onVoiceHotkey) {
      window.electronAPI.onVoiceHotkey(() => {
        if (!isAudioActive) {
          startAudioListening();
          startWakeWordListener();
        } else {
          stopAudioListening();
        }
      });
    }
  }, [isAudioActive, isExpanded]);

  const startAudioListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      source.connect(analyser);

      setAnalyserNode(analyser);
      setIsAudioActive(true);
      setStatus('listening');
      jarvisAudio.playListenStart();

      // Native MediaRecorder recording for Gemini multimodal audio
      audioChunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.start(100);
      mediaRecorderRef.current = recorder;
    } catch (err) {
      console.warn('Microphone access denied or unavailable:', err);
      setIsAudioActive(false);
      setStatus('idle');
    }
  };

  const stopAudioListening = async () => {
    setIsAudioActive(false);
    setStatus('thinking');

    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {}
    }

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = async () => {
        try {
          const audioBlob = new Blob(audioChunksRef.current, {
            type: recorder.mimeType || 'audio/webm',
          });

          if (audioBlob.size > 500 && window.electronAPI) {
            const reader = new FileReader();
            reader.onloadend = async () => {
              const base64Data = (reader.result as string).split(',')[1];
              if (base64Data) {
                try {
                  const res = await window.electronAPI.sendAudioPrompt(
                    base64Data,
                    recorder.mimeType || 'audio/webm'
                  );
                  addLog('user', '🎙️ [Voice Audio Command]');
                  addLog(
                    'jarvis',
                    res.text,
                    res.toolCall ? { name: res.toolCall.name, result: res.toolCall.result } : undefined
                  );
                  jarvisAudio.playSuccess();
                  jarvisAudio.speak(res.text);

                  // Expand HUD automatically if minimized
                  if (!isExpanded) {
                    handleToggleExpand(true);
                  }
                } catch (e: any) {
                  addLog('system', `Audio processing error: ${e.message || e}`);
                } finally {
                  setStatus('idle');
                }
              }
            };
            reader.readAsDataURL(audioBlob);
          } else {
            setStatus('idle');
          }
        } catch (err) {
          console.error('Error processing recorded audio:', err);
          setStatus('idle');
        }
      };
      recorder.stop();
    } else {
      setStatus('idle');
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    setAnalyserNode(null);
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-transparent">
      {isExpanded ? (
        <div className="relative animate-in fade-in zoom-in-95 duration-200">
          <JarvisHUD
            onCollapse={() => handleToggleExpand(false)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            metrics={metrics}
            analyserNode={analyserNode}
            isAudioActive={isAudioActive}
            onStartListening={() => {
              startAudioListening();
              startWakeWordListener();
            }}
            onStopListening={stopAudioListening}
            logs={logs}
            onAddLog={addLog}
            onClearLogs={clearLogs}
          />
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
          />
        </div>
      ) : (
        <div className="relative w-6 h-6 flex items-center justify-center animate-in fade-in duration-150">
          <CoreOrb
            onExpand={() => handleToggleExpand(true)}
            status={status}
            metricsSummary={
              metrics
                ? { cpu: metrics.cpuUsage, ram: metrics.memoryPercent }
                : undefined
            }
          />
        </div>
      )}
    </div>
  );
};

export default App;
