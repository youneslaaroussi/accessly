import { useState, useEffect, useMemo } from 'react'
import { getConversationOrchestrator } from '../core/ConversationOrchestratorFactory'
import { serviceContainer } from '../core/ServiceContainer'
import type { ConversationState } from '../core/state/ConversationStateMachine'
import { SystemEvents } from '../core/interfaces/IEventBus'

export function useConversationOrchestrator() {
  const orchestrator = useMemo(() => getConversationOrchestrator(), [])
  const [conversationState, setConversationState] = useState<ConversationState>(orchestrator.getCurrentState())

  useEffect(() => {
    const handleStateChange = (stateChange: { to: ConversationState }) => {
      setConversationState(stateChange.to)
    }

    const eventBus = serviceContainer.getEventBus()
    eventBus.on(SystemEvents.STATE_CHANGED, handleStateChange)

    return () => {
      eventBus.off(SystemEvents.STATE_CHANGED, handleStateChange)
    }
  }, [])

  return {
    conversationState,
    startConversation: () => orchestrator.startConversation(),
    stopConversation: () => orchestrator.stopConversation(),
    interrupt: () => orchestrator.interrupt(),
    resetConversation: () => orchestrator.resetConversation(),
    sendTextMessage: (message: string) => orchestrator.sendTextMessage(message),
  }
} 