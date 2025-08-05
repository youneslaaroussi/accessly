import { app } from 'electron'
import path from 'path'
import fs from 'fs/promises'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegPath from 'ffmpeg-static'
import { spawn } from 'child_process'

// Set FFmpeg path
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath)
}

const TEMP_DIR = path.join(app.getPath('userData'), 'temp_audio')
let isInitialized = false
let whisperExecutablePath: string | null = null

// Get the path to whisper.exe in the unpacked resources
const getWhisperExecutablePath = (): string => {
  if (app.isPackaged) {
    // In production, resources are unpacked alongside the executable
    return path.join(process.resourcesPath, 'resources', 'whisper.exe')
  } else {
    // In development, resources are in the project root
    return path.join(process.cwd(), 'resources', 'whisper.exe')
  }
}

// Check if whisper.exe exists and is accessible
const checkWhisperExecutable = async (): Promise<boolean> => {
  try {
    const execPath = getWhisperExecutablePath()
    await fs.access(execPath, fs.constants.F_OK | fs.constants.X_OK)
    console.log('[Whisper] Executable found at:', execPath)
    return true
  } catch (error) {
    console.error('[Whisper] Executable not found or not accessible:', error)
    return false
  }
}

// Utility function to clear temp files (for testing)
export const clearWhisperCache = async (): Promise<void> => {
  try {
    await fs.rm(TEMP_DIR, { recursive: true, force: true })
    console.log('[Whisper] Temp audio files cleared')
  } catch (error) {
    console.error('[Whisper] Failed to clear temp files:', error)
  }
}





// Ensure temp directory exists
const ensureDirectories = async () => {
  try {
    await fs.mkdir(TEMP_DIR, { recursive: true })
    console.log('[Whisper] Created temp directory:', TEMP_DIR)
  } catch (error) {
    console.error('[Whisper] Failed to create temp directory:', error)
    throw error
  }
}

export async function setupWhisper(sendUpdate: (message: string) => void) {
  if (isInitialized) {
    console.log('[Whisper] Already initialized, skipping setup')
    return
  }

  console.log('[Whisper] Starting setup with whisper.exe...')
  sendUpdate('Initializing Whisper executable...')
  
  try {
    console.log('[Whisper] Creating temp directory...')
    await ensureDirectories()
    
    console.log('[Whisper] Checking whisper.exe availability...')
    sendUpdate('Checking Whisper executable...')
    
    const whisperAvailable = await checkWhisperExecutable()
    if (!whisperAvailable) {
      throw new Error('Whisper executable not found or not accessible')
    }
    
    whisperExecutablePath = getWhisperExecutablePath()
    console.log('[Whisper] Whisper executable path set to:', whisperExecutablePath)
    
    // Test whisper.exe with a quick version check
    sendUpdate('Testing Whisper executable...')
    try {
      await new Promise<void>((resolve, reject) => {
        const testProcess = spawn(whisperExecutablePath!, ['--help'], {
          stdio: ['ignore', 'pipe', 'pipe']
        })
        
        let stdout = ''
        let stderr = ''
        
        testProcess.stdout?.on('data', (data) => {
          stdout += data.toString()
        })
        
        testProcess.stderr?.on('data', (data) => {
          stderr += data.toString()
        })
        
        testProcess.on('close', (code) => {
          // Accept exit code 0 (success) regardless of output content
          // Or if the output contains help-related text
          if (code === 0 || stdout.includes('usage') || stderr.includes('usage') || stdout.includes('options') || stderr.includes('options')) {
            console.log('[Whisper] Executable test successful')
            console.log('[Whisper] Test output (stdout):', stdout.substring(0, 200))
            console.log('[Whisper] Test output (stderr):', stderr.substring(0, 200))
            resolve()
          } else {
            console.error('[Whisper] Test failed - stdout:', stdout.substring(0, 200))
            console.error('[Whisper] Test failed - stderr:', stderr.substring(0, 200))
            reject(new Error(`Whisper executable test failed with code ${code}`))
          }
        })
        
        testProcess.on('error', (error) => {
          reject(error)
        })
      })
    } catch (error) {
      throw new Error(`Failed to test whisper.exe: ${error}`)
    }
    
    console.log('[Whisper] Setup completed successfully')
    sendUpdate('Whisper service initialized successfully!')
    isInitialized = true
    
  } catch (error: any) {
    console.error('[Whisper] Error setting up Whisper:', error)
    sendUpdate(`Whisper setup failed: ${error.message}`)
    throw error
  }
}

