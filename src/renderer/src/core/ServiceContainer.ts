import type { IEventBus } from './interfaces/IEventBus'
import type { ISpeechInput } from './interfaces/ISpeechInput'
import type { ISpeechOutput } from './interfaces/ISpeechOutput'
import { EventBus } from './services/EventBus'
import { WhisperSpeechInput } from '../services/speech/WhisperSpeechInput'
import { BrowserSpeechOutput } from '../services/speech/BrowserSpeechOutput'
import { SoundManager } from './services/SoundManager'
import { AgentService } from './services/AgentService'

// Service factory functions for easy swapping of implementations
type ServiceFactory<T> = () => T

interface ServiceFactories {
  eventBus: ServiceFactory<IEventBus>
  speechInput: ServiceFactory<ISpeechInput>
  speechOutput: ServiceFactory<ISpeechOutput>
  soundManager: ServiceFactory<SoundManager>
  agentService: ServiceFactory<AgentService>
}

class ServiceContainer {
  private services: Map<string, any> = new Map()
  private factories: ServiceFactories

  constructor() {
    // Default service factories - easily replaceable for different implementations
    this.factories = {
      eventBus: () => new EventBus(),
      speechInput: () => new WhisperSpeechInput(),
      speechOutput: () => new BrowserSpeechOutput(),
      soundManager: () => new SoundManager(),
      agentService: () => new AgentService(this.getEventBus())
    }
  }

  // Core service getters
  getEventBus(): IEventBus {
    return this.getOrCreateService('eventBus', this.factories.eventBus)
  }

  getSpeechInput(): ISpeechInput {
    return this.getOrCreateService('speechInput', this.factories.speechInput)
  }

  getSpeechOutput(): ISpeechOutput {
    return this.getOrCreateService('speechOutput', this.factories.speechOutput)
  }

  getSoundManager(): SoundManager {
    return this.getOrCreateService('soundManager', this.factories.soundManager)
  }

  getAgentService(): AgentService {
    return this.getOrCreateService('agentService', this.factories.agentService)
  }

  // ConversationOrchestrator will be created outside ServiceContainer to avoid circular dependency

  // Generic service management
  private getOrCreateService<T>(name: string, factory: ServiceFactory<T>): T {
    if (!this.services.has(name)) {
      this.services.set(name, factory())
    }
    return this.services.get(name)
  }

  // Service replacement for testing or different implementations
  replaceService<T>(name: string, service: T): void {
    this.services.set(name, service)
  }

  // Cleanup
  dispose(): void {
    this.services.forEach((service) => {
      if (service && typeof service.dispose === 'function') {
        service.dispose()
      }
    })
    this.services.clear()
  }
}

// Singleton instance
export const serviceContainer = new ServiceContainer() 