import { spawn, ChildProcess } from 'child_process'
import { BrowserWindow } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'


let isInitialized = false



interface TtsQueueItem {
  window: BrowserWindow
  text: string
  resolve: () => void
  reject: (error: Error) => void
}

export class TtsService {
  private currentProcess: ChildProcess | null = null
  private defaultVoice = 'en_US-lessac-medium'
  private piperDataDir: string
  private pythonCmd: string = ''
  private ttsQueue: TtsQueueItem[] = []
  private isProcessingQueue: boolean = false

  constructor() {
    this.piperDataDir = path.join(os.homedir(), '.piper-tts')
  }

  async speak(window: BrowserWindow, text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('[TTS] Immediate interrupt and speak:', text)
      
      // Check if Piper is initialized
      if (!this.pythonCmd) {
        const error = new Error('Piper TTS not initialized')
        console.error('[TTS]', error.message)
        window.webContents.send('tts:error', error.message)
        reject(error)
        return
      }
      
      // IMMEDIATELY INTERRUPT: Stop current speech and clear queue
      this.stopCurrentSpeech()
      this.clearQueue()
      
      // Add only the new item to queue
      this.ttsQueue.push({
        window,
        text,
        resolve,
        reject
      })
      
      // Start processing immediately
      this.processQueue()
    })
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.ttsQueue.length === 0) {
      return
    }

    this.isProcessingQueue = true
    console.log(`[TTS] Starting queue processing, ${this.ttsQueue.length} items in queue`)

    while (this.ttsQueue.length > 0) {
      const item = this.ttsQueue.shift()!
      
      try {
        console.log('[TTS] Processing queue item:', item.text)
        
        // CRITICAL: Make sure no other process is running before starting
        if (this.currentProcess) {
          console.log('[TTS] WARNING: Process already running, killing it first')
          this.currentProcess.kill('SIGTERM')
          this.currentProcess = null
          // Give it a moment to cleanup
          await new Promise(resolve => setTimeout(resolve, 100))
        }
        
        await this.speakWithPiper(item.window, item.text)
        item.resolve()
      } catch (error: any) {
        console.error('[TTS] Queue item failed:', error.message)
        const errorMsg = `TTS failed: ${error.message}`
        item.window.webContents.send('tts:error', errorMsg)
        item.reject(error)
      }
    }

    this.isProcessingQueue = false
    console.log('[TTS] Queue processing completed')
  }

  private stopCurrentSpeech(): void {
    if (this.currentProcess) {
      console.log('[TTS] Stopping current speech process')
      this.currentProcess.kill('SIGTERM')
      this.currentProcess = null
    }
    
    // Stop queue processing
    this.isProcessingQueue = false
  }



  private async speakWithPiper(window: BrowserWindow, text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // ABSOLUTE SAFETY: Ensure no process is running
        if (this.currentProcess) {
          console.error('[TTS] CRITICAL ERROR: Process already running in speakWithPiper!')
          this.currentProcess.kill('SIGKILL') // Force kill
          this.currentProcess = null
        }
        
        // Create temp file for audio output
        const tempFile = path.join(os.tmpdir(), `echovault_piper_${Date.now()}.wav`)
        
        // Use Python Piper with file output (avoids Windows audio playback issues)
        const args = [
          '-m', 'piper',
          '-m', this.defaultVoice,
          '--data-dir', this.piperDataDir,
          '--output-file', tempFile,
          '--',
          text
        ]

        console.log('[TTS] Running Python Piper:', this.pythonCmd, args.join(' '))
        
        this.currentProcess = spawn(this.pythonCmd, args)
        
        this.currentProcess.on('error', (error) => {
          console.error('[TTS] Python Piper process error:', error)
          reject(error)
        })
        
        this.currentProcess.on('close', (code) => {
          console.log(`[TTS] Python Piper process closed with code ${code}`)
          this.currentProcess = null
          if (code === 0) {
            console.log('[TTS] Python Piper completed successfully, playing audio file')
            
            // Play the generated WAV file using Windows Media Player
            const playProcess = spawn('powershell', [
              '-Command', 
              `Add-Type -AssemblyName presentationCore; 
               $mediaPlayer = New-Object system.windows.media.mediaplayer; 
               $mediaPlayer.open([uri]"${tempFile}"); 
               $mediaPlayer.Play(); 
               Start-Sleep -Seconds 1; 
               while($mediaPlayer.position -lt $mediaPlayer.NaturalDuration.TimeSpan) { Start-Sleep -Milliseconds 100 }; 
               $mediaPlayer.Stop(); 
               $mediaPlayer.Close()`
            ])
            
            playProcess.on('close', (playCode) => {
              // Clean up temp file
              try {
                if (fs.existsSync(tempFile)) {
                  fs.unlinkSync(tempFile)
                }
              } catch (cleanupError) {
                // Ignore cleanup errors
              }
              
              if (playCode === 0) {
                console.log('[TTS] Piper audio playback completed')
                window.webContents.send('tts:complete')
                resolve()
              } else {
                console.error(`[TTS] Audio playback failed with code ${playCode}`)
                window.webContents.send('tts:error', 'Audio playback failed')
                reject(new Error(`Audio playback failed with code ${playCode}`))
              }
            })
            
            playProcess.on('error', (playError) => {
              console.error('[TTS] Playback process error:', playError)
              
              // Clean up temp file
              try {
                if (fs.existsSync(tempFile)) {
                  fs.unlinkSync(tempFile)
                }
              } catch (cleanupError) {
                // Ignore cleanup errors
              }
              
              reject(playError)
            })
            
          } else {
            const errorMsg = `Python Piper exited with code ${code}`
            console.error('[TTS]', errorMsg)
            
            // Clean up temp file on error (ignore if already deleted)
            try {
              if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile)
              }
            } catch (cleanupError) {
              // Ignore cleanup errors - temp files get cleaned up eventually
            }
            
            reject(new Error(errorMsg))
          }
        })

        this.currentProcess.stderr?.on('data', (data) => {
          console.error('[TTS] Python Piper stderr:', data.toString())
        })

        this.currentProcess.stdout?.on('data', (data) => {
          console.log('[TTS] Python Piper stdout:', data.toString())
        })
        
        // Notify renderer that speech started
        window.webContents.send('tts:started')
        
      } catch (error) {
        console.error('[TTS] Error starting Python Piper:', error)
        reject(error)
      }
    })
  }

  stop(): void {
    // Stop current process but keep queue for graceful shutdown
    if (this.currentProcess) {
      console.log('[TTS] Stopping current Python Piper process')
      this.currentProcess.kill('SIGTERM')
      this.currentProcess = null
    }
  }

  stopAndClearQueue(): void {
    // Clear the queue and stop everything
    console.log(`[TTS] Stopping TTS and clearing queue (${this.ttsQueue.length} items)`)
    this.ttsQueue.forEach(item => {
      item.reject(new Error('TTS stopped'))
    })
    this.ttsQueue = []
    this.isProcessingQueue = false

    // Stop Piper process if running
    if (this.currentProcess) {
      console.log('[TTS] Stopping Python Piper process')
      this.currentProcess.kill('SIGTERM')
      this.currentProcess = null
    }
  }

  clearQueue(): void {
    console.log(`[TTS] Clearing TTS queue (${this.ttsQueue.length} items)`)
    this.ttsQueue.forEach(item => {
      item.reject(new Error('TTS queue cleared'))
    })
    this.ttsQueue = []
  }

  getQueueLength(): number {
    return this.ttsQueue.length
  }

  private async ensurePythonAndPiper(): Promise<{ pythonCmd: string; installed: boolean }> {
    // Try both python3 and python commands
    const pythonCommands = ['python3', 'python']
    
    for (const pythonCmd of pythonCommands) {
      const pythonAvailable = await this.checkPythonAvailable(pythonCmd)
      if (pythonAvailable) {
        console.log(`[TTS] Found Python: ${pythonCmd}`)
        
        // Check if Piper is already installed
        const piperInstalled = await this.checkPiperInstalled(pythonCmd)
        if (piperInstalled) {
          console.log('[TTS] Python Piper is already installed')
          return { pythonCmd, installed: true }
        }
        
        // Try to install Piper
        console.log('[TTS] Python Piper not found, attempting installation...')
        const installSuccess = await this.installPiper(pythonCmd)
        return { pythonCmd, installed: installSuccess }
      }
    }
    
    return { pythonCmd: '', installed: false }
  }

  private async checkPythonAvailable(pythonCmd: string): Promise<boolean> {
    return new Promise((resolve) => {
      const testProcess = spawn(pythonCmd, ['--version'])
      
      testProcess.on('close', (code) => {
        resolve(code === 0)
      })
      
      testProcess.on('error', () => {
        resolve(false)
      })
    })
  }

  private async checkPiperInstalled(pythonCmd: string): Promise<boolean> {
    return new Promise((resolve) => {
      const testProcess = spawn(pythonCmd, ['-m', 'piper', '--help'])
      
      testProcess.on('close', (code) => {
        resolve(code === 0)
      })
      
      testProcess.on('error', () => {
        resolve(false)
      })
    })
  }

  private async installPiper(pythonCmd: string): Promise<boolean> {
    return new Promise((resolve) => {
      console.log('[TTS] Installing piper-tts via pip...')
      const installProcess = spawn(pythonCmd, ['-m', 'pip', 'install', 'piper-tts'])
      
      installProcess.stdout?.on('data', (data) => {
        console.log('[TTS] Install stdout:', data.toString().trim())
      })
      
      installProcess.stderr?.on('data', (data) => {
        console.log('[TTS] Install stderr:', data.toString().trim())
      })
      
      installProcess.on('close', (code) => {
        if (code === 0) {
          console.log('[TTS] piper-tts installed successfully')
          resolve(true)
        } else {
          console.error(`[TTS] Failed to install piper-tts (exit code: ${code})`)
          resolve(false)
        }
      })
      
      installProcess.on('error', (error) => {
        console.error('[TTS] Error installing piper-tts:', error)
        resolve(false)
      })
    })
  }

  private async downloadDefaultVoice(): Promise<boolean> {
    return new Promise((resolve) => {
      console.log(`[TTS] Downloading default voice: ${this.defaultVoice}`)
      
      // Ensure data directory exists
      if (!fs.existsSync(this.piperDataDir)) {
        fs.mkdirSync(this.piperDataDir, { recursive: true })
      }
      
      const downloadProcess = spawn(this.pythonCmd, [
        '-m', 'piper.download_voices',
        '--data-dir', this.piperDataDir,
        this.defaultVoice
      ])
      
      downloadProcess.stdout?.on('data', (data) => {
        console.log('[TTS] Download progress:', data.toString().trim())
      })
      
      downloadProcess.stderr?.on('data', (data) => {
        console.log('[TTS] Download info:', data.toString().trim())
      })
      
      downloadProcess.on('close', (code) => {
        if (code === 0) {
          console.log(`[TTS] Successfully downloaded voice: ${this.defaultVoice}`)
          resolve(true)
        } else {
          console.error(`[TTS] Failed to download voice: ${this.defaultVoice}`)
          resolve(false)
        }
      })
      
      downloadProcess.on('error', (error) => {
        console.error('[TTS] Error downloading voice:', error)
        resolve(false)
      })
    })
  }

  async initialize(): Promise<boolean> {
    console.log('[TTS] Initializing Python Piper TTS service...')
    
    try {
      // Check Python availability and Piper installation
      const { pythonCmd, installed } = await this.ensurePythonAndPiper()
      
      if (pythonCmd && installed) {
        // Store the working python command
        this.pythonCmd = pythonCmd
        console.log(`[TTS] Using Python command: ${this.pythonCmd}`)
        
        // Check if default voice exists
        const voiceFile = path.join(this.piperDataDir, `${this.defaultVoice}.onnx`)
        if (!fs.existsSync(voiceFile)) {
          console.log('[TTS] Default voice not found, downloading...')
          const voiceDownloaded = await this.downloadDefaultVoice()
          if (!voiceDownloaded) {
            throw new Error('Failed to download Piper voice')
          }
        } else {
          console.log('[TTS] Default voice already available')
        }
        
        console.log('[TTS] Python Piper TTS initialized successfully')
        return true
      } else {
        throw new Error('Python or Piper not available')
      }
    } catch (error: any) {
      console.error('[TTS] Piper initialization failed:', error.message)
      return false
    }
  }
}

