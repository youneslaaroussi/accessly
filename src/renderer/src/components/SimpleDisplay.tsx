import { motion, AnimatePresence } from 'framer-motion'

type LineType = 'text' | 'tool_start' | 'tool_end'

interface SimpleDisplayProps {
  line: string
  type: LineType
}

export function SimpleDisplay({ line, type }: SimpleDisplayProps) {
  const getClassName = () => {
    switch(type) {
      case 'text': 
        return 'text-white/90'
      case 'tool_start': 
        return 'text-blue-400 italic'
      case 'tool_end': 
        return 'text-green-400'
      default: 
        return 'text-white/90'
    }
  }
  
  return (
    <AnimatePresence mode="wait">
      {line && (
        <motion.div
          key={line}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className={`text-center font-geist text-xs ${getClassName()}`}
        >
          {line}
        </motion.div>
      )}
    </AnimatePresence>
  )
}