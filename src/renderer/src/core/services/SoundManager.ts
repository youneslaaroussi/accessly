export class SoundManager {
  private audioContext: AudioContext | null = null;
  private sounds: Map<string, AudioBuffer> = new Map();

  constructor() {
    console.log('[SoundManager] Sound manager initialized');
  }

  async resumeAudioContext(): Promise<void> {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
      console.log('[SoundManager] Audio context resumed');
    }
  }

  async loadSound(name: string, url: string): Promise<void> {
    try {
      if (!this.audioContext) {
        await this.resumeAudioContext();
      }

      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
      
      this.sounds.set(name, audioBuffer);
      console.log(`[SoundManager] Loaded sound: ${name}`);
    } catch (error) {
      console.error(`[SoundManager] Error loading sound ${name}:`, error);
    }
  }

  async playSound(name: string, volume: number = 1.0): Promise<void> {
    try {
      if (!this.audioContext) {
        await this.resumeAudioContext();
      }

      const audioBuffer = this.sounds.get(name);
      if (!audioBuffer) {
        console.warn(`[SoundManager] Sound not found: ${name}`);
        return;
      }

      const source = this.audioContext!.createBufferSource();
      const gainNode = this.audioContext!.createGain();
      
      source.buffer = audioBuffer;
      gainNode.gain.value = volume;
      
      source.connect(gainNode);
      gainNode.connect(this.audioContext!.destination);
      
      source.start();
      console.log(`[SoundManager] Playing sound: ${name}`);
    } catch (error) {
      console.error(`[SoundManager] Error playing sound ${name}:`, error);
    }
  }

  dispose(): void {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    this.sounds.clear();
    console.log('[SoundManager] Sound manager disposed');
  }
} 