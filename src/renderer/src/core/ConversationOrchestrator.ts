import { ConversationStateMachine, ConversationState, ConversationAction } from './state/ConversationStateMachine'
import type { IEventBus } from './interfaces/IEventBus'
import type { ISpeechInput } from './interfaces/ISpeechInput'
import type { ISpeechOutput } from './interfaces/ISpeechOutput'
import { SystemEvents } from './interfaces/IEventBus'
import { SoundManager } from './services/SoundManager'
import { AgentService, type Caption } from './services/AgentService'

export { type Caption } from './services/AgentService'

export class ConversationOrchestrator {
  private stateMachine: ConversationStateMachine
  private speechInput: ISpeechInput
  private speechOutput: ISpeechOutput
  private eventBus: IEventBus
  private soundManager: SoundManager
  private agentService: AgentService
  
  private interruptionThreshold = 0.3 // Volume threshold for interruption detection
  private hasFinalSpeechResult: boolean = false
  private completionTimeout: NodeJS.Timeout | null = null

  constructor(
    eventBus: IEventBus,
    speechInput: ISpeechInput,
    speechOutput: ISpeechOutput,
    soundManager: SoundManager,
    agentService: AgentService
  ) {
    this.eventBus = eventBus
    this.speechInput = speechInput
    this.speechOutput = speechOutput
    this.soundManager = soundManager
    this.agentService = agentService
    this.stateMachine = new ConversationStateMachine(eventBus)
    
    this.setupServices()
    this.setupStateHandlers()
  }

  private setupServices(): void {
    // Setup speech input handlers
    this.speechInput.onData((data) => {
      this.eventBus.emit(SystemEvents.SPEECH_INPUT_DATA, data)
      
      // Detect interruption during AI response
      if (this.stateMachine.getCurrentState() === ConversationState.RESPONDING) {
        if (data.volume > this.interruptionThreshold) {
          this.eventBus.emit(SystemEvents.USER_INTERRUPT)
        }
      }
    })

    this.speechInput.onError((error) => {
      this.eventBus.emit(SystemEvents.SPEECH_INPUT_ERROR, error)
    })

    this.speechInput.onSpeechRecognized((data) => {
      console.log(`[ConversationOrchestrator] Speech recognized: "${data.text}", isFinal: ${data.isFinal}, current state: ${this.stateMachine.getCurrentState()}`);
      if (data.isFinal && data.text.trim().length > 0) {
        this.eventBus.emit(SystemEvents.USER_SPEECH_RECOGNIZED, data.text);
        this.hasFinalSpeechResult = true;
        
        // Valid speech recognized - no timeout cleanup needed
        
        // Handle speech recognition from different states
        const currentState = this.stateMachine.getCurrentState();
        if (currentState === ConversationState.HEARING) {
          console.log('[ConversationOrchestrator] In HEARING, transitioning to PROCESSING and sending message to LLM');
          this.stateMachine.transition(ConversationAction.START_PROCESSING);
          this.agentService.sendTextMessage(data.text);
          // PROCESSING -> RESPONDING transition will happen when LLM starts responding (AGENT_RESPONSE_STREAM_STARTED)
        } else {
          console.log(`[ConversationOrchestrator] Unexpected state ${currentState} when speech recognized, ignoring to prevent duplicate`);
          // Don't send duplicate messages - only send when in HEARING state
        }
      }
    });

    this.speechInput.onListeningEnded(() => {
      console.log(`[ConversationOrchestrator] Listening ended. hasFinalSpeechResult: ${this.hasFinalSpeechResult}, current state: ${this.stateMachine.getCurrentState()}`);
      
      // Only reset to idle if we're in HEARING state AND we have no speech result
      // If we're already in PROCESSING/RESPONDING, don't interfere with the LLM processing
      const currentState = this.stateMachine.getCurrentState();
      
      if (!this.hasFinalSpeechResult && currentState === ConversationState.HEARING) {
        console.log('[ConversationOrchestrator] No speech result and still in HEARING, transitioning to IDLE');
        this.stateMachine.transition(ConversationAction.RESET);
      } else if (!this.hasFinalSpeechResult && (currentState === ConversationState.PROCESSING || currentState === ConversationState.RESPONDING)) {
        console.log(`[ConversationOrchestrator] No speech result but already in ${currentState} - letting LLM finish`);
      } else if (this.hasFinalSpeechResult) {
        console.log('[ConversationOrchestrator] Have speech result - state management handled by onSpeechRecognized');
      } else {
        console.log(`[ConversationOrchestrator] Listening ended in state ${currentState}, no action needed`);
      }
    });

    // Setup speech output handlers
    this.speechOutput.onData((data) => {
      this.eventBus.emit(SystemEvents.SPEECH_OUTPUT_DATA, data)
    })

    this.speechOutput.onComplete(() => {
      // This callback is now unused since we're not doing TTS for streaming chunks
      // Keeping it for potential future use or voice-initiated conversations
    })

    this.speechOutput.onError((error) => {
      this.eventBus.emit(SystemEvents.SPEECH_OUTPUT_ERROR, error)
    })

    this.eventBus.on(SystemEvents.NEW_CAPTION, (caption: Caption) => {
      this.handleNewCaption(caption);
    })

    // Removed USER_SEND_TEXT_MESSAGE event handler to prevent duplicate message sending

    this.eventBus.on(SystemEvents.AGENT_RESPONSE_STREAM_STARTED, () => {
      console.log('[ConversationOrchestrator] Received AGENT_RESPONSE_STREAM_STARTED, transitioning to responding')
      this.stateMachine.transition(ConversationAction.START_RESPONDING);
    });

    this.eventBus.on(SystemEvents.AGENT_RESPONSE_STREAM_ENDED, () => {
      // Delay transition to idle to give user time to read the final captions
      // This keeps the "responding" state and interrupt button available while captions are visible
      console.log('[ConversationOrchestrator] Stream ended, delaying completion to allow caption reading');
      
      // Clear any existing timeout
      if (this.completionTimeout) {
        clearTimeout(this.completionTimeout);
      }
      
      this.completionTimeout = setTimeout(() => {
        console.log('[ConversationOrchestrator] Caption reading time complete, transitioning to idle');
        this.stateMachine.transition(ConversationAction.COMPLETE_RESPONSE);
        this.completionTimeout = null;
      }, 2500); // Slightly longer than caption display (2000ms) to ensure smooth transition
    });

    this.eventBus.on(SystemEvents.USER_INTERRUPT, () => {
      this.interrupt();
    });
  }

