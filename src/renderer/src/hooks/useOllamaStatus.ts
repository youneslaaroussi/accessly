import { useState, useEffect } from 'react'

interface OllamaStatus {
  connected: boolean
  provider: string
  status: string
  error?: string
}

export function useOllamaStatus() {
  const [status, setStatus] = useState<OllamaStatus>({
    connected: false,
    provider: 'unknown',
    status: 'initializing'
  })
  const [isLoading, setIsLoading] = useState(true)

  const checkStatus = async () => {
    try {
      if (!window.api?.llm?.getConnectionStatus) {
        console.warn('[useOllamaStatus] LLM connection status API not available yet')
        setStatus({
          connected: false,
          provider: 'unknown',
          status: 'initializing'
        })
        setIsLoading(false)
        return
      }

      const result = await window.api.llm.getConnectionStatus()
      setStatus(result)
    } catch (error) {
      console.error('[useOllamaStatus] Error checking ollama status:', error)
      // Don't overwrite initializing status with error immediately
      if (status.status !== 'initializing') {
        setStatus({
          connected: false,
          provider: 'unknown',
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    // Wait a bit for main process to fully initialize before checking
    const initialTimeout = setTimeout(() => {
      checkStatus()
    }, 2000)

    // Set up periodic status checks - more frequent initially, then less frequent
    const interval = setInterval(() => {
      checkStatus()
    }, status.connected ? 30000 : 10000) // 10s if not connected, 30s if connected

    return () => {
      clearTimeout(initialTimeout)
      clearInterval(interval)
    }
  }, [status.connected])

  return {
    status,
    isLoading,
    refreshStatus: checkStatus
  }
}