import { computerService } from './computerService'
import { ocrService } from './ocrService'
import { vectorDbService } from './vectorDbService'
import { snapshotService } from './snapshotService'
import { browserServerService } from './browserServerService'

export interface FunctionCallResult {
  success: boolean
  data?: any
  error?: string
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: {
    type: string
    properties: Record<string, any>
    required: string[]
  }
}

class FunctionCallingService {
  private tools: ToolDefinition[] = [
    // System and utility functions
    {
      name: 'get_current_time',
      description: 'Get the current date and time',
      parameters: {
        type: 'object',
        properties: {
          format: {
            type: 'string',
            description: 'Time format: "12h", "24h", or "iso" (default: "12h")'
          }
        },
        required: []
      }
    },
    // Browser automation tools (via Accessly Chrome Plugin)
    {
      name: 'browser_navigate',
      description: 'Navigate browser to a specific URL',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'URL to navigate to (e.g., "https://google.com")'
          }
        },
        required: ['url']
      }
    },
    {
      name: 'browser_click_selector',
      description: 'Click an element in the browser using CSS selector',
      parameters: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector of element to click (e.g., ".button", "#submit")'
          }
        },
        required: ['selector']
      }
    },
    {
      name: 'browser_type',
      description: 'Type text into an input field in the browser',
      parameters: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector of input field'
          },
          text: {
            type: 'string',
            description: 'Text to type into the field'
          }
        },
        required: ['selector', 'text']
      }
    },
    // {
    //   name: 'browser_scroll_page',
    //   description: 'Scroll the browser page in a direction',
    //   parameters: {
    //     type: 'object',
    //     properties: {
    //       direction: {
    //         type: 'string',
    //         enum: ['up', 'down'],
    //         description: 'Direction to scroll'
    //       },
    //       speed: {
    //         type: 'string',
    //         enum: ['slow', 'medium', 'fast'],
    //         description: 'Scroll speed (default: "medium")',
    //         default: 'medium'
    //       }
    //     },
    //     required: ['direction']
    //   }
    // },
    // {
    //   name: 'browser_capture_page',
    //   description: 'Take a screenshot of the current browser page',
    //   parameters: {
    //     type: 'object',
    //     properties: {},
    //     required: []
    //   }
    // },
    // {
    //   name: 'browser_get_url',
    //   description: 'Get the current URL of the browser tab',
    //   parameters: {
    //     type: 'object',
    //     properties: {},
    //     required: []
    //   }
    // },
    // {
    //   name: 'browser_back',
    //   description: 'Go back in browser history',
    //   parameters: {
    //     type: 'object',
    //     properties: {},
    //     required: []
    //   }
    // },
    // {
    //   name: 'browser_forward',
    //   description: 'Go forward in browser history',
    //   parameters: {
    //     type: 'object',
    //     properties: {},
    //     required: []
    //   }
    // },
    {
      name: 'browser_highlight',
      description: 'Visually highlight an element in the browser for debugging',
      parameters: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector of element to highlight'
          }
        },
        required: ['selector']
      }
    },
    // {
    //   name: 'browser_wait_for_selector',
    //   description: 'Wait for an element to appear in the browser',
    //   parameters: {
    //     type: 'object',
    //     properties: {
    //       selector: {
    //         type: 'string',
    //         description: 'CSS selector to wait for'
    //       },
    //       timeout: {
    //         type: 'number',
    //         description: 'Timeout in milliseconds (default: 10000)',
    //         default: 10000
    //       }
    //     },
    //     required: ['selector']
    //   }
    // },
    // // Memory and snapshot tools
    {
      name: 'search_memory',
      description: 'Search through stored screenshots and OCR text using semantic similarity',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Text to search for in stored memories/screenshots'
          },
          count: {
            type: 'number',
            description: 'Number of results to return (default: 5)',
            default: 5
          }
        },
        required: ['query']
      }
    },
