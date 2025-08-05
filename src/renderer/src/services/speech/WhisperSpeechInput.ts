import type { ISpeechInput, SpeechInputData, SpeechRecognizedData } from '../../core/interfaces/ISpeechInput';
import { useConfigurationStore } from '../../core/state/useConfigurationStore';

export class WhisperSpeechInput implements ISpeechInput {
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array | null = null;
  private frequencyDataArray: Uint8Array | null = null;
  private animationFrameId: number | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];

  private onDataCallback: ((data: SpeechInputData) => void) | null = null;
  private onSpeechRecognizedCallback: ((data: SpeechRecognizedData) => void) | null = null;
  private onListeningEndedCallback: (() => void) | null = null;
  private onErrorCallback: ((error: any) => void) | null = null;
  private isStopping: boolean = false;
  private isTranscribing: boolean = false;

  async start(): Promise<void> {
    console.log('[WhisperInput] Starting speech input...');
    this.isStopping = false;
    this.isTranscribing = false;
    this.audioChunks = [];

    try {
      const { microphoneDeviceId } = useConfigurationStore.getState();
      const constraints: MediaStreamConstraints = {
        audio: microphoneDeviceId ? { deviceId: { exact: microphoneDeviceId } } : true
      };

      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.audioContext = new AudioContext({ sampleRate: 16000 });
      
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);
      
      const bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);
      this.frequencyDataArray = new Uint8Array(bufferLength);
      
      this.mediaRecorder = new MediaRecorder(this.mediaStream);
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log(`[WhisperInput] Audio chunk received: ${event.data.size} bytes (total chunks: ${this.audioChunks.length + 1})`);
          this.audioChunks.push(event.data);
        } else {
          console.log('[WhisperInput] Received empty data chunk');
        }
      };

      this.mediaRecorder.onstop = async () => {
        console.log(`[WhisperInput] MediaRecorder onstop event fired! isStopping: ${this.isStopping}, chunks: ${this.audioChunks.length}, total size: ${this.audioChunks.reduce((sum, chunk) => sum + chunk.size, 0)} bytes`);
        
        // onstop fired successfully
        
        if (this.isStopping) {
          console.log('[WhisperInput] Calling transcribeAudio from onstop handler...');
          await this.transcribeAudio();
        } else {
          console.log('[WhisperInput] Not calling transcribeAudio because isStopping is false');
        }
      };

      this.mediaRecorder.onerror = (event) => {
        console.error('[WhisperInput] MediaRecorder error:', event);
        if (this.onErrorCallback) {
          this.onErrorCallback(event);
        }
      };

      this.mediaRecorder.onstart = () => {
        console.log('[WhisperInput] MediaRecorder started recording');
      };

      this.mediaRecorder.onpause = () => {
        console.log('[WhisperInput] MediaRecorder paused');
      };

      this.mediaRecorder.onresume = () => {
        console.log('[WhisperInput] MediaRecorder resumed');
      };

      // Start recording with specific time slice to ensure ondataavailable fires
      this.mediaRecorder.start(1000); // Request data every 1000ms
      this.updateAudioData();
      
      console.log(`[WhisperInput] MediaRecorder.start() called. State: ${this.mediaRecorder.state}`);
    } catch (error) {
      console.error('[WhisperInput] Error starting speech input:', error);
      if (this.onErrorCallback) {
        this.onErrorCallback(error);
      }
      throw error;
    }
  }

  private async transcribeAudio(): Promise<void> {
    console.log(`[WhisperInput] transcribeAudio called. Audio chunks: ${this.audioChunks.length}, isTranscribing: ${this.isTranscribing}`);
    
    // Prevent duplicate transcription attempts
    if (this.isTranscribing) {
      console.log('[WhisperInput] Already transcribing, skipping duplicate call');
      return;
    }
    
    if (this.audioChunks.length === 0) {
      console.log('[WhisperInput] No audio chunks to transcribe.');
      if (this.onListeningEndedCallback) {
        this.onListeningEndedCallback();
      }
      return;
    }

    try {
      this.isTranscribing = true;
      console.log('[WhisperInput] Starting transcription process...');
      
      const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
      const arrayBuffer = await audioBlob.arrayBuffer();
      // Convert ArrayBuffer to Uint8Array for IPC transfer (Buffer is Node.js only)
      const audioBuffer = new Uint8Array(arrayBuffer);
      
      console.log(`[WhisperInput] Calling transcribe with buffer size: ${audioBuffer.length} bytes`);
      const transcript = await window.api.stt.transcribe(audioBuffer);
      console.log(`[WhisperInput] Received transcript: "${transcript}"`);

      // Filter out blank audio messages and other non-meaningful transcripts
      const isValidTranscript = transcript && 
                               transcript.trim().length > 0 && 
                               !transcript.includes('[BLANK_AUDIO]') &&
                               !transcript.startsWith('>>') &&
                               transcript.trim() !== 'Thank you.' && // Common whisper hallucination
                               transcript.trim().length > 2; // Avoid very short spurious results
      
      if (isValidTranscript && this.onSpeechRecognizedCallback) {
        console.log('[WhisperInput] Calling speech recognized callback');
        this.onSpeechRecognizedCallback({ text: transcript, isFinal: true });
      } else {
        console.log('[WhisperInput] Invalid or blank transcript filtered out:', transcript);
      }
    } catch (error) {
      console.error('[WhisperInput] Transcription failed:', error);
      if (this.onErrorCallback) {
        this.onErrorCallback(error);
      }
    } finally {
      this.isTranscribing = false;
      console.log('[WhisperInput] Transcription process completed');
      if (this.onListeningEndedCallback) {
        this.onListeningEndedCallback();
      }
    }
  }

  private updateAudioData = () => {
    if (!this.analyser || !this.dataArray || !this.frequencyDataArray) return;

    this.analyser.getByteTimeDomainData(this.dataArray! as Uint8Array<ArrayBuffer>);
    this.analyser.getByteFrequencyData(this.frequencyDataArray! as Uint8Array<ArrayBuffer>);

    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      const v = (this.dataArray[i] - 128) / 128;
      sum += v * v;
    }
    const volume = Math.sqrt(sum / this.dataArray.length);

    if (this.onDataCallback) {
      this.onDataCallback({
        volume,
        audioData: new Uint8Array(this.dataArray),
        frequencyData: new Uint8Array(this.frequencyDataArray),
        isActive: this.isListening()
      });
    }

    if (this.isListening()) {
      this.animationFrameId = requestAnimationFrame(this.updateAudioData);
    }
  };

  stop(): void {
    console.log(`[WhisperInput] stop() called. Current state - MediaRecorder: ${this.mediaRecorder?.state}, isStopping: ${this.isStopping}, chunks: ${this.audioChunks.length}`);
    
    this.isStopping = true;

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
      console.log('[WhisperInput] Cancelled animation frame');
    }

    // Stop media stream first to prevent more chunks
    if (this.mediaStream) {
      console.log('[WhisperInput] Stopping media stream tracks');
      this.mediaStream.getTracks().forEach(track => {
        console.log(`[WhisperInput] Stopping track: ${track.kind}, state: ${track.readyState}`);
        track.stop();
      });
      this.mediaStream = null;
    }

    if (this.mediaRecorder) {
      console.log(`[WhisperInput] MediaRecorder current state: ${this.mediaRecorder.state}`);
      
      if (this.mediaRecorder.state === 'recording') {
        console.log('[WhisperInput] Stopping MediaRecorder...');
        this.mediaRecorder.stop();
        // transcribeAudio will be called in the onstop event handler
      } else {
        console.log('[WhisperInput] MediaRecorder not recording, calling transcribeAudio directly');
        this.transcribeAudio().catch(console.error);
      }
    } else {
      console.log('[WhisperInput] No MediaRecorder found, calling transcribeAudio directly');
      this.transcribeAudio().catch(console.error);
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      console.log(`[WhisperInput] Closing audio context (current state: ${this.audioContext.state})`);
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  onData(callback: (data: SpeechInputData) => void): void {
    this.onDataCallback = callback;
  }

  onSpeechRecognized(callback: (data: SpeechRecognizedData) => void): void {
    this.onSpeechRecognizedCallback = callback;
  }

  onListeningEnded(callback: () => void): void {
    this.onListeningEndedCallback = callback;
  }

  onError(callback: (error: Error) => void): void {
    this.onErrorCallback = callback;
  }

  isListening(): boolean {
    return this.mediaStream !== null && !this.isStopping;
  }

  dispose(): void {
    this.stop();
  }
} 