// Global service instance
let ttsServiceInstance: TtsService | null = null

export async function setupTTS(sendUpdate: (message: string) => void): Promise<void> {
  if (isInitialized) {
    console.log('[TTS] Already initialized, skipping setup')
    return
  }

  console.log('[TTS] Starting Python Piper TTS setup...')
  sendUpdate('Initializing Python Piper TTS service...')
  
  try {
    ttsServiceInstance = new TtsService()
    
    // Initialize Python Piper (install if needed, download voice)
    const initialized = await ttsServiceInstance.initialize()
    if (!initialized) {
      console.error('[TTS] Failed to initialize Python Piper TTS')
      sendUpdate('TTS setup failed: Could not install Piper or download voice')
      throw new Error('Failed to initialize Python Piper TTS')
    }
    
    sendUpdate('Python Piper TTS service initialized successfully!')
    console.log('[TTS] Python Piper setup completed successfully')
    isInitialized = true
  } catch (error: any) {
    console.error('[TTS] Error setting up Python Piper TTS service:', error)
    sendUpdate(`Python Piper TTS setup failed: ${error.message}`)
    throw error
  }
}

export function getTTSService(): TtsService {
  if (!ttsServiceInstance) {
    throw new Error('TTS service not initialized. Call setupTTS first.')
  }
  return ttsServiceInstance
} 