export interface SpeechOutputData {
  audioData: Float32Array
  isPlaying: boolean
}

export interface ISpeechOutput {
  speak(text: string): Promise<void>
  stop(): void
  isPlaying(): boolean
  onData(callback: (data: SpeechOutputData) => void): void
  onComplete(callback: () => void): void
  onError(callback: (error: Error) => void): void
  warmupEngine(): void
  dispose(): void
} 