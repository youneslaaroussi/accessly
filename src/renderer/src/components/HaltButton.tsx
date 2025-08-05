import React from 'react'
import { motion } from 'framer-motion'
import { Square } from 'lucide-react'

interface HaltButtonProps {
  onHalt: () => void
  isVisible: boolean
}

export function HaltButton({ onHalt, isVisible }: HaltButtonProps) {
  if (!isVisible) return null

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50"
    >
      <motion.button
        onClick={onHalt}
        className="relative bg-red-600/90 hover:bg-red-700/95 border-2 border-red-400/50 
                   rounded-full w-20 h-20 flex items-center justify-center
                   shadow-2xl shadow-red-900/50 backdrop-blur-sm
                   transition-all duration-200 group
                   hover:border-red-300/70 hover:shadow-red-900/70"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        style={{
          background: 'radial-gradient(circle, rgba(220, 38, 38, 0.9) 0%, rgba(185, 28, 28, 0.95) 100%)'
        }}
      >
        {/* Pulsing ring animation */}
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-red-400/30"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.5, 0, 0.5]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        
        {/* Stop icon */}
        <Square 
          className="w-8 h-8 text-white fill-current drop-shadow-lg
                     group-hover:text-red-100 transition-colors duration-200" 
        />
        
        {/* Glow effect */}
        <div className="absolute inset-0 rounded-full bg-red-500/20 blur-md -z-10 
                        group-hover:bg-red-400/30 transition-all duration-200" />
      </motion.button>
      
      {/* Label */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap"
      >
        <span className="text-xs text-red-400 font-medium drop-shadow-sm">
          HALT
        </span>
      </motion.div>
    </motion.div>
  )
}