import type { ISpeechOutput, SpeechOutputData } from '../../core/interfaces/ISpeechOutput';

export class BrowserSpeechOutput implements ISpeechOutput {
  private onDataCallback: ((data: SpeechOutputData) => void) | null = null;
  private onCompleteCallback: (() => void) | null = null;
  private onErrorCallback: ((error: Error) => void) | null = null;
  private isCurrentlyPlaying: boolean = false;
  private audioData: Float32Array = new Float32Array(0);
  private cleanupCallbacks: (() => void)[] = []

  constructor() {
    console.log('[SpeechOutput] Python Piper TTS initialized');
    this.setupTtsListeners();
  }

  private setupTtsListeners(): void {
    const onStarted = window.api.tts.onStarted(() => {
      console.log('[SpeechOutput] Python Piper TTS started');
      this.isCurrentlyPlaying = true;
      this.generateFakeAudioData();
      if (this.onDataCallback) {
        this.onDataCallback({
          audioData: this.audioData,
          isPlaying: true
        });
      }
    });

    const onComplete = window.api.tts.onComplete(() => {
      console.log('[SpeechOutput] Python Piper TTS completed');
      this.isCurrentlyPlaying = false;
      this.audioData = new Float32Array(0);
      if (this.onDataCallback) {
        this.onDataCallback({
          audioData: this.audioData,
          isPlaying: false
        });
      }
      if (this.onCompleteCallback) {
        this.onCompleteCallback();
      }
    });

    const onError = window.api.tts.onError((error: string) => {
      console.error('[SpeechOutput] Python Piper TTS error:', error);
      this.isCurrentlyPlaying = false;
      this.audioData = new Float32Array(0);
      if (this.onErrorCallback) {
        this.onErrorCallback(new Error(error));
      }
    });

    this.cleanupCallbacks.push(onStarted, onComplete, onError);
  }

  async speak(text: string): Promise<void> {
    console.log('[SpeechOutput] Speaking with Python Piper:', text);
    
    try {
      // Stop any current speech
      await this.stop();

      // Use Python Piper TTS via IPC (uses default male voice)
      await window.api.tts.speak(text);
      
    } catch (error) {
      console.error('[SpeechOutput] Error in speak method:', error);
      if (this.onErrorCallback) {
        this.onErrorCallback(error as Error);
      }
      throw error;
    }
  }

  async stop(): Promise<void> {
    console.log('[SpeechOutput] Stopping speech...');
    
    // Stop Python Piper TTS
    try {
      await window.api.tts.stop();
    } catch (error) {
      console.error('[SpeechOutput] Error stopping TTS:', error);
    }

    this.isCurrentlyPlaying = false;
    this.audioData = new Float32Array(0);
    
    if (this.onDataCallback) {
      this.onDataCallback({
        audioData: this.audioData,
        isPlaying: false
      });
    }
  }

  private generateFakeAudioData(): void {
    // Generate simple fake audio data for visualization while TTS is playing
    const sampleRate = 44100;
    const duration = 0.1; // 100ms
    const samples = sampleRate * duration;
    this.audioData = new Float32Array(samples);
    
    for (let i = 0; i < samples; i++) {
      // Generate simple waveform pattern
      this.audioData[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.3; // 440Hz tone
    }
  }

  onData(callback: (data: SpeechOutputData) => void): void {
    this.onDataCallback = callback;
  }

  onComplete(callback: () => void): void {
    this.onCompleteCallback = callback;
  }

  onError(callback: (error: Error) => void): void {
    this.onErrorCallback = callback;
  }

  getAudioData(): Float32Array {
    return this.audioData;
  }

  isPlaying(): boolean {
    return this.isCurrentlyPlaying;
  }

  warmupEngine(): void {
    // No warmup needed for browser-based TTS
    console.log('[SpeechOutput] Warmup engine called (no-op for browser TTS)');
  }

  dispose(): void {
    this.cleanupCallbacks.forEach(cleanup => cleanup());
    this.cleanupCallbacks = [];
    this.stop();
  }
}