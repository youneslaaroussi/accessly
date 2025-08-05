import { useState, useEffect } from 'react';
import { serviceContainer } from '../core/ServiceContainer';
import { SystemEvents } from '../core/interfaces/IEventBus';

export function useSystemStatus() {
  const [isTtsUnavailable, setIsTtsUnavailable] = useState(false);
  const eventBus = serviceContainer.getEventBus();

  useEffect(() => {
    const handleTtsFallback = () => {
      console.log('[useSystemStatus] TTS_FALLBACK event received');
      setIsTtsUnavailable(true);
      setTimeout(() => setIsTtsUnavailable(false), 5000); // Hide after 5s
    };

    eventBus.on(SystemEvents.TTS_FALLBACK, handleTtsFallback);

    return () => {
      eventBus.off(SystemEvents.TTS_FALLBACK, handleTtsFallback);
    };
  }, [eventBus]);

  return { isTtsUnavailable };
} 