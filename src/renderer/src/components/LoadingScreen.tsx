import React, { useState, useEffect } from 'react';

export function LoadingScreen() {
  const [status, setStatus] = useState('Initializing...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('[LoadingScreen] Setting up IPC listeners...');
    
    const removeUpdateListener = window.api.app.onLoadingStatusUpdate((message) => {
      console.log('[LoadingScreen] Status update:', message);
      setStatus(message);
    });

    const removeErrorListener = window.api.app.onInitializationError((errorMessage) => {
      console.log('[LoadingScreen] Error received:', errorMessage);
      setError(errorMessage);
    });

    // App will transition away from this component on 'initialization-complete'
    // so no need to handle that here.

    return () => {
      console.log('[LoadingScreen] Cleaning up IPC listeners...');
      removeUpdateListener();
      removeErrorListener();
    };
  }, []);

  return (
    <div className="w-screen h-screen bg-black flex flex-col items-center justify-center text-white">
      <div className="text-2xl font-bold mb-4">EchoVault</div>
      {error ? (
        <div className="text-red-500 text-center">
          <p className="font-bold">Initialization Failed</p>
          <p className="text-sm mt-2">{error}</p>
        </div>
      ) : (
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto"></div>
          <p className="mt-4 text-gray-300">{status}</p>
        </div>
      )}
    </div>
  );
} 