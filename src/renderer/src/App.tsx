import "./assets/main.css";
import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { SettingsPopup } from "./components/settings/SettingsPopup";
import { TextInput } from "./components/TextInput";
import { AccesslyWaveform } from "./components/AccesslyWaveform";
import { StreamingText } from "./components/StreamingText";
import { WakeWordDetector } from "./components/WakeWordDetector";
import { useConversationOrchestrator } from "./hooks/useConversationOrchestrator";
import { ConversationState } from "./core/state/ConversationStateMachine";
import { motion, AnimatePresence } from "framer-motion";
import { LoadingScreen } from "./components/LoadingScreen";
import { useAgentResponse } from './hooks/useAgentResponse'
import { useOrchestratorAudio } from './hooks'
import { useOllamaStatus } from './hooks/useOllamaStatus'
import { Mic, MicOff, Square, MessageSquare, Monitor } from 'lucide-react'

type AppStatus = 'loading' | 'ready' | 'error'

export function App() {
  const [appStatus, setAppStatus] = useState<AppStatus>('loading')
  const [showTextInput, setShowTextInput] = useState(false)
  const { conversationState, sendTextMessage, startConversation, stopConversation } = useConversationOrchestrator();
  const { isResponding, currentCaption } = useAgentResponse()
  const { isListening, audioData: userAudioData } = useOrchestratorAudio()
  const { status: ollamaStatus } = useOllamaStatus()
  const isConversationActive = conversationState !== ConversationState.IDLE;
  const isProcessingOrResponding = isResponding || conversationState === 'hearing' || conversationState === 'processing';
  const textInputRef = useRef<HTMLInputElement>(null);

  // Wake word detection handlers
  const handleWakeWordDetected = (keyword: string) => {
    console.log(`[App] Wake word detected: ${keyword}`);
    if (!isConversationActive) {
      console.log('[App] Starting conversation due to wake word');
      startConversation();
    }
  };

  const handleWakeWordError = (error: any) => {
    console.error('[App] Wake word error:', error);
  };

  const handleWakeWordListeningStatus = (isListening: boolean) => {
    console.log(`[App] Wake word listening status: ${isListening}`);
  };

  // Auto-focus input when message box opens
  useEffect(() => {
    if (showTextInput && textInputRef.current) {
      textInputRef.current.focus();
    }
  }, [showTextInput]);

  // Set up main process console forwarding to Chrome DevTools
  useEffect(() => {
    const cleanup = window.api.app.onMainConsoleLog((data) => {
      const prefix = '[MAIN]';
      const message = data.args.join(' ');
      
      switch (data.type) {
        case 'log':
          console.log(prefix, message);
          break;
        case 'error':
          console.error(prefix, message);
          break;
        case 'warn':
          console.warn(prefix, message);
          break;
        case 'info':
          console.info(prefix, message);
          break;
        default:
          console.log(prefix, message);
      }
    });

    return cleanup;
  }, []);

  useEffect(() => {
    console.log('[App] Setting up initialization listeners...');

    // First, check if initialization is already complete
    const checkInitialStatus = async () => {
      try {
        const status = await window.api.app.checkInitializationStatus()
        console.log('[App] Initial status check:', status)

        if (status.isInitialized) {
          console.log('[App] Already initialized! Setting status to ready.')
          setAppStatus('ready')
          return true // Skip setting up listeners
        } else if (status.error) {
          console.log('[App] Initialization previously failed:', status.error)
          setAppStatus('error')
          return true // Skip setting up listeners
        }

        return false // Continue with normal listener setup
      } catch (error) {
        console.error('[App] Failed to check initialization status:', error)
        return false // Continue with normal listener setup
      }
    }

    checkInitialStatus().then((shouldSkipListeners) => {
      if (shouldSkipListeners) {
        return
      }

      // Set up event listeners for ongoing initialization
      const removeCompleteListener = window.api.app.onInitializationComplete(() => {
        console.log('[App] Initialization complete received! Setting status to ready.');
        setAppStatus('ready')
      })

      const removeErrorListener = window.api.app.onInitializationError(() => {
        console.log('[App] Initialization error received! Setting status to error.');
        setAppStatus('error')
      })

      // Cleanup function for event listeners
      return () => {
        console.log('[App] Cleaning up initialization listeners...');
        removeCompleteListener()
        removeErrorListener()
      }
    })
  }, [])

  if (appStatus === 'loading' || appStatus === 'error') {
    return <LoadingScreen />
  }

  const getStatusColor = () => {
    if (isListening) return 'bg-green-500'
    if (isResponding) return 'bg-blue-500'
    return 'bg-gray-500'
  }

  const handleVoiceToggle = () => {
    if (isConversationActive) {
      stopConversation()
    } else {
      startConversation()
    }
  }

  const handleTextToggle = () => {
    setShowTextInput(!showTextInput)
  }

  const handleSendMessage = (message: string) => {
    sendTextMessage(message)
    setShowTextInput(false)
  }

  const handleHalt = async () => {
    console.log('[App] Halt button pressed')
    try {
      await window.api.llm.halt()
    } catch (error) {
      console.error('[App] Error halting LLM:', error)
    }
  }

  // Get appropriate audio data for waveform
  const getWaveformAudioData = () => {
    if (userAudioData instanceof Uint8Array && userAudioData.length > 0) {
      return userAudioData
    }
    // Return baseline data for animation
    const baselineData = new Uint8Array(64)
    baselineData.fill(128)
    return baselineData
  }

  // Get current status text and key for StreamingText
  const getCurrentStatus = () => {
    if (isListening) return { text: 'Listening...', key: 'listening', isToolCall: false }
    if (conversationState === 'hearing') return { text: 'Hearing...', key: 'hearing', isToolCall: false }
    if (conversationState === 'processing') return { text: 'Processing...', key: 'processing', isToolCall: false }
    // Show "Gemma3n Ready" when idle
    if (conversationState === ConversationState.IDLE && !isResponding) {
      return { text: 'Gemma3n Ready', key: 'ready', isToolCall: false }
    }
    return null
  }

  const currentStatus = getCurrentStatus()

  return (
    <div className="w-full h-full bg-black/90 backdrop-blur-md border border-gray-700/30 flex flex-col relative overflow-hidden shadow-2xl">
      {/* Wake word detection - headless component */}
      <WakeWordDetector
        onWakeWordDetected={handleWakeWordDetected}
        onError={handleWakeWordError}
        onListeningStatusChanged={handleWakeWordListeningStatus}
      />

      {/* Ollama Status Indicator - top left corner */}
      <div className="absolute top-1 left-1 z-10">
        <div className={`px-1.5 py-0.5 rounded text-xs font-mono text-gray-400 bg-black/40 backdrop-blur-sm border transition-colors ${
          ollamaStatus.connected 
            ? 'border-green-600/30 text-green-400' 
            : 'border-red-600/30 text-red-400'
        }`}>
          <div className="flex items-center space-x-1">
            <div className={`w-1.5 h-1.5 rounded-full ${
              ollamaStatus.connected ? 'bg-green-400' : 'bg-red-400'
            }`} />
            <span>ollama {ollamaStatus.status}</span>
          </div>
        </div>
      </div>

      {/* Status indicator */}
      <div className={`w-full h-0.5 ${getStatusColor()} transition-colors duration-300`} />

      {/* Waveform visualization */}
      <div className="flex-1 relative overflow-hidden">
        <AccesslyWaveform
          audioData={getWaveformAudioData()}
          isPlaying={isListening || isResponding || conversationState === 'processing'}
          variant={isListening ? 'user' : 'ai'}
          isAISpeaking={isResponding}
          isProcessing={conversationState === 'processing'}
          isToolCall={currentCaption?.type === 'tool_call'}
          className="w-full h-full absolute inset-0"
        />

        {/* Overlay content - moved higher up */}
        <div className="absolute inset-0 flex flex-col justify-center items-center -mt-24">
          {/* Voice control / Halt button */}
          <motion.button
            onClick={isProcessingOrResponding ? handleHalt : handleVoiceToggle}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${
              isProcessingOrResponding 
                ? 'bg-red-600/80 border border-red-500/50 text-red-200 hover:bg-red-700/90 shadow-lg shadow-red-900/20'
                : isListening
                ? 'bg-green-500/20 border border-green-500/50 text-green-400 shadow-lg shadow-green-500/20'
                : 'bg-gray-800/60 border border-gray-600/50 text-gray-300 hover:bg-gray-700/60 backdrop-blur-sm'
              }`}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            {isProcessingOrResponding ? (
              <Square className="w-4 h-4 fill-current" />
            ) : isListening ? (
              <MicOff className="w-4 h-4" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </motion.button>

          {/* Status text with StreamingText - only show when there's a status */}
          <div className="mt-3 h-6 flex items-center justify-center max-w-md mx-auto">
            <AnimatePresence mode="wait">
              {isResponding && currentCaption ? (
                <StreamingText
                  key={`caption-${currentCaption.content}`}
                  text={currentCaption.content}
                  delay={0}
                  isToolCall={currentCaption.type === 'tool_call'}
                />
              ) : currentStatus ? (
                <StreamingText
                  key={currentStatus.key}
                  text={currentStatus.text}
                  delay={0}
                  isToolCall={currentStatus.isToolCall}
                />
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Control buttons - positioned at bottom */}
      <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex space-x-2">
        <motion.button
          onClick={isProcessingOrResponding ? undefined : handleTextToggle}
          disabled={isProcessingOrResponding}
          className={`p-1.5 rounded-full border transition-colors backdrop-blur-sm ${
            isProcessingOrResponding 
              ? 'bg-gray-800/30 border-gray-700/30 text-gray-500 cursor-not-allowed opacity-50'
              : 'bg-gray-800/60 border-gray-600/50 text-gray-300 hover:bg-gray-700/60'
          }`}
          whileHover={isProcessingOrResponding ? {} : { scale: 1.1 }}
          whileTap={isProcessingOrResponding ? {} : { scale: 0.9 }}
        >
          <MessageSquare className="w-3 h-3" />
        </motion.button>

        <motion.button
          onClick={() => window.api.computer.openWindow()}
          className="p-1.5 rounded-full bg-gray-700/30 border border-gray-600/50 text-white hover:bg-gray-600/30 hover:text-gray-300 transition-colors"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <Monitor className="w-3 h-3" />
        </motion.button>

        <div className={isProcessingOrResponding ? 'opacity-50 pointer-events-none' : ''}>
          <SettingsPopup />
        </div>
      </div>

      {/* Text input overlay - rendered via portal */}
      {createPortal(
        <AnimatePresence>
          {showTextInput && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="fixed inset-0 bg-black/95 backdrop-blur-md flex flex-col justify-center p-3 z-[9999]"
              style={{ 
                willChange: 'opacity, transform'
              }}
            >
              <div className="space-y-2 max-w-md mx-auto w-full">
                <TextInput
                  onSendMessage={handleSendMessage}
                  disabled={isConversationActive}
                  ref={textInputRef}
                />
                <button
                  onClick={() => setShowTextInput(false)}
                  className="w-full py-1 text-xs text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

export default App;



