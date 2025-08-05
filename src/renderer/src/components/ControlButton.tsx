import { motion } from 'framer-motion'
import { cn } from '../lib/utils'

interface ControlButtonProps {
  onClick: () => void
  disabled?: boolean
  text: string
  variant?: 'default' | 'danger' | 'ghost'
}

export function ActionButton({ onClick, disabled = false, text, variant = 'default' }: ControlButtonProps) {
  const baseClasses = "px-6 py-3 rounded-full font-medium transition-all duration-200 border"
  
  const variantClasses = {
    default: "bg-blue-500/20 text-blue-300 border-blue-500/30 hover:bg-blue-500/40 disabled:bg-gray-500/20 disabled:text-gray-400 disabled:border-gray-500/30",
    danger: "bg-red-500/20 text-red-300 border-red-500/30 hover:bg-red-500/40 disabled:bg-gray-500/20 disabled:text-gray-400 disabled:border-gray-500/30",
    ghost: "bg-transparent text-gray-300 border-gray-500/30 hover:bg-gray-500/20 disabled:bg-gray-500/20 disabled:text-gray-400 disabled:border-gray-500/30"
  }

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      className={cn(baseClasses, variantClasses[variant])}
      whileHover={{ scale: disabled ? 1 : 1.05 }}
      whileTap={{ scale: disabled ? 1 : 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
    >
      {text}
    </motion.button>
  )
} 