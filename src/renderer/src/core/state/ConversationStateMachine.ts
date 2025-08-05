import type { IEventBus } from '../interfaces/IEventBus'
import { SystemEvents } from '../interfaces/IEventBus'

export enum ConversationState {
  IDLE = 'idle',
  LISTENING = 'listening',
  HEARING = 'hearing', // Transcribing audio
  PROCESSING = 'processing', // LLM thinking
  RESPONDING = 'responding',
  INTERRUPTED = 'interrupted'
}

export enum ConversationAction {
  START_LISTENING = 'start_listening',
  STOP_LISTENING = 'stop_listening',
  START_HEARING = 'start_hearing',
  START_PROCESSING = 'start_processing',
  START_RESPONDING = 'start_responding',
  COMPLETE_RESPONSE = 'complete_response',
  INTERRUPT = 'interrupt',
  RESET = 'reset'
}

interface StateTransition {
  from: ConversationState[]
  to: ConversationState
}

const VALID_TRANSITIONS: Record<ConversationAction, StateTransition> = {
  [ConversationAction.START_LISTENING]: {
    from: [ConversationState.IDLE],
    to: ConversationState.LISTENING
  },
  [ConversationAction.STOP_LISTENING]: {
    from: [ConversationState.LISTENING],
    to: ConversationState.IDLE
  },
  [ConversationAction.START_HEARING]: {
    from: [ConversationState.LISTENING],
    to: ConversationState.HEARING
  },
  [ConversationAction.START_PROCESSING]: {
    from: [ConversationState.HEARING, ConversationState.IDLE],
    to: ConversationState.PROCESSING
  },
  [ConversationAction.START_RESPONDING]: {
    from: [ConversationState.PROCESSING],
    to: ConversationState.RESPONDING
  },
  [ConversationAction.COMPLETE_RESPONSE]: {
    from: [ConversationState.RESPONDING, ConversationState.INTERRUPTED],
    to: ConversationState.IDLE
  },
  [ConversationAction.INTERRUPT]: {
    from: [ConversationState.RESPONDING],
    to: ConversationState.INTERRUPTED
  },
  [ConversationAction.RESET]: {
    from: [ConversationState.LISTENING, ConversationState.HEARING, ConversationState.PROCESSING, ConversationState.RESPONDING, ConversationState.INTERRUPTED],
    to: ConversationState.IDLE
  }
}

export class ConversationStateMachine {
  private currentState: ConversationState = ConversationState.IDLE
  private eventBus: IEventBus

  constructor(eventBus: IEventBus) {
    this.eventBus = eventBus
  }

  getCurrentState(): ConversationState {
    return this.currentState
  }

  transition(action: ConversationAction): boolean {
    const transition = VALID_TRANSITIONS[action]
    
    if (!transition.from.includes(this.currentState)) {
      console.warn(`[StateMachine] Invalid transition: ${action} from ${this.currentState}`)
      return false
    }

    const previousState = this.currentState
    this.currentState = transition.to

    console.log(`[StateMachine] ${previousState} --${action}--> ${this.currentState}`)

    this.eventBus.emit(SystemEvents.STATE_CHANGED, {
      from: previousState,
      to: this.currentState,
      action
    })

    return true
  }
} 