  private handleNewCaption(caption: Caption): void {
    console.log('[ConversationOrchestrator] New caption:', caption);
    
    if (caption.type === 'speech') {
      // Speak the streaming text chunks as they come in
      console.log('[ConversationOrchestrator] Speaking streaming content:', caption.content);
      this.speechOutput.speak(caption.content).catch(error => {
        console.error('[ConversationOrchestrator] TTS error during streaming:', error);
      });
    } else {
      console.log('[ConversationOrchestrator] Tool call received:', caption.content);
    }
  }

  private setupStateHandlers(): void {
    this.eventBus.on(SystemEvents.STATE_CHANGED, (stateChange: { from: ConversationState, to: ConversationState }) => {
      console.log(`[ConversationOrchestrator] State changed: ${stateChange.from} -> ${stateChange.to}`);
      
      // Handle state-specific logic
      switch (stateChange.to) {
        case ConversationState.LISTENING:
          this.speechInput.start().catch(console.error);
          break;
        case ConversationState.HEARING:
          console.log('[ConversationOrchestrator] Entering HEARING state - stopping speech input to trigger transcription');
          this.speechInput.stop();
          // State will transition based on actual events:
          // - onSpeechRecognized if valid speech is detected (HEARING -> PROCESSING -> RESPONDING)
          // - onListeningEnded if no valid speech (which will reset to IDLE)
          break;
        case ConversationState.PROCESSING:
          console.log('[ConversationOrchestrator] Entering PROCESSING state - LLM is thinking');
          // LLM is processing the message
          break;
        case ConversationState.RESPONDING:
          // Response will be handled by the agent service
          break;
        case ConversationState.IDLE:
          this.speechInput.stop();
          this.speechOutput.stop();
          this.hasFinalSpeechResult = false; // Reset for next conversation
          break;
        case ConversationState.INTERRUPTED:
          this.speechOutput.stop();
          break;
      }
    });
  }

  // Public API
  startConversation(): void {
    console.log('[ConversationOrchestrator] Starting conversation');
    this.hasFinalSpeechResult = false;
    this.stateMachine.transition(ConversationAction.START_LISTENING);
  }

  stopConversation(): void {
    console.log('[ConversationOrchestrator] Stopping conversation - transitioning to HEARING to transcribe audio');
    // Instead of going directly to IDLE, go to HEARING to handle transcription
    this.stateMachine.transition(ConversationAction.START_HEARING);
  }

  interrupt(): void {
    console.log('[ConversationOrchestrator] Interrupting conversation');
    
    // Clear any pending completion timeout
    if (this.completionTimeout) {
      clearTimeout(this.completionTimeout);
      this.completionTimeout = null;
      console.log('[ConversationOrchestrator] Cleared pending completion timeout due to interrupt');
    }
    
    this.stateMachine.transition(ConversationAction.INTERRUPT);
  }

  resetConversation(): void {
    console.log('[ConversationOrchestrator] Resetting conversation');
    
    // Clear any pending completion timeout
    if (this.completionTimeout) {
      clearTimeout(this.completionTimeout);
      this.completionTimeout = null;
      console.log('[ConversationOrchestrator] Cleared pending completion timeout due to reset');
    }
    
    this.stateMachine.transition(ConversationAction.RESET);
  }

  sendTextMessage(message: string): void {
    console.log('[ConversationOrchestrator] Sending text message:', message);
    
    // Clear any pending completion timeout since we're starting a new interaction
    if (this.completionTimeout) {
      clearTimeout(this.completionTimeout);
      this.completionTimeout = null;
      console.log('[ConversationOrchestrator] Cleared pending completion timeout due to new message');
    }
    
    // Directly send to agent service, don't emit event to avoid duplicate handling
    this.agentService.sendTextMessage(message);
    this.stateMachine.transition(ConversationAction.START_PROCESSING);
  }

  getCurrentState(): ConversationState {
    return this.stateMachine.getCurrentState();
  }

  dispose(): void {
    this.speechInput.dispose();
    this.speechOutput.dispose();
    this.soundManager.dispose();
    this.agentService.dispose();
    this.eventBus.removeAllListeners();
  }
} 