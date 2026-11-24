import type { Teacher } from '../types';

export interface SpeechCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
  onBoundary?: (charIndex: number) => void;
}

class SpeechService {
  private synth: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private isMuted: boolean = false;
  private voices: SpeechSynthesisVoice[] = [];

  public getCurrentUtterance() {
    return this.currentUtterance;
  }

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.loadVoices();
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => this.loadVoices();
      }
    }
  }

  private loadVoices() {
    if (!this.synth) return;
    this.voices = this.synth.getVoices();
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted) {
      this.stop();
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public getVoices(): SpeechSynthesisVoice[] {
    return this.voices;
  }

  private pickVoiceForTeacher(teacher: Teacher): SpeechSynthesisVoice | null {
    if (!this.voices || this.voices.length === 0) {
      if (this.synth) this.loadVoices();
    }

    const spanishVoices = this.voices.filter(v => v.lang.startsWith('es'));
    if (spanishVoices.length === 0) {
      return this.voices.length > 0 ? this.voices[0] : null;
    }

    // Try finding by gender or name heuristics
    if (teacher.voiceGender === 'male') {
      const maleVoice = spanishVoices.find(
        v =>
          v.name.toLowerCase().includes('jorge') ||
          v.name.toLowerCase().includes('diego') ||
          v.name.toLowerCase().includes('miguel') ||
          v.name.toLowerCase().includes('carlos') ||
          v.name.toLowerCase().includes('enrique') ||
          v.name.toLowerCase().includes('male') ||
          v.name.toLowerCase().includes('pablo')
      );
      if (maleVoice) return maleVoice;
    } else {
      const femaleVoice = spanishVoices.find(
        v =>
          v.name.toLowerCase().includes('monica') ||
          v.name.toLowerCase().includes('lucia') ||
          v.name.toLowerCase().includes('paulina') ||
          v.name.toLowerCase().includes('helena') ||
          v.name.toLowerCase().includes('laura') ||
          v.name.toLowerCase().includes('female') ||
          v.name.toLowerCase().includes('marta')
      );
      if (femaleVoice) return femaleVoice;
    }

    return spanishVoices[0];
  }

  public speak(
    text: string,
    teacher: Teacher,
    speedMultiplier: number = 1.0,
    callbacks?: SpeechCallbacks
  ) {
    this.stop();

    if (this.isMuted || !this.synth) {
      callbacks?.onStart?.();
      // If muted or unsupported, simulate completion after duration
      const simulatedDuration = Math.max(1500, (text.length / 15) * 1000 * (1 / speedMultiplier));
      const timer = setTimeout(() => {
        callbacks?.onEnd?.();
      }, simulatedDuration);
      return () => clearTimeout(timer);
    }

    // Clean markdown/symbols from speech text so speech reads naturally
    const cleanSpeech = text
      .replace(/[*_~`]/g, '')
      .replace(/\\Delta/g, 'delta')
      .replace(/\\implies/g, 'implica que')
      .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1 sobre $2')
      .replace(/\\sqrt\{([^}]+)\}/g, 'raíz cuadrada de $1')
      .replace(/\^2/g, ' al cuadrado')
      .replace(/\\cdot/g, ' por ');

    const utterance = new SpeechSynthesisUtterance(cleanSpeech);
    const voice = this.pickVoiceForTeacher(teacher);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = 'es-ES';
    }

    utterance.pitch = teacher.voicePitch;
    utterance.rate = teacher.voiceRate * speedMultiplier;

    utterance.onstart = () => {
      callbacks?.onStart?.();
    };

    utterance.onend = () => {
      callbacks?.onEnd?.();
    };

    utterance.onerror = err => {
      console.warn('Speech error or cancelled:', err);
      callbacks?.onError?.(err);
      callbacks?.onEnd?.();
    };

    utterance.onboundary = event => {
      if (event.name === 'word') {
        callbacks?.onBoundary?.(event.charIndex);
      }
    };

    this.currentUtterance = utterance;
    // Chromium garbage collection bug fix: retain global reference
    if (typeof window !== 'undefined') {
      (window as any)._activeSpeechUtterance = utterance;
    }
    try {
      this.synth.resume();
    } catch {}
    this.synth.speak(utterance);

    return () => {
      this.stop();
    };
  }

  public unlockAudio() {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        if (audioCtx.state === 'suspended') {
          audioCtx.resume();
        }
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        gain.gain.value = 0.001; // silent unlock
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(0);
        osc.stop(audioCtx.currentTime + 0.05);
      }
    } catch {}
    if (this.synth) {
      try {
        this.synth.resume();
      } catch {}
    }
  }

  public testAudioSound(onDone?: () => void) {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.value = 587.33; // D5 tone
        gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
      }
    } catch (e) {
      console.warn('AudioContext chime failed:', e);
    }

    if (this.synth) {
      try {
        this.synth.cancel();
        this.synth.resume();
      } catch {}
      const testU = new SpeechSynthesisUtterance('Audio activado. La voz y la pizarra están listas.');
      testU.lang = 'es-ES';
      testU.rate = 1.05;
      (window as any)._activeSpeechUtterance = testU;
      testU.onend = () => {
        onDone?.();
      };
      testU.onerror = () => {
        onDone?.();
      };
      this.synth.speak(testU);
    } else {
      onDone?.();
    }
  }

  public stop() {
    if (this.synth) {
      try {
        this.synth.cancel();
      } catch {}
      this.currentUtterance = null;
      if (typeof window !== 'undefined') {
        (window as any)._activeSpeechUtterance = null;
      }
    }
  }

  public pause() {
    if (this.synth) {
      try {
        this.synth.pause();
      } catch {}
    }
  }

  public resume() {
    if (this.synth) {
      try {
        this.synth.resume();
      } catch {}
    }
  }
}

export const speechService = new SpeechService();
