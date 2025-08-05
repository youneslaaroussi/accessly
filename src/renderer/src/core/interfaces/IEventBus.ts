export type EventHandler<T = any> = (data: T) => void

export interface IEventBus {
  on<T = any>(event: string, handler: EventHandler<T>): void
  off<T = any>(event: string, handler: EventHandler<T>): void
  emit<T = any>(event: string, data?: T): void
  removeAllListeners(event?: string): void
}

// System Events
export enum SystemEvents {
  // State machine events
  STATE_CHANGED = 'state_changed',

  // User-initiated events
  USER_START_CONVERSATION = 'user_start_conversation',
  USER_STOP_CONVERSATION = 'user_stop_conversation',
  USER_INTERRUPT = 'user_interrupt',
  USER_RESET = 'user_reset',
  USER_SEND_TEXT_MESSAGE = 'user_send_text_message',
  USER_SPEECH_RECOGNIZED = 'user_speech_recognized',

  // Speech input events
  SPEECH_INPUT_STARTED = 'speech_input_started',
  SPEECH_INPUT_DATA = 'speech_input_data',
  SPEECH_INPUT_ERROR = 'speech_input_error',

  // Speech output events
  SPEECH_OUTPUT_STARTED = 'speech_output_started',
  SPEECH_OUTPUT_DATA = 'speech_output_data',
  SPEECH_OUTPUT_COMPLETED = 'speech_output_completed',
  SPEECH_OUTPUT_ERROR = 'speech_output_error',

  // New caption event
  NEW_CAPTION = 'new_caption',

  // Agent response stream
  AGENT_RESPONSE_STREAM_STARTED = 'agent_response_stream_started',
  AGENT_RESPONSE_STREAM_ENDED = 'agent_response_stream_ended',

  // TTS Fallback
  TTS_FALLBACK = 'tts_fallback'
} 