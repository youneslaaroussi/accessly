import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'

interface StreamingTextProps {
  text: string
  delay: number
  onComplete?: () => void
  isToolCall?: boolean
}

export function StreamingText({ text, delay, onComplete, isToolCall = false }: StreamingTextProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true)
      if (onComplete) {
        setTimeout(onComplete, 1500) // Show for 1.5s before calling onComplete
      }
    }, delay)

    return () => clearTimeout(timer)
  }, [delay, onComplete])

  if (!isVisible) return null

  return (
    <motion.div
      initial={{ 
        opacity: 0, 
        y: 20, 
        filter: 'blur(20px)' 
      }}
      animate={{ 
        opacity: 1, 
        y: 0, 
        filter: 'blur(0px)' 
      }}
      exit={{ 
        opacity: 0, 
        y: -20, 
        filter: 'blur(10px)' 
      }}
      transition={{ 
        duration: 0.6, 
        ease: [0.25, 0.46, 0.45, 0.94]
      }}
      className={`text-center leading-relaxed px-2 font-geist text-xs ${
        isToolCall ? 'text-yellow-400 italic' : 'text-white/90'
      }`}
      style={{ fontFamily: 'Geist, -apple-system, BlinkMacSystemFont, sans-serif' }}
    >
      <ReactMarkdown
        components={{
          // Custom styling for markdown elements
          p: ({ children }) => <p className="my-1">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
          em: ({ children }) => <em className="italic text-white/80">{children}</em>,
          code: ({ children }) => (
            <code className="bg-gray-800/50 px-1 py-0.5 rounded text-xs font-mono text-green-400">
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="bg-gray-900/50 p-2 rounded-md text-xs font-mono text-green-300 my-2 overflow-x-auto">
              {children}
            </pre>
          ),
          h1: ({ children }) => <h1 className="text-sm font-bold text-white my-1">{children}</h1>,
          h2: ({ children }) => <h2 className="text-sm font-semibold text-white my-1">{children}</h2>,
          h3: ({ children }) => <h3 className="text-xs font-semibold text-white my-1">{children}</h3>,
          ul: ({ children }) => <div className="text-xs my-1">{children}</div>,
          ol: ({ children }) => <div className="text-xs my-1">{children}</div>,
          li: ({ children }) => <div className="my-0.5">{children}</div>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-white/20 pl-2 italic text-white/80 my-1">
              {children}
            </blockquote>
          )
        }}
      >
        {text}
      </ReactMarkdown>
    </motion.div>
  )
} 