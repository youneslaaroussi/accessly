import { app, shell, BrowserWindow, ipcMain, screen, session } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { setupWhisper, transcribe, clearWhisperCache } from './services/whisperService'
import { setupLLM, getLLMService } from './services/llmService'
import { setupTTS, getTTSService } from './services/ttsService'
import { snapshotService } from './services/snapshotService'
import { vectorDbService } from './services/vectorDbService'
import { functionCallingService } from './services/functionCallingService'
import { browserServerService } from './services/browserServerService'


// Track initialization status
let isInitialized = false
let initializationError: string | null = null
let mainWindow: BrowserWindow | null = null
let computerControlWindow: BrowserWindow | null = null

// Console forwarding to Chrome DevTools
let isConsoleForwardingSetup = false
const logQueue: Array<{ type: string, args: string[] }> = []

const forwardConsoleToRenderer = (window: BrowserWindow) => {
  if (isConsoleForwardingSetup) return
  
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info
  }

  const sendToRenderer = (type: string, args: any[]) => {
    const logData = { type, args: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)) }
    
    if (window && !window.isDestroyed() && window.webContents.isLoading() === false) {
      window.webContents.send('main:console-log', logData)
    } else {
      // Queue logs if renderer isn't ready yet
      logQueue.push(logData)
    }
  }

  console.log = (...args) => {
    originalConsole.log(...args)
    sendToRenderer('log', args)
  }

  console.error = (...args) => {
    originalConsole.error(...args)
    sendToRenderer('error', args)
  }

  console.warn = (...args) => {
    originalConsole.warn(...args)
    sendToRenderer('warn', args)
  }

  console.info = (...args) => {
    originalConsole.info(...args)
    sendToRenderer('info', args)
  }

  // Send queued logs when renderer is ready
  window.webContents.on('did-finish-load', () => {
    console.log('[Main] Renderer loaded, sending queued logs:', logQueue.length)
    setTimeout(() => {
      logQueue.forEach(logData => {
        if (window && !window.isDestroyed()) {
          window.webContents.send('main:console-log', logData)
        }
      })
      logQueue.length = 0 // Clear the queue
    }, 1000) // Give renderer time to set up listeners
  })

  isConsoleForwardingSetup = true
  console.log('[Main] Console forwarding setup complete')
}

