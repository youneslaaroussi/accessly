import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useOrchestratorAudio, useBrowserSpeech, useSystemStatus, useConversationOrchestrator } from '../hooks'
import { useAgentResponse } from '../hooks/useAgentResponse'
import { AccesslyWaveform } from './AccesslyWaveform'
import { StreamingText } from './StreamingText'
import { ActionButton } from './ControlButton'
import { TtsUnavailableIndicator } from './TtsUnavailableIndicator'

import { serviceContainer } from '../core/ServiceContainer'
import { ConversationIndicator } from './ConversationIndicator'

interface AudioVisualizerProps {
  className?: string
}

export default function AudioVisualizer({ className = "" }: AudioVisualizerProps) {
  const { conversationState, startConversation, stopConversation } = useConversationOrchestrator()
  const { audioData: userAudioData, isListening } = useOrchestratorAudio()
  const { isTtsUnavailable } = useSystemStatus()
  const { audioData: aiAudioData } = useBrowserSpeech()
  
  // Simple agent response management - no complex state machine bullshit
  const { isResponding, currentCaption, interrupt } = useAgentResponse()

  // Combined app state - respects both conversation (for voice) and agent response (for text)
  const getAppState = () => {
    if (isListening || conversationState === 'listening') return 'listening'
    if (isResponding || conversationState === 'responding') return 'responding'
    if (conversationState === 'processing') return 'processing'
    return 'idle'
  }
  
  const appState = getAppState()



  const handleStart = () => {
    serviceContainer.getSpeechOutput().warmupEngine()
    serviceContainer.getSoundManager().resumeAudioContext()
    startConversation()
  }

  const handleStop = () => {
    serviceContainer.getSoundManager().resumeAudioContext()
    stopConversation()
  }

  // Simple audio data logic - no complex switching
  const getCurrentAudioData = () => {
    if (isListening) {
      return userAudioData
    }
    
    if (isResponding) {
      // If we have actual TTS audio, use it
      if (aiAudioData instanceof Float32Array && aiAudioData.length > 0) {
        // Convert Float32Array (range [-1, 1]) to Uint8Array (range [0, 255])
        const uint8 = new Uint8Array(aiAudioData.length)
        for (let i = 0; i < aiAudioData.length; i++) {
          // Clamp values to [-1, 1] range and convert to [0, 255]
          const clampedValue = Math.max(-1, Math.min(1, aiAudioData[i]))
          uint8[i] = Math.round((clampedValue + 1) * 127.5)
        }
        return uint8
      }
      // Otherwise return baseline data - waveform will animate via isAISpeaking prop
      const staticData = new Uint8Array(128) // Increased size for better fallback visualization
      staticData.fill(128)
      return staticData
    }
    
    return new Uint8Array(128) // Consistent default size
  }

  const getWaveformVariant = () => {
    if (!currentCaption) return 'user'
    return currentCaption.type === 'speech' ? 'ai' : 'user'
  }

  const getButtonText = () => {
    if (conversationState === 'listening') return 'Stop Listening'
    if (conversationState === 'processing') return 'Processing...'
    if (conversationState === 'responding') return 'Responding...'
    return 'Start Conversation'
  }

  const isButtonDisabled = () => {
    return conversationState === 'processing' || conversationState === 'responding'
  }

  return (
    <div className={`w-full h-full bg-black flex flex-col items-center justify-center relative ${className}`}>
      <AnimatePresence>
        {isTtsUnavailable && <TtsUnavailableIndicator />}
      </AnimatePresence>
      
      {/* Conversation Waveform */}
      <AccesslyWaveform 
        audioData={getCurrentAudioData()} 
        isPlaying={appState === 'listening' || appState === 'responding'} 
        variant={getWaveformVariant()}
        isAISpeaking={isResponding && !!currentCaption}
        className="w-full h-32 md:h-64" 
      />
      
      {/* Simple State Indicator */}
      <ConversationIndicator state={appState} />

      {/* AI Response Captions and Interrupt button */}
      <AnimatePresence mode="popLayout">
        {currentCaption && (
          <motion.div 
            className="absolute bottom-32 left-1/2 transform -translate-x-1/2 w-full max-w-3xl px-8 z-30 flex flex-col items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <StreamingText
              key={currentCaption.content}
              text={currentCaption.content}
              delay={0}
              onComplete={() => {}}
              isToolCall={currentCaption.type === 'tool_call'}
            />
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0, transition: { delay: 1 } }}
              exit={{ opacity: 0, y: 10 }}
              onClick={() => interrupt()}
              className="mt-6 bg-red-500/20 text-red-300 border border-red-500/30 rounded-full px-4 py-1 text-sm font-medium hover:bg-red-500/40 transition-colors"
            >
              Interrupt Agent
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Conversation Controls */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex flex-col items-center space-y-4">
        <ActionButton 
          onClick={conversationState === 'listening' ? handleStop : handleStart}
          disabled={isButtonDisabled()}
          text={getButtonText()}
          variant={conversationState === 'listening' ? 'danger' : 'default'}
        />
      </div>
    </div>
  )
} 