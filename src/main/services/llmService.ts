import { BrowserWindow } from 'electron'
import { Ollama } from 'ollama'
import { functionCallingService } from './functionCallingService'

let isInitialized = false

// Type for the service
type LLMService = OllamaLLMService

export class OllamaLLMService {
  private ollama: Ollama
  private model = 'gemma3n:e4b'
  private conversationHistory: Array<{ role: string; content: string }> = []
  private abortController: AbortController | null = null
  private isHalted: boolean = false
  private maxBufferSize: number = 50 // Max characters to buffer before force-sending


  constructor() {
    this.ollama = new Ollama({ 
      host: 'http://127.0.0.1:11434' // Default Ollama host
    })
  }



  clearHistory(): void {
    this.conversationHistory = []
    console.log('[LLM] Conversation history cleared')
  }

  halt(): void {
    console.log('[LLM] Halting all operations')
    this.isHalted = true
    
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const models = await this.ollama.list()
      console.log('[LLM] Available models:', models.models?.map(m => m.name) || [])
      
      // Check if our model is available
      const hasModel = models.models?.some(m => m.name === this.model) || false
      if (!hasModel) {
        console.warn(`[LLM] Model ${this.model} not found. You may need to pull it with: ollama pull ${this.model}`)
      }
      
      return true
    } catch (error) {
      console.error('[LLM] Failed to connect to Ollama:', error)
      return false
    }
  }

  getAvailableTools() {
    return functionCallingService.getAvailableTools()
  }

  async sendMessage(window: BrowserWindow, message: string, enableTools: boolean = true): Promise<void> {
    // Reset halt flag for new message
    this.isHalted = false
    
    if (enableTools) {
      return this.sendMessageWithTools(window, message)
    }
    
    // Original simple message handling (no tools)
    console.log('[LLM] Received message (no tools):', message)
    
    // Abort any ongoing stream
    if (this.abortController) {
      this.abortController.abort()
    }
    
    // Create new abort controller for this request
    this.abortController = new AbortController()
    
    // Add user message to conversation history
    this.conversationHistory.push({ role: 'user', content: message })
    
    try {
      // Make the streaming chat request
      const response = await this.ollama.chat({
        model: this.model,
        messages: this.conversationHistory,
        stream: true,
        options: {
          temperature: 0.7,
          top_p: 0.9,
          top_k: 40
        }
      })

      let fullResponse = ''

      // Process the streaming response
      let buffer = ''
      
      for await (const part of response) {
        console.log('[LLM] Part:', part)

        // Check if request was aborted or halted
        if (this.abortController?.signal.aborted || this.isHalted) {
          console.log('[LLM] Request aborted or halted')
          return
        }

        if (part.message?.content) {
          const chunk = part.message.content
          fullResponse += chunk
          buffer += chunk
          
          // Check if buffer exceeds max size, if so send it and clear
          if (buffer.length > this.maxBufferSize) {
            console.log('[LLM] Buffer exceeded max size, force-sending:', buffer)
            window.webContents.send('llm:stream-chunk', buffer)
            buffer = ''
          } else {
            // Only send on newlines - split buffer by newlines
            const lines = buffer.split('\n')
            if (lines.length > 1) {
              // Send all complete lines except the last (incomplete) one
              for (let i = 0; i < lines.length - 1; i++) {
                if (lines[i].trim().length > 0) {
                  console.log('[LLM] Sending line chunk:', lines[i])
                  window.webContents.send('llm:stream-chunk', lines[i])
                }
              }
              // Keep the last incomplete line in buffer
              buffer = lines[lines.length - 1]
            }
          }
        }

        // Check if response is done
        if (part.done) {
          // Send any remaining buffer content
          if (buffer.trim().length > 0) {
            console.log('[LLM] Sending final buffered chunk:', buffer)
            window.webContents.send('llm:stream-chunk', buffer)
          }
          
          // Add assistant response to conversation history
          this.conversationHistory.push({ role: 'assistant', content: fullResponse })
          
          // Keep conversation history manageable (last 20 messages)
          if (this.conversationHistory.length > 20) {
            this.conversationHistory = this.conversationHistory.slice(-20)
          }
          
          // Signal end of stream
          window.webContents.send('llm:stream-end')
          console.log('[LLM] Response completed')
          break
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('[LLM] Request was aborted')
        return
      }
      
      console.error('[LLM] Error during chat:', error)
      
      // Send error message to renderer
      const errorMessage = `Error: ${error.message || 'Failed to get response from Ollama'}`
      window.webContents.send('llm:stream-chunk', errorMessage)
      window.webContents.send('llm:stream-end')
      
      // Remove the user message from history if the request failed
      if (this.conversationHistory.length > 0 && 
          this.conversationHistory[this.conversationHistory.length - 1].role === 'user') {
        this.conversationHistory.pop()
      }
    } finally {
      this.abortController = null
    }
  }

  async sendMessageWithTools(window: BrowserWindow, message: string): Promise<void> {
    console.log('[LLM] Received message with tools:', message)
    
    // Reset halt flag for new message
    this.isHalted = false
    
    // Abort any ongoing stream
    if (this.abortController) {
      this.abortController.abort()
    }
    
    // Create new abort controller for this request
    this.abortController = new AbortController()
    
    // Add user message to conversation history
    this.conversationHistory.push({ role: 'user', content: message })
    
    // Start iterative tool calling process
    await this.processWithToolCalls(window)
  }

  private async processWithToolCalls(window: BrowserWindow): Promise<void> {
    let maxIterations = 10 // Prevent infinite loops
    let iteration = 0
    
    while (iteration < maxIterations) {
      iteration++
      console.log(`[LLM] Tool calling iteration ${iteration}`)
      
      // Send thinking indicator to UI for iterations after the first
      if (iteration > 1) {
        // window.webContents.send('llm:stream-chunk', `🤔 Thinking... (processing step ${iteration})`)
      }
      

      
      // Get available tools and create enhanced system prompt
      const tools = functionCallingService.getAvailableTools()
      const toolsJson = JSON.stringify(tools, null, 2)

      const systemMessage = `You are an AI assistant with access to computer automation functions. You excel at automating common tasks using the available tools.

TASK-SPECIFIC GUIDANCE:

EMAIL COMPOSITION (Gmail): When user asks to send an email, follow these EXACT steps in order:
1. Use browser_navigate to go to "https://gmail.com" (this is the "open page" tool)
2. Use find_and_click_text to click on the text "Compose"
3. Type the recipient email address using type_text
4. Use press_tab to move to the subject field
5. Type the email subject using type_text  
6. Use press_tab to move to the email body field
7. Type the email body content using type_text
8. Use find_and_click_text to find and click the "Send" button to submit the email
9. Use find_and_click_text to find and click "View message" to confirm the email was sent

IMPORTANT: Follow this sequence exactly - use press_tab between fields rather than clicking on each field individually. This ensures proper navigation flow in Gmail's interface.

MEMORY RECALL: When user asks to recall or remember something from previous screens/actions:
- Use search_memory tool with relevant keywords to find stored screenshots and OCR text
- The system automatically captures screen snapshots, so past information may be retrievable

SCREEN READING: When you need to see what's currently on screen:
- Use read_screen_text to get all visible text via OCR
- Use this to understand current state before taking actions

CLICKING AND NAVIGATION:
- Prefer find_and_click_text when you know the text to click on
- Use click with coordinates only when text-based clicking fails
- Use browser_navigate for direct URL navigation

GENERAL PRINCIPLES: Always explain each step, ask for confirmation on destructive actions, suggest alternatives if tools fail, adapt based on current screen state using OCR.

FUNCTION CALLING RULES:
If you decide to invoke any function(s), you MUST respond with ONLY the JSON object in this exact format:
{"name": "function_name", "parameters": {"param1": "value1", "param2": "value2"}}

Do NOT wrap the JSON in code blocks, markdown, or any other formatting.
Do NOT include any other text in the response if you call a function.
The response should be pure JSON only.

Available functions:
${toolsJson}

If you don't need to use any functions, respond normally with helpful text.`

      // Create messages with system prompt
      const messages = [
        { role: 'system', content: systemMessage },
        ...this.conversationHistory
      ]

      console.log('[LLM] Messages:', JSON.stringify(messages, null, 2))
      
      try {
        const response = await this.ollama.chat({
          model: this.model,
          messages,
          stream: true,
          options: {
            temperature: 0.7,
            top_p: 0.9,
            top_k: 40
          }
        })
        
        console.log('[LLM] Sending message with tools:', messages)

        let fullResponse = ''
        let buffer = ''
        
        // Process streaming response
        for await (const part of response) {
          console.log('[LLM] Part:', part)

          if (this.abortController?.signal.aborted || this.isHalted) {
            console.log('[LLM] Request was aborted or halted')
            return
          }

          if (part.message?.content) {
            const chunk = part.message.content
            fullResponse += chunk
            buffer += chunk
            
            // Check if buffer exceeds max size, if so send it and clear
            if (buffer.length > this.maxBufferSize) {
              console.log('[LLM] Buffer exceeded max size in tools mode, force-sending:', buffer)
              window.webContents.send('llm:stream-chunk', buffer)
              buffer = ''
            } else {
              // Only send on newlines
              const lines = buffer.split('\n')
              if (lines.length > 1) {
                for (let i = 0; i < lines.length - 1; i++) {
                  if (lines[i].trim().length > 0) {
                    window.webContents.send('llm:stream-chunk', lines[i])
                  }
                }
                buffer = lines[lines.length - 1]
              }
            }
          }
        }
        
        // Send final buffer
        if (buffer.trim().length > 0) {
          window.webContents.send('llm:stream-chunk', buffer)
        }

        // Add assistant response to history
        this.conversationHistory.push({ role: 'assistant', content: fullResponse })

        // Check if response contains function calls
        const functionCalls = this.extractFunctionCalls(fullResponse)
        
        if (functionCalls.length === 0) {
          // No function calls found, we're done
          console.log('[LLM] No function calls found, ending tool calling process')
          break
        }

        // Execute function calls in sequence
        for (const funcCall of functionCalls) {
          // Check for halt before each function call
          if (this.isHalted) {
            console.log('[LLM] Tool calling halted by user')
            window.webContents.send('llm:stream-chunk', '🛑 Function execution halted by user')
            return
          }
          await this.executeFunctionCall(window, funcCall)
        }

        // Send thinking indicator after tools execution (if not the last iteration)
        if (iteration < maxIterations) {
          window.webContents.send('llm:stream-chunk', '💭 Processing results...')
        }

      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.log('[LLM] Request was aborted')
          return
        }
        
        console.error('[LLM] Error during tool calling:', error)
        window.webContents.send('llm:stream-chunk', 'Sorry, I encountered an error processing your request.')
        break
      }
    }

    // Signal end of stream
    window.webContents.send('llm:stream-end')
    console.log('[LLM] Tool calling process completed')
  }



  private extractFunctionCalls(response: string): Array<{name: string, parameters: Record<string, any>}> {
    const functionCalls: Array<{name: string, parameters: Record<string, any>}> = []
    
    try {
      // First, try to extract JSON from code blocks
      const codeBlockRegex = /```(?:json)?\s*\n?\s*(\{[\s\S]*?\})\s*\n?\s*```/g
      const codeBlockMatches = [...response.matchAll(codeBlockRegex)]
      
      for (const match of codeBlockMatches) {
        try {
          const parsed = JSON.parse(match[1])
          if (parsed.name && parsed.parameters) {
            functionCalls.push(parsed)
            console.log('[LLM] Found function call in code block:', parsed)
          }
        } catch (parseError) {
          console.warn('[LLM] Failed to parse function call from code block:', match[1])
        }
      }
      
      // If we found function calls in code blocks, return them
      if (functionCalls.length > 0) {
        return functionCalls
      }
      
      // Try to parse the entire response as JSON (fallback)
      const trimmed = response.trim()
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        const parsed = JSON.parse(trimmed)
        if (parsed.name && parsed.parameters) {
          functionCalls.push(parsed)
          console.log('[LLM] Found function call as raw JSON:', parsed)
        }
      }
    } catch (error) {
      // If that fails, try to find JSON objects in the text using regex
      const jsonRegex = /\{[^{}]*"name"\s*:\s*"[^"]+"[^{}]*"parameters"\s*:\s*\{[^{}]*\}[^{}]*\}/g
      const matches = response.match(jsonRegex)
      
      if (matches) {
        for (const match of matches) {
          try {
            const parsed = JSON.parse(match)
            if (parsed.name && parsed.parameters) {
              functionCalls.push(parsed)
              console.log('[LLM] Found function call via regex:', parsed)
            }
          } catch (parseError) {
            console.warn('[LLM] Failed to parse function call:', match)
          }
        }
      }
    }
    
    return functionCalls
  }

  private async executeFunctionCall(window: BrowserWindow, funcCall: {name: string, parameters: Record<string, any>}): Promise<void> {
    console.log('[LLM] Executing function call:', funcCall.name, funcCall.parameters)
    
    // Check for halt before execution
    if (this.isHalted) {
      console.log('[LLM] Function execution halted before starting')
      return
    }
    
    // Send tool call indicator to UI
    // window.webContents.send('llm:stream-chunk', `Executing: ${funcCall.name}`)
    
    try {
      const result = await functionCallingService.executeFunction(funcCall.name, funcCall.parameters)
      
      // Add function result to conversation history for next iteration
      this.conversationHistory.push({ 
        role: 'user', 
        content: `Function ${funcCall.name} executed. Result: ${JSON.stringify(result)}` 
      })
      
    } catch (error) {
      const errorMessage = `Function execution error: ${error instanceof Error ? error.message : 'Unknown error'}`
      window.webContents.send('llm:stream-chunk', errorMessage)
      
      this.conversationHistory.push({ 
        role: 'user', 
        content: `Function ${funcCall.name} failed with error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      })
    }
  }
}

// Global service instance
let llmServiceInstance: LLMService | null = null

export async function setupLLM(sendUpdate: (message: string) => void): Promise<void> {
  if (isInitialized) {
    console.log('[LLM] Already initialized, skipping setup')
    return
  }

  console.log('[LLM] Starting setup for Ollama...')
  
  try {
    sendUpdate('Initializing Ollama LLM service...')
    
    llmServiceInstance = new OllamaLLMService()
    
    sendUpdate('Testing connection to Ollama...')
    const connected = await llmServiceInstance.testConnection()
    
    if (!connected) {
      throw new Error('Failed to connect to Ollama. Make sure Ollama is running on http://127.0.0.1:11434')
    }
    
    sendUpdate('Checking if gemma3n:e4b model is available...')
    
    // Try to list models to see if gemma3n:e4b is available
    const models = await llmServiceInstance['ollama'].list()
    const hasModel = models.models?.some(m => m.name === 'gemma3n:e4b') || false
    
    if (!hasModel) {
      sendUpdate('Model gemma3n:e4b not found. You may need to run: ollama pull gemma3n:e4b')
      console.warn('[LLM] Model gemma3n:e4b not found. Service will still initialize but may fail on first request.')
    }
    
    sendUpdate('Ollama LLM service initialized successfully.')
    
    console.log('[LLM] Ollama setup completed successfully')
    isInitialized = true
  } catch (error: any) {
    console.error('[LLM] Error setting up Ollama service:', error)
    sendUpdate(`LLM setup failed: ${error.message}`)
    throw error
  }
}

export function getLLMService(): LLMService {
  if (!llmServiceInstance) {
    throw new Error('LLM service not initialized. Call setupLLM first.')
  }
  return llmServiceInstance
} 