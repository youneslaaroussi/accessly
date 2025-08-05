import React, { useEffect, useRef } from 'react';
import { usePorcupine } from '@picovoice/porcupine-react';

interface WakeWordDetectorProps {
  onWakeWordDetected?: (keyword: string) => void;
  onError?: (error: any) => void;
  onListeningStatusChanged?: (isListening: boolean) => void;
}

// Global flag to prevent multiple initializations
let globalInitialized = false;

export const WakeWordDetector: React.FC<WakeWordDetectorProps> = ({
  onWakeWordDetected,
  onError,
  onListeningStatusChanged
}) => {
  const initRef = useRef(false);

  const {
    keywordDetection,
    isListening,
    error,
    init,
    start,
    stop,
    release,
  } = usePorcupine();



  // Initialize once only
  useEffect(() => {
    if (initRef.current || globalInitialized) {
      return;
    }
    
    initRef.current = true;
    globalInitialized = true;
    
    console.log('[WakeWord] Initializing...');
    
    const initialize = async () => {
      try {
        const accessKey = "josILqM4rL7e44UUBtTMMuGb2IjMBEXUGGqXLwak74GA2xvB/U8wYQ==";
        const keyword = {
          publicPath: "/Hey-Gemma_en_wasm_v3_0_0.ppn",
          label: "Hey Gemma"
        };
        
        // Porcupine model configuration - we need the main model file
        const porcupineModel = {
          publicPath: "/porcupine_params.pv"
        };

        console.log('[WakeWord] Init with:', { keyword, porcupineModel });
        await init(accessKey, keyword, porcupineModel);
        await start();
        
        console.log('[WakeWord] Started listening for "Hey Gemma"');
      } catch (err) {
        console.error('[WakeWord] Initialization failed:', err);
        if (err && typeof err === 'object' && 'message' in err) {
          onError?.(err);
        }
      }
    };

    initialize();

    return () => {
      const cleanup = async () => {
        try {
          console.log('[WakeWord] Cleaning up...');
          // Only try to stop/release if we're actually listening (initialized)
          if (isListening) {
            await stop();
          }
          // Always try release, but catch any errors
          try {
            await release();
          } catch (releaseErr) {
            // Ignore release errors - common in StrictMode
          }
          globalInitialized = false;
          console.log('[WakeWord] Cleanup completed');
        } catch (err) {
          // Just ignore cleanup errors completely - this is StrictMode noise
          console.log('[WakeWord] Cleanup error (ignored - likely StrictMode)');
        }
      };
      cleanup();
    };
  }, [init, start, stop, release, onError, isListening]);

  // Handle keyword detection
  useEffect(() => {
    if (keywordDetection?.label) {
      console.log(`[WakeWord] Detected: "${keywordDetection.label}"`);
      onWakeWordDetected?.(keywordDetection.label);
    }
  }, [keywordDetection, onWakeWordDetected]);

  // Handle listening status
  useEffect(() => {
    onListeningStatusChanged?.(isListening);
  }, [isListening, onListeningStatusChanged]);

  // Handle errors - ignore StrictMode cleanup errors
  useEffect(() => {
    if (error) {
      const errorStr = error.toString().trim();
      const errorMsg = error.message?.trim();
      
      // Ignore the common StrictMode "not initialized" error
      if (errorMsg?.includes('Porcupine has not been initialized or has been released')) {
        console.log('[WakeWord] Ignoring StrictMode cleanup error');
        return;
      }
      
      // Only log actual meaningful errors
      if (errorStr && errorStr !== '' && errorStr !== 'Error:' && errorMsg) {
        console.error('[WakeWord] Error:', error);
        onError?.(error);
      }
    }
  }, [error, onError]);

  return null;
};

export default WakeWordDetector;