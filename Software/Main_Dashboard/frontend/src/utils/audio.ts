// Web Audio API Disaster Siren / Buzzer Synthesizer
// Works 100% offline with zero external audio file dependencies

class HazardAudioSystem {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isMuted: boolean = false;
  private isAlarmPlaying: boolean = false;
  private sirenInterval: any = null;
  private activeOscillators: OscillatorNode[] = [];

  constructor() {
    // Default to unmuted / armed or load stored setting
    const stored = localStorage.getItem('prakritinetx_buzzer_muted');
    this.isMuted = stored === 'true';
  }

  private initContext() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.2, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended' && !this.isMuted) {
      this.ctx.resume().catch(() => {});
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setMuted(muted: boolean): boolean {
    this.isMuted = muted;
    localStorage.setItem('prakritinetx_buzzer_muted', String(muted));
    if (muted) {
      this.stopAlarm();
      if (this.masterGain && this.ctx) {
        try {
          this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
        } catch (_) {}
      }
    } else {
      if (this.masterGain && this.ctx) {
        try {
          this.masterGain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        } catch (_) {}
      }
    }
    return this.isMuted;
  }

  public toggleMute(): boolean {
    const newState = !this.isMuted;
    this.setMuted(newState);
    if (!newState) {
      this.playTestBeep();
    }
    return newState;
  }

  // Play a brief arming confirmation chirp
  public playTestBeep() {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx || !this.masterGain) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, this.ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.1);
    } catch (e) {
      console.warn('[AudioSystem] playTestBeep error:', e);
    }
  }

  // Dual-tone pulsed emergency hazard siren
  public startAlarm() {
    if (this.isMuted) return;
    if (this.isAlarmPlaying && this.sirenInterval) return;

    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    this.isAlarmPlaying = true;
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    }

    if (this.sirenInterval) {
      clearInterval(this.sirenInterval);
      this.sirenInterval = null;
    }

    const playSirenPulse = () => {
      if (!this.ctx || !this.isAlarmPlaying || this.isMuted || !this.masterGain) {
        this.stopAlarm();
        return;
      }

      try {
        const now = this.ctx.currentTime;
        
        // High tone (880Hz -> 740Hz)
        const osc1 = this.ctx.createOscillator();
        const gain1 = this.ctx.createGain();
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(880, now);
        osc1.frequency.linearRampToValueAtTime(740, now + 0.25);

        gain1.gain.setValueAtTime(0.001, now);
        gain1.gain.linearRampToValueAtTime(0.18, now + 0.04);
        gain1.gain.linearRampToValueAtTime(0.001, now + 0.25);

        osc1.connect(gain1);
        gain1.connect(this.masterGain);
        osc1.start(now);
        osc1.stop(now + 0.26);
        this.activeOscillators.push(osc1);

        // Low tone (620Hz -> 520Hz)
        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(620, now + 0.28);
        osc2.frequency.linearRampToValueAtTime(520, now + 0.53);

        gain2.gain.setValueAtTime(0.001, now + 0.28);
        gain2.gain.linearRampToValueAtTime(0.18, now + 0.32);
        gain2.gain.linearRampToValueAtTime(0.001, now + 0.53);

        osc2.connect(gain2);
        gain2.connect(this.masterGain);
        osc2.start(now + 0.28);
        osc2.stop(now + 0.54);
        this.activeOscillators.push(osc2);

        // Clean up finished oscillators
        setTimeout(() => {
          this.activeOscillators = this.activeOscillators.filter(o => o !== osc1 && o !== osc2);
        }, 600);

      } catch (err) {
        console.warn('[AudioSystem] Siren pulse error:', err);
      }
    };

    // Play immediately and then repeat pulse
    playSirenPulse();
    this.sirenInterval = setInterval(playSirenPulse, 600);
  }

  public stopAlarm() {
    this.isAlarmPlaying = false;
    if (this.sirenInterval) {
      clearInterval(this.sirenInterval);
      this.sirenInterval = null;
    }

    // Stop and disconnect all active oscillators immediately
    if (this.activeOscillators.length > 0) {
      this.activeOscillators.forEach(osc => {
        try {
          osc.stop();
          osc.disconnect();
        } catch (_) {}
      });
      this.activeOscillators = [];
    }

    // Mute master gain
    if (this.masterGain && this.ctx) {
      try {
        this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
      } catch (_) {}
    }
  }

  public isPlaying(): boolean {
    return this.isAlarmPlaying && !this.isMuted;
  }
}

export const hazardAudio = new HazardAudioSystem();
