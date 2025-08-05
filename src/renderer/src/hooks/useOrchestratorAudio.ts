import { useState, useEffect } from 'react';
import { serviceContainer } from '../core/ServiceContainer';
import { SystemEvents } from '../core/interfaces/IEventBus';
import type { SpeechInputData } from '../core/interfaces/ISpeechInput';

/**
 * Hook that provides audio visualization data from the orchestrator's speech input.
 * Uses frequency domain data for proper waveform visualization.
 */
export function useOrchestratorAudio() {
  const [audioData, setAudioData] = useState<Uint8Array>(new Uint8Array(128));
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    const eventBus = serviceContainer.getEventBus();

    const handleSpeechInputData = (data: SpeechInputData) => {
      if (data.frequencyData && data.isActive) {
        // Use frequency data directly for visualization (already in 0-255 range)
        setAudioData(data.frequencyData);
        setIsListening(data.isActive);
      }
    };

    const handleStateChange = (stateChange: { to: string }) => {
      // Reset audio data when not listening
      if (stateChange.to !== 'listening') {
        setIsListening(false);
        setAudioData(new Uint8Array(128));
      }
    };

    eventBus.on(SystemEvents.SPEECH_INPUT_DATA, handleSpeechInputData);
    eventBus.on(SystemEvents.STATE_CHANGED, handleStateChange);

    return () => {
      eventBus.off(SystemEvents.SPEECH_INPUT_DATA, handleSpeechInputData);
      eventBus.off(SystemEvents.STATE_CHANGED, handleStateChange);
    };
  }, []);

  return {
    audioData,
    isListening
  };
} 