import { WebSocket, WebSocketServer } from 'ws'
import { functionCallingService } from './functionCallingService'
import express from 'express'
import { createServer } from 'http'

interface BrowserToolRequest {
  toolName: string
  parameters?: Record<string, any>
  executionId?: string
}

interface BrowserToolResponse {
  success: boolean
  executionId: string
  toolName: string
  result?: any
  error?: string
  timestamp: number
  duration?: number
}

class BrowserServerService {
  private wss: WebSocketServer | null = null
  private httpServer: any = null
  private isRunning: boolean = false
  private connectedClients: Set<WebSocket> = new Set()
  private wsPort: number = 8080
  private httpPort: number = 3001

  constructor() {}

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[BrowserServer] Server is already running')
      return
    }

    try {
      // Start WebSocket server on port 8080
      this.wss = new WebSocketServer({ 
        port: this.wsPort,
        host: '127.0.0.1'
      })

      this.wss.on('connection', (ws: WebSocket) => {
        console.log('[BrowserServer] Accessly Chrome Plugin connected via WebSocket')
        this.connectedClients.add(ws)

        // Send welcome message
        ws.send(JSON.stringify({
          type: 'connection',
          message: 'Connected to EchoVault Browser Automation Server',
          timestamp: Date.now()
        }))

        ws.on('message', async (data: Buffer) => {
          try {
            const rawMessage = data.toString()
            console.log('[BrowserServer] ═══ RECEIVED WEBSOCKET MESSAGE ═══')
            console.log('[BrowserServer] Raw message:', rawMessage)
            
            const parsedMessage = JSON.parse(rawMessage)
            console.log('[BrowserServer] Parsed message structure:', Object.keys(parsedMessage))
            console.log('[BrowserServer] Full parsed message:', parsedMessage)
            
            // Check if this is a response (from browser) or a command (to browser)
            const hasSuccessField = 'success' in parsedMessage
            const hasResultField = 'result' in parsedMessage
            const hasExecutionId = 'executionId' in parsedMessage
            const hasToolName = 'toolName' in parsedMessage && parsedMessage.toolName
            const hasTimestamp = 'timestamp' in parsedMessage
            
            console.log('[BrowserServer] Message analysis:')
            console.log('[BrowserServer]   - Has success field:', hasSuccessField)
            console.log('[BrowserServer]   - Has result field:', hasResultField) 
            console.log('[BrowserServer]   - Has executionId:', hasExecutionId)
            console.log('[BrowserServer]   - Has toolName:', hasToolName, '(value:', parsedMessage.toolName, ')')
            console.log('[BrowserServer]   - Has timestamp:', hasTimestamp)
            
            // This looks like a response from the browser extension back to us
            if (hasSuccessField || hasResultField || (hasExecutionId && hasTimestamp)) {
              console.log('[BrowserServer] 🔄 This is a RESPONSE message from browser extension - ignoring')
              console.log('[BrowserServer] ═══ END MESSAGE PROCESSING ═══')
              return
            }
            
            // This looks like a command request (should be rare since we usually send TO browser)
            if (hasToolName) {
              console.log('[BrowserServer] 🛠️  This is a COMMAND request - processing')
              const request: BrowserToolRequest = parsedMessage
              await this.handleToolRequest(ws, request)
            } else {
              console.warn('[BrowserServer] ⚠️  Unexpected message format - neither clear response nor command')
              console.log('[BrowserServer] ═══ END MESSAGE PROCESSING ═══')
            }
            
          } catch (error) {
            console.error('[BrowserServer] ❌ Failed to parse WebSocket message:', error)
            console.error('[BrowserServer] Raw message was:', data.toString())
            ws.send(JSON.stringify({
              success: false,
              error: 'Invalid message format',
              timestamp: Date.now()
            }))
          }
        })

        ws.on('close', () => {
          console.log('[BrowserServer] Accessly Chrome Plugin disconnected from WebSocket')
          this.connectedClients.delete(ws)
        })

        ws.on('error', (error) => {
          console.error('[BrowserServer] WebSocket client error:', error)
          this.connectedClients.delete(ws)
        })
      })

      this.wss.on('error', (error) => {
        console.error('[BrowserServer] WebSocket server error:', error)
      })

      // Start HTTP server on port 3001 as fallback
      const app = express()
      app.use(express.json())



      // Required endpoints according to plugin documentation
      app.get('/ping', (_req, res) => {
        res.json({ success: true, message: 'EchoVault Browser Server is running' })
      })

      app.get('/health', (_req, res) => {
        res.json({ 
          success: true, 
          websocket: this.connectedClients.size > 0,
          connectedClients: this.connectedClients.size 
        })
      })

      app.post('/execute-tool', async (req, res) => {
        try {
          const { toolName, parameters } = req.body
          const result = await this.sendCommandToBrowser(toolName, parameters)
          res.json(result)
        } catch (error) {
          res.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      })

      app.get('/extension/tools', (_req, res) => {
        res.json({
          success: true,
          tools: [
            'goTo', 'back', 'forward', 'getCurrentURL',
            'clickSelector', 'type', 'scrollPage',
            'capturePage', 'highlight', 'waitForSelector'
          ]
        })
      })

      app.post('/extension/run-tool', async (req, res) => {
        try {
          const { toolName, parameters } = req.body
          const result = await this.sendCommandToBrowser(toolName, parameters)
          res.json(result)
        } catch (error) {
          res.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      })

      app.post('/message', (req, res) => {
        console.log('[BrowserServer] Received message via HTTP:', req.body)
        res.json({ success: true, message: 'Message received' })
      })

      this.httpServer = createServer(app)
      this.httpServer.listen(this.httpPort, '127.0.0.1', () => {
        console.log(`[BrowserServer] HTTP server started on http://127.0.0.1:${this.httpPort}`)
      })

      this.isRunning = true
      console.log(`[BrowserServer] Browser automation servers started:`)
      console.log(`  - WebSocket: ws://127.0.0.1:${this.wsPort}`)
      console.log(`  - HTTP: http://127.0.0.1:${this.httpPort}`)
      console.log('[BrowserServer] Waiting for Accessly Chrome Plugin to connect...')

    } catch (error) {
      console.error('[BrowserServer] Failed to start browser servers:', error)
      throw error
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return
    }

    console.log('[BrowserServer] Stopping browser automation servers...')

    // Close all client connections
    this.connectedClients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close()
      }
    })
    this.connectedClients.clear()

    // Close servers
    const promises: Promise<void>[] = []

    if (this.wss) {
      promises.push(new Promise((resolve) => {
        this.wss!.close(() => {
          console.log('[BrowserServer] WebSocket server stopped')
          resolve()
        })
      }))
    }

    if (this.httpServer) {
      promises.push(new Promise((resolve) => {
        this.httpServer!.close(() => {
          console.log('[BrowserServer] HTTP server stopped')
          resolve()
        })
      }))
    }

    await Promise.all(promises)
    this.isRunning = false
    console.log('[BrowserServer] All browser automation servers stopped')
  }

  private async handleToolRequest(ws: WebSocket, request: BrowserToolRequest): Promise<void> {
    const startTime = Date.now()
    
    // Validate request has required fields
    if (!request.toolName) {
      console.error('[BrowserServer] Invalid command - missing toolName:', request)
      ws.send(JSON.stringify({
        success: false,
        executionId: request.executionId || `exec_${Date.now()}`,
        toolName: 'unknown',
        error: 'Invalid command - missing toolName',
        timestamp: Date.now(),
        duration: 0
      }))
      return
    }

    console.log(`[BrowserServer] Executing tool: ${request.toolName}`, request.parameters)

    try {
      // Map browser tool names to function calling service methods
      const mappedToolName = this.mapBrowserToolName(request.toolName)
      
      // Execute the tool using function calling service
      const result = await functionCallingService.executeFunction(mappedToolName, request.parameters || {})
      
      const response: BrowserToolResponse = {
        success: result.success,
        executionId: request.executionId || `exec_${Date.now()}`,
        toolName: request.toolName,
        result: result.data,
        error: result.error,
        timestamp: Date.now(),
        duration: Date.now() - startTime
      }

      ws.send(JSON.stringify(response))
      
    } catch (error) {
      const response: BrowserToolResponse = {
        success: false,
        executionId: request.executionId || `exec_${Date.now()}`,
        toolName: request.toolName,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: Date.now(),
        duration: Date.now() - startTime
      }

      ws.send(JSON.stringify(response))
    }
  }

  private mapBrowserToolName(browserToolName: string): string {
    // Map Accessly plugin tool names to our function calling service names
    const toolMapping: Record<string, string> = {
      // Navigation
      'goTo': 'browser_navigate',
      'back': 'browser_back', 
      'forward': 'browser_forward',
      'getCurrentURL': 'browser_get_url',
      
      // Interaction
      'clickSelector': 'browser_click_selector',
      'type': 'browser_type',
      'scrollPage': 'browser_scroll_page',
      
      // Visual
      'capturePage': 'browser_capture_page',
      'highlight': 'browser_highlight',
      
      // Utility
      'waitForSelector': 'browser_wait_for_selector'
    }

    return toolMapping[browserToolName] || browserToolName
  }

  // Method to send commands TO the browser and wait for response
  async sendCommandToBrowser(toolName: string, parameters?: Record<string, any>): Promise<{ success: boolean; result?: any; error?: string }> {
    if (this.connectedClients.size === 0) {
      return {
        success: false,
        error: 'No browser clients connected'
      }
    }

    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const command = {
      toolName,
      parameters: parameters || {},
      executionId
    }

    console.log('[BrowserServer] 📤 Sending command to browser:')
    console.log('[BrowserServer] 📤 ExecutionId:', executionId)
    console.log('[BrowserServer] 📤 ToolName:', toolName)
    console.log('[BrowserServer] 📤 Parameters:', parameters)
    console.log('[BrowserServer] 📤 Full command:', command)

    // Send to the first connected client (assuming single browser connection)
    const client = Array.from(this.connectedClients)[0]
    
    if (!client || client.readyState !== WebSocket.OPEN) {
      console.error('[BrowserServer] ❌ Browser client not ready')
      return {
        success: false,
        error: 'Browser client not ready'
      }
    }

    return new Promise((resolve) => {
      let isResolved = false
      
      // Set up response handler
      const responseHandler = (data: Buffer) => {
        try {
          const rawResponse = data.toString()
          console.log('[BrowserServer] 📥 Response handler received message:', rawResponse)
          
          const response = JSON.parse(rawResponse)
          console.log('[BrowserServer] 📥 Parsed response:', response)
          
          // Check if this looks like a response to our command
          const hasSuccessField = 'success' in response
          const hasResultField = 'result' in response
          const hasErrorField = 'error' in response
          const hasExecutionId = 'executionId' in response && response.executionId === executionId
          
          // This is a response if it has success/result/error fields
          const looksLikeResponse = hasSuccessField || hasResultField || hasErrorField
          
          console.log('[BrowserServer] 📥 Response analysis:')
          console.log('[BrowserServer] 📥   - Has success:', hasSuccessField)
          console.log('[BrowserServer] 📥   - Has result:', hasResultField)
          console.log('[BrowserServer] 📥   - Has error:', hasErrorField)
          console.log('[BrowserServer] 📥   - ExecutionId match:', hasExecutionId)
          console.log('[BrowserServer] 📥   - Looks like response:', looksLikeResponse)
          
          if (looksLikeResponse && !isResolved) {
            if (hasExecutionId) {
              console.log('[BrowserServer] ✅ Perfect match - ExecutionId and response format!')
            } else {
              console.log('[BrowserServer] ⚠️  ExecutionId missing but response format matches - accepting anyway')
              console.log('[BrowserServer] ⚠️  (Browser extension likely not echoing executionId)')
            }
            
            isResolved = true
            client.off('message', responseHandler)
            clearTimeout(timeout)
            
            resolve({
              success: response.success || false,
              result: response.result,
              error: response.error
            })
          } else if (!looksLikeResponse) {
            console.log('[BrowserServer] ⏭️  Not a response format, ignoring')
          } else {
            console.log('[BrowserServer] ⏭️  Already resolved, ignoring duplicate response')
          }
        } catch (parseError) {
          console.error('[BrowserServer] ❌ Failed to parse response:', parseError)
          console.error('[BrowserServer] Raw response was:', data.toString())
        }
      }

      // Set up timeout
      const timeout = setTimeout(() => {
        if (!isResolved) {
          console.error('[BrowserServer] ⏰ Tool execution timeout (30s)')
          isResolved = true
          client.off('message', responseHandler)
          resolve({
            success: false,
            error: 'Tool execution timeout (30s)'
          })
        }
      }, 30000)

      // Add response handler
      console.log('[BrowserServer] 🎧 Setting up response handler for executionId:', executionId)
      client.on('message', responseHandler)

      // Send command
      console.log('[BrowserServer] 🚀 Actually sending command to browser now...')
      client.send(JSON.stringify(command))
      console.log('[BrowserServer] 🚀 Command sent! Waiting for response...')
    })
  }

  getConnectedClientsCount(): number {
    return this.connectedClients.size
  }

  isServerRunning(): boolean {
    return this.isRunning
  }

  getServerInfo() {
    return {
      running: this.isRunning,
      wsPort: this.wsPort,
      httpPort: this.httpPort,
      connectedClients: this.connectedClients.size,
      wsUrl: `ws://127.0.0.1:${this.wsPort}`,
      httpUrl: `http://127.0.0.1:${this.httpPort}`
    }
  }
}

export const browserServerService = new BrowserServerService()
export { BrowserServerService }