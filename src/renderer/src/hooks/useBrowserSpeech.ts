import { useState, useEffect } from 'react';
import { serviceContainer } from '../core/ServiceContainer';
import type { SpeechOutputData } from '../core/interfaces/ISpeechOutput';

export function useBrowserSpeech() {
  const [audioData, setAudioData] = useState<Float32Array>(new Float32Array(0));
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const speechOutput = serviceContainer.getSpeechOutput();

    const handleData = (data: SpeechOutputData) => {
      setAudioData(new Float32Array(data.audioData));
      setIsPlaying(data.isPlaying);
    };

    const handleComplete = () => {
      setIsPlaying(false);
      setAudioData(new Float32Array(0));
    };

    speechOutput.onData(handleData);
    speechOutput.onComplete(handleComplete);
    
    return () => {
      speechOutput.onData(() => {});
      speechOutput.onComplete(() => {});
    };
  }, []);

  return { audioData, isPlaying };
} 