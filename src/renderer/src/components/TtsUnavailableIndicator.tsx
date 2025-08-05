import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

export function TtsUnavailableIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="absolute top-20 left-1/2 -translate-x-1/2 bg-yellow-500/10 text-yellow-300 px-4 py-2 rounded-full text-sm flex items-center gap-2 border border-yellow-500/20"
    >
      <AlertTriangle className="w-4 h-4" />
      <span>No TTS voice available. Using fallback.</span>
    </motion.div>
  );
} 