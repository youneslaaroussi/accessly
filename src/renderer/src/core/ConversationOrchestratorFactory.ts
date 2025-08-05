import { ConversationOrchestrator } from './ConversationOrchestrator'
import { serviceContainer } from './ServiceContainer'

let orchestratorInstance: ConversationOrchestrator | null = null

export function getConversationOrchestrator(): ConversationOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new ConversationOrchestrator(
      serviceContainer.getEventBus(),
      serviceContainer.getSpeechInput(),
      serviceContainer.getSpeechOutput(),
      serviceContainer.getSoundManager(),
      serviceContainer.getAgentService()
    )
  }
  return orchestratorInstance
}

export function resetConversationOrchestrator(): void {
  if (orchestratorInstance) {
    orchestratorInstance.dispose()
    orchestratorInstance = null
  }
} 