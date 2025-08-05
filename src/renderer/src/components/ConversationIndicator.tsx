import { motion } from 'framer-motion'

interface ConversationIndicatorProps {
  state: 'idle' | 'listening' | 'processing' | 'responding' | 'interrupted'
}

export function ConversationIndicator({ state }: ConversationIndicatorProps) {
  const getStateText = () => {
    switch (state) {
      case 'idle':
        return 'Ready to chat'
      case 'listening':
        return 'Listening...'
      case 'processing':
        return 'Processing...'
      case 'responding':
        return 'Responding...'
      case 'interrupted':
        return 'Interrupted'
      default:
        return 'Ready'
    }
  }

  const getStateColor = () => {
    switch (state) {
      case 'idle':
        return 'text-gray-400'
      case 'listening':
        return 'text-green-400'
      case 'processing':
        return 'text-yellow-400'
      case 'responding':
        return 'text-blue-400'
      case 'interrupted':
        return 'text-red-400'
      default:
        return 'text-gray-400'
    }
  }

  if (state === 'responding') {
    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`text-center text-sm font-medium ${getStateColor()}`}
    >
      {getStateText()}
    </motion.div>
  )
} 