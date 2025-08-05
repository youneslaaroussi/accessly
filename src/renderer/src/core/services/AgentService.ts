import type { IEventBus } from '../interfaces/IEventBus'
import { SystemEvents } from '../interfaces/IEventBus'

export interface Caption {
  content: string
  type: 'speech' | 'tool_call'
  timestamp?: number
}

interface PendingCaption extends Caption {
  timestamp: number
}

enum DisplayState {
  IDLE = 'idle',
  DISPLAYING = 'displaying', 
  QUEUED = 'queued'
}

export class AgentService {
  private eventBus: IEventBus
  private cleanupCallbacks: (() => void)[] = []
  private isFirstChunk: boolean = true
  
  // Display queue system
  private displayQueue: PendingCaption[] = []
  private displayState: DisplayState = DisplayState.IDLE
  private currentDisplayTimer: NodeJS.Timeout | null = null
  private readonly MIN_DISPLAY_DURATION = 2500 // 2.5 seconds minimum per chunk
  private readonly FAST_DISPLAY_DURATION = 1500 // 1.5s for shorter content
  
  // Stream end tracking
  private streamHasEnded: boolean = false

  constructor(eventBus: IEventBus) {
    this.eventBus = eventBus
    this.setupIPC()
  }

  private setupIPC(): void {
    // Set up IPC listeners for streaming responses
    const onStreamChunk = window.api.llm.onStreamChunk((chunk: string) => {
      console.log('[AgentService] Received chunk:', chunk)
      
      // Emit stream started event on first chunk
      if (this.isFirstChunk) {
        console.log('[AgentService] First chunk received, emitting AGENT_RESPONSE_STREAM_STARTED')
        this.eventBus.emit(SystemEvents.AGENT_RESPONSE_STREAM_STARTED)
        this.isFirstChunk = false
      }
      
      // Parse chunk to determine type - detect various tool call indicators
      const isToolCall = chunk.includes('Executing:') || 
                        chunk.includes('Function result:') || 
                        chunk.includes('Function failed:') ||
                        chunk.includes('Function execution error:') ||
                        chunk.includes('🤔 Thinking...') ||
                        chunk.includes('💭 Processing results...') ||
                        (chunk.trim().startsWith('{') && chunk.includes('"name"') && chunk.includes('"parameters"'))
      
      const pendingCaption: PendingCaption = {
        content: chunk,
        type: isToolCall ? 'tool_call' : 'speech',
        timestamp: Date.now()
      }
      
      // Add to display queue instead of emitting immediately
      this.queueCaption(pendingCaption)
    })

    const onStreamEnd = window.api.llm.onStreamEnd(() => {
      console.log('[AgentService] Stream ended, but waiting for display queue to finish')
      this.streamHasEnded = true
      this.isFirstChunk = true // Reset for next response
      
      // Only emit stream ended if queue is already empty
      if (this.displayQueue.length === 0 && this.displayState === DisplayState.IDLE) {
        console.log('[AgentService] Queue already empty, emitting stream ended immediately')
        this.eventBus.emit(SystemEvents.AGENT_RESPONSE_STREAM_ENDED)
      }
      // Otherwise, wait for queue to finish in processNextCaption()
    })

    this.cleanupCallbacks.push(onStreamChunk, onStreamEnd)
  }

  private queueCaption(caption: PendingCaption): void {
    console.log('[AgentService] Queueing caption:', caption.content)
    
    // Add to queue
    this.displayQueue.push(caption)
    
    // Start processing if not already displaying
    if (this.displayState === DisplayState.IDLE) {
      this.processNextCaption()
    } else {
      this.displayState = DisplayState.QUEUED
    }
  }

  private processNextCaption(): void {
    if (this.displayQueue.length === 0) {
      this.displayState = DisplayState.IDLE
      
      // Check if stream ended and queue is now empty - emit stream ended event
      if (this.streamHasEnded) {
        console.log('[AgentService] Queue finished and stream ended, emitting AGENT_RESPONSE_STREAM_ENDED')
        this.streamHasEnded = false // Reset for next response
        this.eventBus.emit(SystemEvents.AGENT_RESPONSE_STREAM_ENDED)
      }
      
      return
    }

    // Get next caption from queue
    const caption = this.displayQueue.shift()!
    this.displayState = DisplayState.DISPLAYING
    
    console.log('[AgentService] Displaying caption:', caption.content)
    
    // Emit the caption
    this.eventBus.emit(SystemEvents.NEW_CAPTION, {
      content: caption.content,
      type: caption.type
    })

    // Calculate display duration based on content length
    const duration = this.calculateDisplayDuration(caption.content)
    
    // Set timer for next caption
    this.currentDisplayTimer = setTimeout(() => {
      this.currentDisplayTimer = null
      this.processNextCaption() // Process next in queue
    }, duration)
  }

  private calculateDisplayDuration(content: string): number {
    const baseTime = this.MIN_DISPLAY_DURATION
    const shortTime = this.FAST_DISPLAY_DURATION
    
    // Use shorter duration for very short content (< 20 chars)
    // Use longer duration for longer content
    if (content.length < 20) {
      return shortTime
    } else if (content.length > 100) {
      return baseTime + 1000 // Extra second for long content
    }
    
    return baseTime
  }

  private clearDisplayQueue(): void {
    this.displayQueue = []
    this.displayState = DisplayState.IDLE
    this.streamHasEnded = false // Reset stream end flag
    
    if (this.currentDisplayTimer) {
      clearTimeout(this.currentDisplayTimer)
      this.currentDisplayTimer = null
    }
  }

  async sendTextMessage(message: string): Promise<void> {
    console.log('[AgentService] Sending message:', message)
    
    // Clear any pending display queue and reset state
    this.clearDisplayQueue()
    this.isFirstChunk = true
    
    try {
      await window.api.llm.sendMessage(message)
    } catch (error) {
      console.error('[AgentService] Error sending message:', error)
      this.clearDisplayQueue() // Clear on error too
      this.isFirstChunk = true
      this.eventBus.emit(SystemEvents.AGENT_RESPONSE_STREAM_ENDED)
      throw error
    }
  }

  dispose(): void {
    this.clearDisplayQueue()
    this.cleanupCallbacks.forEach(cleanup => cleanup())
    this.cleanupCallbacks = []
  }
} 