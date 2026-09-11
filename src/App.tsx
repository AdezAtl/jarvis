import React, { useState, useEffect, useRef } from 'react';
import { CoreOrb } from './components/CoreOrb';
import { JarvisHUD } from './components/JarvisHUD';
import { SettingsModal } from './components/SettingsModal';
import { SystemMetrics } from './types/electron';

export const App: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [status, setStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');

  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  const [isAudioActive, setIsAudioActive] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const speechRecognitionRef = useRef<any>(null);

  const handleToggleExpand = async (targetState?: boolean) => {
    const nextState = targetState !== undefined ? targetState : !isExpanded;
    setIsExpanded(nextState);

    if (window.electronAPI) {
      await window.electronAPI.toggleExpand(nextState);
    }
  };

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
    const interval = setInterval(fetchMetrics, isExpanded ? 2500 : 8000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isExpanded]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [voiceEvent, setVoiceEvent] = useState<{
    id: string;
    userText?: string;
    responseText: string;
    toolCall?: any;
  } | null>(null);

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
                  setVoiceEvent({
                    id: Date.now().toString(),
                    userText: '🎙️ [Voice Audio Command]',
                    responseText: res.text,
                    toolCall: res.toolCall,
                  });
                } catch (e: any) {
                  setVoiceEvent({
                    id: Date.now().toString(),
                    responseText: `Audio processing error: ${e.message || e}`,
                  });
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
            onStartListening={startAudioListening}
            onStopListening={stopAudioListening}
            voiceEvent={voiceEvent}
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