//     {
//       name: 'get_recent_memories',
//       description: 'Get a list of recently captured snapshots and their OCR text',
//       parameters: {
//         type: 'object',
//         properties: {
//           count: {
//             type: 'number',
//             description: 'Number of recent memories to retrieve (default: 10)',
//             default: 10
//           }
//         },
//         required: []
//       }
// },
//     // Browser server management tools
//     {
//       name: 'get_browser_server_status',
//       description: 'Check the status of the browser automation WebSocket server',
//       parameters: {
//         type: 'object',
//         properties: {},
//         required: []
//       }
//     },
    {
      name: 'find_text_on_screen',
      description: 'Find text on the screen and return its coordinates. Useful for locating UI elements by their text content.',
      parameters: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: 'The text to search for on the screen (case-insensitive)'
          }
        },
        required: ['text']
      }
    },
    {
      name: 'click',
      description: 'Click at specific coordinates or at the current mouse position.',
      parameters: {
        type: 'object',
        properties: {
          x: {
            type: 'number',
            description: 'X coordinate to click at (optional, uses current position if not provided)'
          },
          y: {
            type: 'number',
            description: 'Y coordinate to click at (optional, uses current position if not provided)'
          }
        },
        required: []
      }
    },
    // {
    //   name: 'move_mouse',
    //   description: 'Move the mouse cursor to specific coordinates.',
    //   parameters: {
    //     type: 'object',
    //     properties: {
    //       x: {
    //         type: 'number',
    //         description: 'X coordinate to move to'
    //       },
    //       y: {
    //         type: 'number',
    //         description: 'Y coordinate to move to'
    //       }
    //     },
    //     required: ['x', 'y']
    //   }
    // },
    {
      name: 'type_text',
      description: 'Type text at the current cursor position.',
      parameters: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: 'The text to type'
          }
        },
        required: ['text']
      }
    },
    {
      name: 'press_key',
      description: 'Press a specific key (like Enter, Tab, Escape, etc.).',
      parameters: {
        type: 'object',
        properties: {
          key: {
            type: 'string',
            description: 'The key to press (e.g., "enter", "tab", "escape", "space", "backspace", "delete")'
          }
        },
        required: ['key']
      }
    },
    {
      name: 'press_tab',
      description: 'Press the Tab key to navigate between form fields or UI elements',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    },
    {
      name: 'scroll',
      description: 'Scroll in a specific direction.',
      parameters: {
        type: 'object',
        properties: {
          direction: {
            type: 'string',
            enum: ['up', 'down', 'left', 'right'],
            description: 'Direction to scroll'
          },
          amount: {
            type: 'number',
            description: 'Amount to scroll (default: 3)',
            default: 3
          }
        },
        required: ['direction']
      }
    },
    // {
    //   name: 'get_screen_size',
    //   description: 'Get the dimensions of the primary screen.',
    //   parameters: {
    //     type: 'object',
    //     properties: {},
    //     required: []
    //   }
    // },
    // {
    //   name: 'take_screenshot',
    //   description: 'Take a screenshot of the current screen and return it as base64.',
    //   parameters: {
    //     type: 'object',
    //     properties: {},
    //     required: []
    //   }
    // },
    {
      name: 'read_screen_text',
      description: 'Use OCR to read all text visible on the screen.',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    },
    {
      name: 'find_and_click_text',
      description: 'Find text on screen and click on it in one operation.',
      parameters: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: 'The text to find and click on'
          }
        },
        required: ['text']
      }
    }
  ]

  public getAvailableTools(): ToolDefinition[] {
    return this.tools
  }

  public async executeFunction(functionName: string, parameters: Record<string, any>): Promise<FunctionCallResult> {
    try {
      switch (functionName) {
        // System utility functions
        case 'get_current_time':
          return await this.getCurrentTime(parameters.format)

        // Browser automation functions
        case 'browser_navigate':
          return await this.browserExecute('goTo', { url: parameters.url })

        case 'browser_click_selector':
          return await this.browserExecute('clickSelector', { selector: parameters.selector })

        case 'browser_scroll_page':
          return await this.browserExecute('scrollPage', { 
            direction: parameters.direction, 
            speed: parameters.speed || 'medium' 
          })

        case 'browser_get_url':
          return await this.browserExecute('getCurrentURL', {})

        case 'browser_back':
          return await this.browserExecute('back', {})

        case 'browser_forward':
          return await this.browserExecute('forward', {})

        case 'browser_highlight':
          return await this.browserExecute('highlight', { selector: parameters.selector })

        // Memory and snapshot functions
        case 'search_memory':
          return await this.searchMemory(parameters.query, parameters.count || 5)

        case 'start_snapshot_collection':
          return await this.startSnapshotCollection(parameters.min_interval, parameters.max_interval)

        case 'stop_snapshot_collection':
          return await this.stopSnapshotCollection()

        case 'take_manual_snapshot':
          return await this.takeManualSnapshot()

        case 'get_recent_memories':
          return await this.getRecentMemories(parameters.count || 10)

        // Browser server management functions
        case 'get_browser_server_status':
          return await this.getBrowserServerStatus()

        case 'start_browser_server':
          return await this.startBrowserServer()

        case 'stop_browser_server':
          return await this.stopBrowserServer()

        // Computer control functions
        case 'find_text_on_screen':
          return await this.findTextOnScreen(parameters.text)

        case 'click':
          return await this.click(parameters.x, parameters.y)

        case 'move_mouse':
          return await this.moveMouse(parameters.x, parameters.y)

        case 'type_text':
          return await this.typeText(parameters.text)

        case 'press_key':
          return await this.pressKey(parameters.key)

        case 'press_tab':
          return await this.pressTab()

        case 'scroll':
          return await this.scroll(parameters.direction, parameters.amount)

        case 'get_screen_size':
          return await this.getScreenSize()

        case 'take_screenshot':
          return await this.takeScreenshot()

        case 'read_screen_text':
          return await this.readScreenText()

        case 'find_and_click_text':
          return await this.findAndClickText(parameters.text)

        default:
          return {
            success: false,
            error: `Unknown function: ${functionName}`
          }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  // System utility function implementations
  private async getCurrentTime(format: string = '12h'): Promise<FunctionCallResult> {
    // Add slight delay to show function execution
    await this.simulateDelay(200, 500)
    
    const now = new Date()
    let timeString: string
    
    switch (format) {
      case '24h':
        timeString = now.toLocaleTimeString('en-US', { hour12: false })
        break
      case 'iso':
        timeString = now.toISOString()
        break
      default: // '12h'
        timeString = now.toLocaleTimeString('en-US', { hour12: true })
    }
    
    return {
      success: true,
      data: {
        time: timeString,
        date: now.toLocaleDateString('en-US'),
        timestamp: now.getTime(),
        message: `Current time (${format}): ${timeString}`
      }
    }
  }

  // Memory and snapshot function implementations
  private async searchMemory(query: string, count: number = 5): Promise<FunctionCallResult> {
    try {
      // Wait for vector DB to be ready
      await vectorDbService.isReady()
      
      const results = await vectorDbService.query(query, count)
      
      if (results.length === 0) {
        return {
          success: true,
          data: {
            results: [],
            count: 0,
            message: `No memories found matching "${query}"`
          }
        }
      }

      // Format results for display
      const formattedResults = results.map((result: any, index: number) => {
        return {
          rank: index + 1,
          snapshotId: result.item?.metadata?.snapshotId || 'unknown',
          text: result.item?.metadata?.text || 'No text available',
          similarity: result.score || 0
        }
      })

      return {
        success: true,
        data: {
          results: formattedResults,
          count: results.length,
          message: `Found ${results.length} memory results for "${query}"`
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search memory'
      }
    }
  }

  private async startSnapshotCollection(minInterval?: number, maxInterval?: number): Promise<FunctionCallResult> {
    try {
      const min = minInterval || 30000  // 30 seconds default
      const max = maxInterval || 120000 // 2 minutes default
      
      snapshotService.start(min, max)
      
      return {
        success: true,
        data: {
          message: `Started automatic snapshot collection (${min/1000}s - ${max/1000}s intervals)`,
          minInterval: min,
          maxInterval: max
        }
      }
    } catch (error) {
        return {
          success: false,
        error: error instanceof Error ? error.message : 'Failed to start snapshot collection'
      }
        }
      }
      
  private async stopSnapshotCollection(): Promise<FunctionCallResult> {
    try {
      snapshotService.stop()
      
      return {
        success: true,
        data: {
          message: 'Stopped automatic snapshot collection'
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to stop snapshot collection'
      }
    }
  }

  private async takeManualSnapshot(): Promise<FunctionCallResult> {
    try {
      // Use the same screenshot functionality as the snapshotService
      const screenshot = await computerService.takeScreenshot()
      const timestamp = new Date().toISOString()
      const snapshotId = `manual_snapshot_${timestamp}`
      
      // OCR the image and add to vector DB
      const text = await ocrService.recognize(screenshot)
      
      if (text && text.trim().length > 0) {
        await vectorDbService.addItem(text, snapshotId)
    
    return {
      success: true,
      data: {
            snapshotId,
            text: text.trim(),
            timestamp,
            message: `Manual snapshot taken and added to memory. Extracted ${text.trim().length} characters of text.`
          }
        }
      } else {
        return {
          success: true,
          data: {
            snapshotId,
            text: '',
            timestamp,
            message: 'Manual snapshot taken but no text was found to add to memory.'
          }
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to take manual snapshot'
      }
    }
  }

  private async getRecentMemories(count: number = 10): Promise<FunctionCallResult> {
    try {
      // Wait for vector DB to be ready
      await vectorDbService.isReady()
      
      // Use a broad search to get recent memories
      // Search for common words that are likely to appear in any text
      const commonQueries = ['the', 'and', 'to', 'of', 'a', 'in', 'for', 'is', 'on', 'that', 'by', 'this', 'with', 'i', 'you', 'it', 'not', 'or', 'be', 'are']
      let allResults: any[] = []
      
      // Try multiple broad queries to get a diverse set of results
      for (const query of commonQueries.slice(0, 3)) {
        try {
          const results = await vectorDbService.query(query, Math.ceil(count / 2))
          allResults.push(...results)
        } catch (error) {
          // Continue with next query if one fails
          continue
        }
      }
      
      // Remove duplicates based on snapshotId
      const uniqueResults = allResults.reduce((unique: any[], item: any) => {
        const snapshotId = item.item?.metadata?.snapshotId
        if (snapshotId && !unique.find(u => u.item?.metadata?.snapshotId === snapshotId)) {
          unique.push(item)
        }
        return unique
      }, [])
      
      // Sort by snapshotId (which contains timestamp) to get most recent
      const sortedResults = uniqueResults
        .sort((a, b) => {
          const aId = a.item?.metadata?.snapshotId || ''
          const bId = b.item?.metadata?.snapshotId || ''
          return bId.localeCompare(aId) // Descending order for most recent first
        })
        .slice(0, count)
      
      if (sortedResults.length === 0) {
    return {
      success: true,
      data: {
            memories: [],
            count: 0,
            message: 'No memories found in the database. Try taking some snapshots first.'
          }
        }
      }

      // Format results for display
      const formattedMemories = sortedResults.map((result: any, index: number) => {
        const snapshotId = result.item?.metadata?.snapshotId || 'unknown'
        const text = result.item?.metadata?.text || 'No text available'
        const isManual = snapshotId.includes('manual_snapshot')
        
        return {
          rank: index + 1,
          snapshotId,
          type: isManual ? 'manual' : 'automatic',
          textPreview: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
          textLength: text.length,
          timestamp: snapshotId.includes('_') ? snapshotId.split('_').slice(-1)[0] : 'unknown'
        }
      })

      return {
        success: true,
        data: {
          memories: formattedMemories,
          count: formattedMemories.length,
          message: `Retrieved ${formattedMemories.length} recent memories from the database`
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retrieve recent memories'
      }
    }
  }

  private async simulateDelay(minMs: number, maxMs: number): Promise<void> {
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs
    return new Promise(resolve => setTimeout(resolve, delay))
  }

  private async findTextOnScreen(text: string): Promise<FunctionCallResult> {
    const result = await computerService.findTextOnScreen(text)
    
    if (result) {
      return {
        success: true,
        data: {
          found: true,
          location: result,
          message: `Found "${text}" at coordinates (${result.x}, ${result.y})`
        }
      }
    } else {
      return {
        success: true,
        data: {
          found: false,
          message: `Text "${text}" not found on screen`
        }
      }
    }
  }

  private async click(x?: number, y?: number): Promise<FunctionCallResult> {
    await computerService.click(x, y)
    
    const message = x !== undefined && y !== undefined 
      ? `Clicked at coordinates (${x}, ${y})`
      : 'Clicked at current mouse position'
    
    return {
      success: true,
      data: { message }
    }
  }

  private async moveMouse(x: number, y: number): Promise<FunctionCallResult> {
    await computerService.moveMouse(x, y)
    
    return {
      success: true,
      data: { message: `Moved mouse to (${x}, ${y})` }
    }
  }

  private async typeText(text: string): Promise<FunctionCallResult> {
    await computerService.type(text)
    
    return {
      success: true,
      data: { message: `Typed: "${text}"` }
    }
  }

  private async pressKey(key: string): Promise<FunctionCallResult> {
    await computerService.pressKey(key)
    
    return {
      success: true,
      data: { message: `Pressed key: ${key}` }
    }
  }

  private async pressTab(): Promise<FunctionCallResult> {
    await computerService.pressKey('tab')
    
    return {
      success: true,
      data: { message: 'Pressed Tab key' }
    }
  }

  private async scroll(direction: string, amount: number = 3): Promise<FunctionCallResult> {
    await computerService.scroll(direction as 'up' | 'down' | 'left' | 'right', amount)
    
    return {
      success: true,
      data: { message: `Scrolled ${direction} by ${amount}` }
    }
  }

  private async getScreenSize(): Promise<FunctionCallResult> {
    const size = await computerService.getScreenSize()
    
    return {
      success: true,
      data: {
        width: size.width,
        height: size.height,
        message: `Screen size: ${size.width}x${size.height}`
      }
    }
  }

  private async takeScreenshot(): Promise<FunctionCallResult> {
    const screenshot = await computerService.takeScreenshot()
    const base64 = screenshot.toString('base64')
    
    return {
      success: true,
      data: {
        screenshot: base64,
        format: 'png',
        message: 'Screenshot taken successfully'
      }
    }
  }

  private async readScreenText(): Promise<FunctionCallResult> {
    const screenshot = await computerService.takeScreenshot()
    const text = await ocrService.recognize(screenshot)
    
    return {
      success: true,
      data: {
        text: text.trim(),
        message: 'Screen text extracted successfully'
      }
    }
  }

  private async findAndClickText(text: string): Promise<FunctionCallResult> {
    const location = await computerService.findTextOnScreen(text)
    
    if (location) {
      await computerService.click(location.x, location.y)
      return {
        success: true,
        data: {
          found: true,
          clicked: true,
          location,
          message: `Found and clicked "${text}" at coordinates (${location.x}, ${location.y})`
        }
      }
    } else {
      return {
        success: true,
        data: {
          found: false,
          clicked: false,
          message: `Text "${text}" not found on screen`
        }
      }
    }
  }

  // Browser server management function implementations
  private async getBrowserServerStatus(): Promise<FunctionCallResult> {
    try {
      const serverInfo = browserServerService.getServerInfo()
      
      return {
        success: true,
        data: {
          ...serverInfo,
          message: serverInfo.running 
            ? `Browser automation server is running on ${serverInfo.wsUrl} with ${serverInfo.connectedClients} connected client(s)`
            : 'Browser automation server is not running'
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get browser server status'
      }
    }
  }

  private async startBrowserServer(): Promise<FunctionCallResult> {
    try {
      if (browserServerService.isServerRunning()) {
        const serverInfo = browserServerService.getServerInfo()
        return {
          success: true,
          data: {
            ...serverInfo,
            message: 'Browser automation server is already running'
          }
        }
      }

      await browserServerService.start()
      const serverInfo = browserServerService.getServerInfo()
      
      return {
        success: true,
        data: {
          ...serverInfo,
          message: `Browser automation server started successfully on ${serverInfo.httpUrl}`
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start browser server'
      }
    }
  }

  private async stopBrowserServer(): Promise<FunctionCallResult> {
    try {
      if (!browserServerService.isServerRunning()) {
        return {
          success: true,
          data: {
            running: false,
            message: 'Browser automation server was not running'
          }
        }
      }

      await browserServerService.stop()
      
      return {
        success: true,
        data: {
          running: false,
          message: 'Browser automation server stopped successfully'
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to stop browser server'
      }
    }
  }

  // Browser automation functions (work with browserServerService)
  private async browserExecute(toolName: string, parameters: Record<string, any>): Promise<FunctionCallResult> {
    try {
      const serverInfo = browserServerService.getServerInfo()
      
      if (!serverInfo.running) {
        return {
          success: false,
          error: 'Browser automation server is not running. The server should start automatically on app launch.'
        }
      }

      if (serverInfo.connectedClients === 0) {
        return {
          success: false,
          error: 'No Accessly Chrome Plugin connected. Please make sure the plugin is installed and connects to ws://127.0.0.1:8080'
        }
      }

      // Send command to the browser extension and wait for response
      console.log(`[Browser] Executing tool "${toolName}" with parameters:`, parameters)
      
      const result = await browserServerService.sendCommandToBrowser(toolName, parameters)
      
      if (result.success) {
        return {
          success: true,
          data: {
            result: result.result,
            message: `Browser tool "${toolName}" executed successfully`
          }
        }
      } else {
        return {
          success: false,
          error: result.error || 'Browser tool execution failed'
        }
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Browser automation error'
      }
    }
  }

  // Helper method to format tools for OpenAI function calling format
  public getOpenAITools(): Array<{ type: string; function: ToolDefinition }> {
    return this.tools.map(tool => ({
      type: 'function',
      function: tool
    }))
  }

  // Helper method to format tools for Anthropic function calling format
  public getAnthropicTools(): Array<{ name: string; description: string; input_schema: any }> {
    return this.tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters
    }))
  }
}

export const functionCallingService = new FunctionCallingService()