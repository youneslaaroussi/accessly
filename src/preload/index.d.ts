import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      llm: {
        sendMessage: (message: string, enableTools?: boolean) => Promise<void>
        halt: () => Promise<{ success: boolean; error?: string }>
        getConnectionStatus: () => Promise<{ connected: boolean; provider: string; status: string; error?: string }>
        onStreamChunk: (callback: (chunk: string) => void) => () => void
        onStreamEnd: (callback: () => void) => () => void
      }
      app: {
        checkInitializationStatus: () => Promise<{ isInitialized: boolean; error: string | null }>
        onLoadingStatusUpdate: (callback: (message: string) => void) => () => void
        onInitializationComplete: (callback: () => void) => () => void
        onInitializationError: (callback: (error: string) => void) => () => void
        onMainConsoleLog: (callback: (data: { type: string, args: string[] }) => void) => () => void
      }
      stt: {
        transcribe: (audioBuffer: Uint8Array) => Promise<string | null>
      }
      tts: {
        speak: (text: string, voice?: string, speed?: number) => Promise<void>
        stop: () => Promise<void>
        clearQueue: () => Promise<void>
        getQueueLength: () => Promise<number>
        getVoices: () => Promise<string[]>
        onStarted: (callback: () => void) => () => void
        onComplete: (callback: () => void) => () => void
        onError: (callback: (error: string) => void) => () => void
      }
      computer: {
        openWindow: () => Promise<void>
        getTools: () => Promise<Array<{
          name: string
          description: string
          parameters: {
            type: string
            properties: Record<string, any>
            required: string[]
          }
        }>>
        executeFunction: (functionName: string, parameters: Record<string, any>) => Promise<{
          success: boolean
          data?: any
          error?: string
        }>
      }
    }
  }
}