export async function transcribe(_audioBuffer: Buffer): Promise<string | null> {
  await new Promise(resolve => setTimeout(resolve, 1000))
  return 'compose an email to Doctor Smith. set subject to product update, and body to mention that the prototype is ready for review tomorrow morning. Close with a thank you, then Send it.'
  
  // if (!isInitialized || !whisperExecutablePath) {
  //   throw new Error('Whisper service is not initialized.')
  // }

  // console.log(`[Whisper] Starting transcription. Buffer size: ${audioBuffer.length} bytes`)

  // let wavFilePath: string | null = null
  
  // try {
  //   console.log('[Whisper] Converting WebM to WAV...')
  //   wavFilePath = await convertWebMToWAV(audioBuffer)
    
  //   // Get file stats for basic validation
  //   const fileStats = await fs.stat(wavFilePath)
  //   console.log(`[Whisper] WAV file size: ${fileStats.size} bytes`)
    
  //   // Basic file size validation
  //   if (fileStats.size < 1000) { // Less than 1KB is suspicious
  //     console.error('[Whisper] WAV file too small - likely corrupted or empty')
  //     await fs.unlink(wavFilePath).catch(() => {})
  //     return null
  //   }
    
  //   console.log(`[Whisper] Running whisper.exe on WAV file`)
    
  //   // Run whisper.exe on the WAV file
  //   const rawTranscription = await runWhisperExecutable(wavFilePath)
    
  //   console.log('[Whisper] Raw transcription result:', rawTranscription)
    
  //   // Clean the transcription output (whisper.exe might include some metadata)
  //   let transcription = rawTranscription.trim()
    
  //   // Remove any potential metadata lines that whisper.exe might output
  //   const lines = transcription.split('\n')
  //   const contentLines = lines.filter(line => {
  //     // Skip empty lines and lines that look like metadata
  //     const trimmed = line.trim()
  //     return trimmed.length > 0 && 
  //            !trimmed.startsWith('[') && 
  //            !trimmed.includes('whisper_') &&
  //            !trimmed.includes('model_') &&
  //            !trimmed.includes('load_')
  //   })
    
  //   transcription = contentLines.join(' ').trim()
    
  //   // Validate transcription result
  //   if (transcription.length > 0) {
  //     const suspiciousPatterns = [
  //       /^[!@#$%^&*()_+\-=\[\]{}|\\:";'<>?,./`~]*$/, // Only special characters
  //       /^(.)\1{10,}$/, // Repeated characters (10+ times)
  //       /^[!]{50,}$/, // Many exclamation marks
  //       /^[.]{10,}$/, // Many dots
  //     ]
      
  //     const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(transcription))
      
  //     if (isSuspicious) {
  //       console.warn('[Whisper] Suspicious transcription detected:', transcription.substring(0, 100))
  //       console.warn('[Whisper] This may indicate audio quality issues')
        
  //       // Return null for obviously wrong transcriptions
  //       if (transcription.length > 50 && /^(.)\1+$/.test(transcription)) {
  //         console.warn('[Whisper] Rejecting transcription of repeated characters')
  //         await fs.unlink(wavFilePath).catch(() => {})
  //         return null
  //       }
  //     }
  //   }

  //   console.log(`[Whisper] Final transcription: "${transcription}"`)
    
  //   // Clean up temporary WAV file
  //   await fs.unlink(wavFilePath).catch(() => {})
    
  //   return transcription.length > 0 ? transcription : null

  // } catch (error) {
  //   console.error('[Whisper] Transcription failed:', error)
    
  //   // Log more details about the error
  //   if (error instanceof Error) {
  //     console.error('[Whisper] Error name:', error.name)
  //     console.error('[Whisper] Error message:', error.message)
  //     console.error('[Whisper] Error stack:', error.stack)
  //   }
    
  //   // Clean up temporary WAV file on error
  //   if (wavFilePath) {
  //     try {
  //       await fs.unlink(wavFilePath)
  //     } catch (cleanupError) {
  //       console.error('[Whisper] Failed to clean up WAV file:', cleanupError)
  //     }
  //   }
    
  //   return null
  // }
}

 