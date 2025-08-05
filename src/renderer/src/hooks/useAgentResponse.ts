import { useState, useEffect, useRef } from 'react'
import { serviceContainer } from '../core/ServiceContainer'
import { SystemEvents } from '../core/interfaces/IEventBus'
import type { Caption } from '../core/ConversationOrchestrator'

export function useAgentResponse() {
  const [isResponding, setIsResponding] = useState(false)
  const [currentCaption, setCurrentCaption] = useState<Caption | null>(null)
  const [captions, setCaptions] = useState<Caption[]>([])
  const completionTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const eventBus = serviceContainer.getEventBus()

    const handleNewCaption = (caption: Caption) => {
      console.log('[useAgentResponse] New caption:', caption)
      
      // Start responding on first caption
      if (!isResponding) {
        setIsResponding(true)
      }
      
      // Set current caption for display
      setCurrentCaption(caption)
      
      // Add to captions history
      setCaptions(prev => [...prev, caption])
    }

    const handleStreamEnd = () => {
      console.log('[useAgentResponse] Stream ended')
      
      // Clear any existing timeout
      if (completionTimeoutRef.current) {
        clearTimeout(completionTimeoutRef.current)
      }
      
      // Stop responding after caption reading time
      completionTimeoutRef.current = setTimeout(() => {
        console.log('[useAgentResponse] Finishing response')
        setIsResponding(false)
        setCurrentCaption(null)
        completionTimeoutRef.current = null
      }, 2000)
    }

    eventBus.on(SystemEvents.NEW_CAPTION, handleNewCaption)
    eventBus.on(SystemEvents.AGENT_RESPONSE_STREAM_ENDED, handleStreamEnd)

    return () => {
      eventBus.off(SystemEvents.NEW_CAPTION, handleNewCaption)
      eventBus.off(SystemEvents.AGENT_RESPONSE_STREAM_ENDED, handleStreamEnd)
      
      if (completionTimeoutRef.current) {
        clearTimeout(completionTimeoutRef.current)
      }
    }
  }, [isResponding])

  const interrupt = () => {
    console.log('[useAgentResponse] Interrupting response')
    
    if (completionTimeoutRef.current) {
      clearTimeout(completionTimeoutRef.current)
      completionTimeoutRef.current = null
    }
    
    setIsResponding(false)
    setCurrentCaption(null)
  }

  const sendMessage = async (message: string) => {
    console.log('[useAgentResponse] Sending message:', message)
    
    // Clear previous state
    interrupt()
    setCaptions([])
    
    // Send message to agent service
    const agentService = serviceContainer.getAgentService()
    await agentService.sendTextMessage(message)
  }

  return {
    isResponding,
    currentCaption,
    captions,
    sendMessage,
    interrupt
  }
} 