function createWindow(): BrowserWindow {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 200,
    height: 200,
    show: false,
    autoHideMenuBar: true,
    alwaysOnTop: true,
    frame: false,
    resizable: false,
    transparent: true,
    skipTaskbar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: false,
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  // Set up console forwarding immediately
  forwardConsoleToRenderer(mainWindow)

  mainWindow.on('ready-to-show', () => {
    // Position window at top right corner
    const primaryDisplay = screen.getPrimaryDisplay()
    const { width: screenWidth } = primaryDisplay.workAreaSize
    mainWindow!.setPosition(screenWidth - 200 - 20, 20) // 20px from edges
    mainWindow!.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

function createComputerControlWindow(): BrowserWindow {
  computerControlWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    autoHideMenuBar: true,
    title: 'Computer Control Tools',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: false,
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  computerControlWindow.on('ready-to-show', () => {
    computerControlWindow!.show()
  })

  computerControlWindow.on('closed', () => {
    computerControlWindow = null
  })

  computerControlWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Load a simple HTML page for computer control
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    computerControlWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '/computer-control.html')
  } else {
    computerControlWindow.loadFile(join(__dirname, '../renderer/computer-control.html'))
  }

  return computerControlWindow
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Set up permission handlers to always grant microphone access
  session.defaultSession.setPermissionRequestHandler((_, permission, callback) => {
    console.log(`[Main] Permission requested: ${permission}`)
    
    if (permission === 'media') {
      console.log('[Main] Granting microphone permission automatically')
      callback(true)
    } else {
      // Grant other permissions as well for this personal app
      console.log(`[Main] Granting permission: ${permission}`)
      callback(true)
    }
  })

  // Also handle permission check requests
  session.defaultSession.setPermissionCheckHandler((_, permission, requestingOrigin) => {
    console.log(`[Main] Permission check: ${permission} from ${requestingOrigin}`)
    
    if (permission === 'media') {
      console.log('[Main] Allowing microphone access')
      return true
    }
    
    // Allow other permissions for this personal app
    return true
  })

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  // Initialize services in the background after window is created
  console.log('[Main] Starting service initialization...')

  const sendUpdate = (message: string) => {
    console.log('[Main] Sending update:', message)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('app:loading-status-update', message)
    }
  }

  // Start service initialization immediately (no setTimeout delay)
  try {
    sendUpdate('Starting service initialization...')
    
    // Initialize core services first
    await setupWhisper(sendUpdate)
    await setupLLM(sendUpdate)
    await setupTTS(sendUpdate)
    
    console.log('[Main] Core services initialized successfully')
    sendUpdate('Core services ready. Initializing background services...')

    // Start the browser automation WebSocket server
    sendUpdate('Starting browser automation server...')
    try {
      await browserServerService.start()
      console.log('[Main] Browser automation server started successfully')
      sendUpdate('Browser automation server ready on ws://127.0.0.1:8080')
    } catch (error) {
      console.error('[Main] Failed to start browser automation server:', error)
      sendUpdate('Browser automation server failed to start - browser tools may not work')
    }

    // Start the snapshot service (doesn't need to block)

    // UNCOMMENT THIS TO ENABLE SNAPSHOT SERVICE
    // snapshotService.start(1 * 60 * 1000, 5 * 60 * 1000)
    console.log('[Main] Snapshot service started')

    // Wake word detection now handled in renderer process using React SDK

    // Initialize vector service and wait for it to be ready
    sendUpdate('Initializing vector database...')
    try {
      await vectorDbService.isReady()
      console.log('[Main] Vector database service ready')
      sendUpdate('All services ready!')
      
      // Mark as initialized
      isInitialized = true
      initializationError = null
      
      // Wait a moment to let user see the final message, then signal completion
      setTimeout(() => {
        console.log('[Main] Sending initialization complete signal')
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('app:initialization-complete')
        }
      }, 1000)
      
    } catch (error) {
      console.error('[Main] Vector database service failed:', error)
      sendUpdate('Vector database service failed - search functionality may be limited')
      
      // Still mark as initialized even if vector DB fails
      isInitialized = true
      initializationError = null
      
      setTimeout(() => {
        console.log('[Main] Sending initialization complete signal (with vector DB warning)')
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('app:initialization-complete')
        }
      }, 1000)
    }
    
  } catch (err: any) {
    console.error('[Main] Service initialization failed:', err)
    sendUpdate(`Error during initialization: ${err.message}`)
    
    // Mark initialization as failed
    isInitialized = false
    initializationError = err.message
    
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('app:initialization-error', err.message)
    }
  }

  // IPC handlers
  ipcMain.handle('app:check-initialization-status', async () => {
    return {
      isInitialized,
      error: initializationError
    }
  })

  ipcMain.handle('llm:send-message', async (event, message: string, enableTools: boolean = true) => {
    try {
      const window = BrowserWindow.fromWebContents(event.sender)
      if (window) {
        const llmService = getLLMService()
        await llmService.sendMessage(window, message, enableTools)
      } else {
        console.error('[LLM] Error: Could not find browser window for IPC event.')
      }
    } catch (error) {
      console.error('[LLM] Error processing message:', error)
      event.sender.send('llm:stream-chunk', 'Sorry, I encountered an error processing your request.')
      event.sender.send('llm:stream-end')
    }
  })

  ipcMain.handle('llm:halt', async (event) => {
    try {
      console.log('[LLM] Halt requested by user')
      const llmService = getLLMService()
      llmService.halt()
      
      // Send immediate halt confirmation to UI
      event.sender.send('llm:stream-chunk', 'Response halted by user')
      event.sender.send('llm:stream-end')
      
      return { success: true }
    } catch (error) {
      console.error('[LLM] Error during halt:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // Ollama connection status handler
  ipcMain.handle('llm:get-connection-status', async () => {
    try {
      if (!isInitialized) {
        return { connected: false, provider: 'unknown', status: 'initializing' }
      }
      
      const llmService = getLLMService()
      const connected = await llmService.testConnection()
      
      return { 
        connected, 
        provider: 'ollama', // This could be dynamic based on LLM_PROVIDER from llmService
        status: connected ? 'connected' : 'disconnected'
      }
    } catch (error) {
      console.error('[Main] Error checking LLM connection:', error)
      return { 
        connected: false, 
        provider: 'ollama', 
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  ipcMain.handle('stt:transcribe', async (_, audioBuffer: Uint8Array) => {
    try {
      // Convert Uint8Array back to Buffer for the main process
      const buffer = Buffer.from(audioBuffer)
      return await transcribe(buffer)
    } catch (error) {
      console.error('[STT] Error during transcription:', error)
      return null
    }
  })

  // TTS handlers
  ipcMain.handle('tts:speak', async (event, text: string, _voice?: string, _speed?: number) => {
    try {
      const window = BrowserWindow.fromWebContents(event.sender)
      if (window) {
        const ttsService = getTTSService()
        await ttsService.speak(window, text)
      } else {
        console.error('[TTS] Error: Could not find browser window for IPC event.')
      }
    } catch (error) {
      console.error('[TTS] Error during speech:', error)
      event.sender.send('tts:error', (error as Error).message)
    }
  })

  ipcMain.handle('tts:stop', async () => {
    try {
      const ttsService = getTTSService()
      ttsService.stopAndClearQueue() // Use the new method that clears the queue
    } catch (error) {
      console.error('[TTS] Error stopping speech:', error)
    }
  })

  ipcMain.handle('tts:clearQueue', async () => {
    try {
      const ttsService = getTTSService()
      ttsService.clearQueue()
    } catch (error) {
      console.error('[TTS] Error clearing queue:', error)
    }
  })

  ipcMain.handle('tts:getQueueLength', async () => {
    try {
      const ttsService = getTTSService()
      return ttsService.getQueueLength()
    } catch (error) {
      console.error('[TTS] Error getting queue length:', error)
      return 0
    }
  })

  ipcMain.handle('tts:getVoices', async () => {
    try {
      // getVoices method not implemented in TTS service
      return []
    } catch (error) {
      console.error('[TTS] Error getting voices:', error)
      return []
    }
  })

  ipcMain.handle('search:query', async (_, query: string) => {
    try {
      return await vectorDbService.query(query)
    } catch (error) {
      console.error('[Search] Error during query:', error)
      return []
    }
  })

  // Computer control handlers
  ipcMain.handle('computer:open-window', async () => {
    if (computerControlWindow) {
      computerControlWindow.focus()
    } else {
      createComputerControlWindow()
    }
  })

  ipcMain.handle('computer:get-tools', async () => {
    try {
      return functionCallingService.getAvailableTools()
    } catch (error) {
      console.error('[Computer] Error getting tools:', error)
      return []
    }
  })

  ipcMain.handle('computer:execute-function', async (_, functionName: string, parameters: Record<string, any>) => {
    try {
      return await functionCallingService.executeFunction(functionName, parameters)
    } catch (error) {
      console.error('[Computer] Error executing function:', error)
      return {
        success: false,
        error: (error as Error).message
      }
    }
  })

  // Debug/testing handlers
  ipcMain.handle('whisper:clear-cache', async () => {
    try {
      await clearWhisperCache()
      return { success: true }
    } catch (error) {
      console.error('[Whisper] Error clearing cache:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Cleanup when app is about to quit
app.on('before-quit', async () => {
  console.log('[Main] App is quitting, cleaning up services...')
  
  try {
    // Stop browser automation server
    if (browserServerService.isServerRunning()) {
      console.log('[Main] Stopping browser automation server...')
      await browserServerService.stop()
    }
    
    // Stop snapshot service
    snapshotService.stop()
    
    // Wake word service now handled in renderer process
    
    console.log('[Main] Service cleanup completed')
  } catch (error) {
    console.error('[Main] Error during service cleanup:', error)
  }
})

// In this file you can include the rest of your app"s main process
// code. You can also put them in separate files and require them here.
