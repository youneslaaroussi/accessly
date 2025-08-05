export interface SpeechInputData {
  volume: number
  audioData: Uint8Array
  frequencyData: Uint8Array
  isActive: boolean
}

export interface SpeechRecognizedData {
  text: string
  isFinal: boolean
}

export interface ISpeechInput {
  start(): Promise<void>
  stop(): void
  onData(callback: (data: SpeechInputData) => void): void
  onSpeechRecognized(callback: (data: SpeechRecognizedData) => void): void
  onListeningEnded(callback: () => void): void
  onError(callback: (error: Error) => void): void
  isListening(): boolean
  dispose(): void
} 