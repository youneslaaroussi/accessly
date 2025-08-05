import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Settings, X, Mic } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MicrophoneSelection } from './MicrophoneSelection';

export const SettingsPopup = () => {
  const [isOpen, setIsOpen] = useState(false);

  const popupContent = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/40 z-[9998]"
          />
          
          {/* Compact slide-up panel */}
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-sm border-t border-gray-700/50 z-[9999] max-h-[80%] overflow-y-auto"
            onMouseDown={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            {/* Compact header */}
            <div className="flex items-center justify-between p-2 border-b border-gray-700/30">
              <div className="flex items-center gap-1">
                <Settings className="w-3 h-3 text-gray-400" />
                <span className="text-xs font-medium text-gray-300">Settings</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>

            {/* Compact content */}
            <div className="p-2 space-y-3">
              {/* Microphone Settings */}
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <Mic className="w-3 h-3 text-gray-400" />
                  <span className="text-xs font-medium text-gray-300">Microphone</span>
                </div>
                <MicrophoneSelection />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <motion.button
        onClick={() => setIsOpen(true)}
        className="p-1.5 rounded-full bg-gray-700/30 border border-gray-600/50 text-white hover:bg-gray-600/30 hover:text-gray-300 transition-colors"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        <Settings className="w-3 h-3" />
      </motion.button>

      {/* Render popup in a portal to avoid parent container clipping */}
      {createPortal(popupContent, document.body)}
    </>
  );
}; 