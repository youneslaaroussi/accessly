import { useState, useEffect } from 'react'

type LineType = 'text' | 'tool_start' | 'tool_end'

// interface LineUpdate {
//   content: string
//   type: LineType
// }

export function useSimpleLLM() {
  const [currentLine, setCurrentLine] = useState<string>('')
  const [lineType, _setLineType] = useState<LineType>('text')
  const [isConversing, setIsConversing] = useState<boolean>(false)
  
  useEffect(() => {
    // Check if API is available before setting up listeners
    if (!window.api?.llm) {
      console.warn('[useSimpleLLM] LLM API not available yet')
      return
    }

    // Note: onLineUpdate and onConversationComplete are not implemented in the API
    // const removeLineListener = window.api.llm.onLineUpdate((update: LineUpdate) => {
    //   setCurrentLine(update.content)
    //   setLineType(update.type)
    // })
    
    // const removeCompleteListener = window.api.llm.onConversationComplete(() => {
    //   setIsConversing(false)
    // })
    
    // Placeholder cleanup functions
    const removeLineListener = () => {}
    const removeCompleteListener = () => {}
    
    return () => {
      removeLineListener()
      removeCompleteListener()
    }
  }, [])
  
  const sendMessage = async (message: string) => {
    if (!window.api?.llm) {
      console.error('[useSimpleLLM] LLM API not available')
      return
    }

    setIsConversing(true)
    setCurrentLine('')
    
    try {
      await window.api.llm.sendMessage(message)
    } catch (error) {
      console.error('[useSimpleLLM] Error sending message:', error)
      setIsConversing(false)
    }
  }
  
  return {
    currentLine,
    lineType,
    isConversing,
    sendMessage
  }
}