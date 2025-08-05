import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  llm: {
    sendMessage: (message: string, enableTools?: boolean) => ipcRenderer.invoke('llm:send-message', message, enableTools),
    halt: () => ipcRenderer.invoke('llm:halt'),
    getConnectionStatus: () => ipcRenderer.invoke('llm:get-connection-status'),
    onStreamChunk: (callback: (chunk: string) => void) => {
      const handler = (_: any, chunk: string) => callback(chunk)
      ipcRenderer.on('llm:stream-chunk', handler)
      return () => ipcRenderer.removeListener('llm:stream-chunk', handler)
    },
    onStreamEnd: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on('llm:stream-end', handler)
      return () => ipcRenderer.removeListener('llm:stream-end', handler)
    }
  },
  app: {
    checkInitializationStatus: () => ipcRenderer.invoke('app:check-initialization-status'),
    onLoadingStatusUpdate: (callback: (message: string) => void) => {
      const handler = (_: any, message: string) => callback(message)
      ipcRenderer.on('app:loading-status-update', handler)
      return () => ipcRenderer.removeListener('app:loading-status-update', handler)
    },
    onInitializationComplete: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on('app:initialization-complete', handler)
      return () => ipcRenderer.removeListener('app:initialization-complete', handler)
    },
    onInitializationError: (callback: (error: string) => void) => {
      const handler = (_: any, error: string) => callback(error)
      ipcRenderer.on('app:initialization-error', handler)
      return () => ipcRenderer.removeListener('app:initialization-error', handler)
    },
    onMainConsoleLog: (callback: (data: { type: string, args: string[] }) => void) => {
      const handler = (_: any, data: { type: string, args: string[] }) => callback(data)
      ipcRenderer.on('main:console-log', handler)
      return () => ipcRenderer.removeListener('main:console-log', handler)
    }
  },
  stt: {
    transcribe: (audioBuffer: Uint8Array) => ipcRenderer.invoke('stt:transcribe', audioBuffer)
  },
  tts: {
    speak: (text: string, voice?: string, speed?: number) => ipcRenderer.invoke('tts:speak', text, voice, speed),
    stop: () => ipcRenderer.invoke('tts:stop'),
    clearQueue: () => ipcRenderer.invoke('tts:clearQueue'),
    getQueueLength: () => ipcRenderer.invoke('tts:getQueueLength'),
    getVoices: () => ipcRenderer.invoke('tts:getVoices'),
    onStarted: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on('tts:started', handler)
      return () => ipcRenderer.removeListener('tts:started', handler)
    },
    onComplete: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on('tts:complete', handler)
      return () => ipcRenderer.removeListener('tts:complete', handler)
    },
    onError: (callback: (error: string) => void) => {
      const handler = (_: any, error: string) => callback(error)
      ipcRenderer.on('tts:error', handler)
      return () => ipcRenderer.removeListener('tts:error', handler)
    }
  },
  computer: {
    openWindow: () => ipcRenderer.invoke('computer:open-window'),
    getTools: () => ipcRenderer.invoke('computer:get-tools'),
    executeFunction: (functionName: string, parameters: Record<string, any>) => 
      ipcRenderer.invoke('computer:execute-function', functionName, parameters)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
