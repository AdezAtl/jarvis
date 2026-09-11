// Procedural Sci-Fi Audio Synthesizer & Speech Engine for J.A.R.V.I.S.

class JarvisAudioEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private isVoiceEnabled: boolean = true;
  private selectedVoice: SpeechSynthesisVoice | null = null;

  constructor() {
    // Restore preference from localStorage if available
    try {
      this.isMuted = localStorage.getItem('jarvis_audio_muted') === 'true';
      this.isVoiceEnabled = localStorage.getItem('jarvis_voice_enabled') !== 'false';
    } catch {
      this.isMuted = false;
      this.isVoiceEnabled = true;
    }

    // Initialize voice list
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = () => {
        this.selectJarvisVoice();
      };
      this.selectJarvisVoice();
    }
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this.ctx = new AudioCtxClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private selectJarvisVoice() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return;

    // Prefer British English voices to replicate Paul Bettany's iconic J.A.R.V.I.S.
    const britishVoice = voices.find(
      (v) =>
        (v.lang.includes('en-GB') || v.lang.includes('en_GB')) &&
        (v.name.toLowerCase().includes('george') ||
          v.name.toLowerCase().includes('male') ||
          v.name.toLowerCase().includes('uk') ||
          v.name.toLowerCase().includes('natural'))
    ) || voices.find((v) => v.lang.includes('en-GB') || v.lang.includes('en_GB'));

    // Fallbacks: any good English voice
    const englishVoice =
      britishVoice ||
      voices.find((v) => v.name.toLowerCase().includes('david') || v.name.toLowerCase().includes('natural')) ||
      voices.find((v) => v.lang.startsWith('en')) ||
      voices[0];

    this.selectedVoice = englishVoice || null;
  }

  // ---------------- SCI-FI SOUND EFFECTS (PROCEDURAL SYNTHESIS) ----------------

  /**
   * Sci-fi holographic boot / HUD expand chime
   */
  playBoot() {
    if (this.isMuted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(400, now);
    filter.frequency.exponentialRampToValueAtTime(1800, now + 0.35);
    filter.Q.setValueAtTime(3.5, now);

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(340, now);
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.32);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(680, now);
    osc2.frequency.exponentialRampToValueAtTime(1760, now + 0.32);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.46);
    osc2.stop(now + 0.46);
  }

  /**
   * HUD collapse / power down descending sound
   */
  playCollapse() {
    if (this.isMuted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(720, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.22);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  /**
   * High-tech cybernetic dual-chirp for button clicks and prompt sending
   */
  playChirp() {
    if (this.isMuted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1800, now);
    osc.frequency.setValueAtTime(2400, now + 0.035);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.setValueAtTime(0.09, now + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.09);
  }

  /**
   * Microphone active listening pulse (sonar ping)
   */
  playListenStart() {
    if (this.isMuted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(920, now);
    osc.frequency.exponentialRampToValueAtTime(1380, now + 0.12);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.26);
  }

  /**
   * Task execution success confirmation triad
   */
  playSuccess() {
    if (this.isMuted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const notes = [587.33, 739.99, 880.0]; // D5, F#5, A5 futuristic triad
    notes.forEach((freq, idx) => {
      const now = ctx.currentTime + idx * 0.06;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.17);
    });
  }

  // ---------------- J.A.R.V.I.S. SPEECH SYNTHESIS (VOICE) ----------------

  /**
   * Speaks the response aloud in a calm, British cybernetic voice
   */
  speak(text: string) {
    if (this.isMuted || !this.isVoiceEnabled) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    // Clean text: strip markdown symbols, asterisks, URLs, JSON, and tool call traces
    let cleanText = text
      .replace(/```[\s\S]*?```/g, '') // remove code blocks
      .replace(/`([^`]+)`/g, '$1') // inline code
      .replace(/\*\*([^*]+)\*\*/g, '$1') // bold
      .replace(/\*([^*]+)\*/g, '$1') // italic
      .replace(/#{1,6}\s+/g, '') // headers
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
      .replace(/https?:\/\/\S+/g, '') // URLs
      .replace(/[\{\}\[\]\<\>]/g, '') // brackets
      .trim();

    // If text is very long (e.g. extensive code analysis), summarize spoken output
    if (cleanText.length > 280) {
      const sentences = cleanText.match(/[^.!?]+[.!?]+/g);
      if (sentences && sentences.length > 0) {
        cleanText = sentences.slice(0, 2).join(' ') + ' The full telemetry report is on your display, sir.';
      } else {
        cleanText = cleanText.substring(0, 240) + '... Data is rendered on your HUD, sir.';
      }
    }

    if (!cleanText) return;

    try {
      window.speechSynthesis.cancel(); // Stop any pending utterance
      const utterance = new SpeechSynthesisUtterance(cleanText);

      if (!this.selectedVoice) {
        this.selectJarvisVoice();
      }
      if (this.selectedVoice) {
        utterance.voice = this.selectedVoice;
      }

      // British calm tone settings
      utterance.pitch = 0.95;
      utterance.rate = 1.04;
      utterance.volume = 0.85;

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('Speech synthesis unavailable:', err);
    }
  }

  // ---------------- AUDIO CONTROLS & STATE ----------------

  getMuted(): boolean {
    return this.isMuted;
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
    try {
      localStorage.setItem('jarvis_audio_muted', muted.toString());
    } catch {}
    if (muted && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    if (!this.isMuted) {
      this.playChirp();
    }
    return this.isMuted;
  }
}

export const jarvisAudio = new JarvisAudioEngine();
