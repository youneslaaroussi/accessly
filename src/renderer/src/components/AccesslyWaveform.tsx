import React, { useRef, useEffect, useCallback } from 'react'
import { gsap } from 'gsap'
import { cn } from '../lib/utils'

interface AccesslyWaveformProps {
  audioData: Uint8Array
  isPlaying: boolean
  className?: string
  variant?: 'user' | 'ai'
  isAISpeaking?: boolean
  isProcessing?: boolean
  isToolCall?: boolean
}

const getWaveConfig = (variant: 'user' | 'ai', isToolCall: boolean = false) => ({
  barCount: 80,
  barWidth: 4,
  barSpacing: 2,
  maxHeight: 120,
  baseHeight: 4,
  colorStops: isToolCall ? [
    { stop: 0, color: [255, 193, 7] },    // Tool Call: Bright Yellow
    { stop: 0.3, color: [255, 152, 0] },  // Orange
    { stop: 0.6, color: [255, 87, 34] },  // Deep Orange
    { stop: 1, color: [244, 67, 54] }     // Red
  ] : variant === 'user' ? [
    { stop: 0, color: [0, 122, 255] },    // User: Blue
    { stop: 0.3, color: [94, 92, 230] },  // Purple
    { stop: 0.6, color: [138, 43, 226] }, // Violet
    { stop: 1, color: [75, 0, 130] }      // Indigo
  ] : [
    { stop: 0, color: [34, 197, 94] },    // AI: Green
    { stop: 0.3, color: [16, 185, 129] }, // Emerald
    { stop: 0.6, color: [59, 130, 246] }, // Blue
    { stop: 1, color: [99, 102, 241] }    // Indigo
  ]
})

export function AccesslyWaveform({ audioData, isPlaying, className, variant = 'user', isAISpeaking = false, isProcessing = false, isToolCall = false }: AccesslyWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | undefined>(undefined)
  const animatedHeights = useRef<{ [key: number]: number }>({})
  const animatedCenterBarHeight = useRef<{ height: number }>({ height: 0 })



  // Interpolate between colors
  const interpolateColor = (color1: number[], color2: number[], factor: number): number[] => {
    return [
      Math.round(color1[0] + (color2[0] - color1[0]) * factor),
      Math.round(color1[1] + (color2[1] - color1[1]) * factor),
      Math.round(color1[2] + (color2[2] - color1[2]) * factor)
    ]
  }

  // Get color for a specific position
  const getColorAtPosition = (position: number): string => {
    const waveConfig = getWaveConfig(variant, isToolCall)
    const { colorStops } = waveConfig

    for (let i = 0; i < colorStops.length - 1; i++) {
      const current = colorStops[i]
      const next = colorStops[i + 1]

      if (position >= current.stop && position <= next.stop) {
        const localPosition = (position - current.stop) / (next.stop - current.stop)
        const color = interpolateColor(current.color, next.color, localPosition)
        return `rgb(${color[0]}, ${color[1]}, ${color[2]})`
      }
    }

    return `rgb(${colorStops[0].color[0]}, ${colorStops[0].color[1]}, ${colorStops[0].color[2]})`
  }

  // Animation loop
  const animate = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width, height } = canvas
    const centerY = height / 2
    const waveConfig = getWaveConfig(variant, isToolCall)
    const { barCount, barWidth, barSpacing, maxHeight, baseHeight } = waveConfig

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Calculate total width needed for bars (removed unused variables)
    // const totalBarWidth = barCount * barWidth + (barCount - 1) * barSpacing
    // const startX = (width - totalBarWidth) / 2 // Unused variable - calculated but not needed

    // Draw horizontally mirrored waveform bars (left mirrors right)
    const halfBarCount = Math.floor(barCount / 2)
    const centerX = width / 2

    for (let i = 0; i < halfBarCount; i++) {
      // Calculate bar height based on audio data
      let targetBarHeight = baseHeight

      if (isAISpeaking) {
        // Quieter, more gentle speech-like animation
        const time = Date.now() * 0.0015  // Slightly slower
        
        // Create speech formants (frequency bands that simulate speech) - reduced intensity
        const formant1 = Math.sin(time * 2.3 + i * 0.12) * 0.4  // Low frequency (vowels) - reduced from 0.7
        const formant2 = Math.sin(time * 5.7 + i * 0.08) * 0.3  // Mid frequency (consonants) - reduced from 0.5
        const formant3 = Math.sin(time * 8.1 + i * 0.15) * 0.2  // High frequency (sibilants) - reduced from 0.3
        
        // Add speech envelope (natural speech has pauses and emphasis) - gentler
        const envelope = Math.sin(time * 0.8) * 0.2 + 0.6  // Reduced variation from 0.3 to 0.2
        const emphasis = Math.sin(time * 4.2 + i * 0.05) * 0.1  // Reduced emphasis from 0.2 to 0.1
        
        // Combine formants with envelope
        const speechSignal = (formant1 + formant2 + formant3) * envelope + emphasis
        
        // Create quieter natural speech amplitude (0.2 to 0.6 range) - much reduced
        const amplitude = Math.abs(speechSignal) * 0.15 + 0.25  // Reduced from 0.3 + 0.4
        
        targetBarHeight = baseHeight + (amplitude * maxHeight * 0.6)  // Additional 0.6 multiplier to reduce overall height
      } else if (isToolCall) {
        // Tool call animation - relaxed, subtle digital movements
        const time = Date.now() * 0.002  // Slower for more relaxed feel
        
        // Create subtle digital/binary-like patterns
        const digitalPattern = Math.floor(Math.sin(time * 3 + i * 0.15) * 3) / 3  // Stepped/quantized but gentler
        const glitch = Math.sin(time * 8 + i * 0.5) * 0.1  // Reduced glitch effect
        const dataFlow = Math.sin(time * 1.5 + i * 0.08) * 0.3  // Gentler data flowing pattern
        
        // Combine for subtle technical/tool execution feel
        const toolAmplitude = Math.abs(digitalPattern + glitch + dataFlow) * 0.25  // Much reduced amplitude
        targetBarHeight = baseHeight + (toolAmplitude * maxHeight * 0.4)  // Much less pronounced
      } else if (isProcessing) {
        // Processing animation - pulsing, rhythmic pattern
        const time = Date.now() * 0.003  // Slightly faster for processing feel
        
        // Create a pulsing wave that emanates from center
        const distanceFromCenter = Math.abs(i - halfBarCount / 2) / (halfBarCount / 2)
        const pulse = Math.sin(time * 3 - distanceFromCenter * 2) * 0.6 + 0.4  // Strong pulse
        const ripple = Math.sin(time * 2 + i * 0.3) * 0.3  // Secondary ripple effect
        
        // Combine for a "thinking" pattern
        const processingAmplitude = (pulse + ripple) * 0.4  // Moderate amplitude
        targetBarHeight = baseHeight + (processingAmplitude * maxHeight * 0.8)
      } else if (isPlaying && audioData[i] !== undefined) {
        // Use actual audio data for this bar
        const audioIndex = Math.floor((i / halfBarCount) * audioData.length)
        const audioValue = audioData[audioIndex] / 255 // Normalize to 0-1
        targetBarHeight = baseHeight + (audioValue * maxHeight)
      } else if (!isPlaying) {
        // Gentle animation when not playing
        const time = Date.now() * 0.002
        const wave = Math.sin(time + i * 0.2) * 0.3 + 0.7
        targetBarHeight = baseHeight + wave * 20
      }

      // Ease the bar height
      if (animatedHeights.current[i] === undefined) {
        animatedHeights.current[i] = baseHeight
      }
      gsap.to(animatedHeights.current, { [i]: targetBarHeight, duration: 0.2, ease: 'power2.out' })
      const barHeight = animatedHeights.current[i]

      // Calculate positions for mirrored bars
      const offsetFromCenter = i * (barWidth + barSpacing) + barSpacing
      const leftX = centerX - offsetFromCenter - barWidth
      const rightX = centerX + offsetFromCenter

      const position = i / (halfBarCount - 1)
      const color = getColorAtPosition(position)

      // Draw left bar
      ctx.fillStyle = color
      ctx.shadowColor = color
      ctx.shadowBlur = 8
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 0

      const barY = centerY - barHeight / 2
      ctx.beginPath()
      if ((ctx as any).roundRect) {
        (ctx as any).roundRect(leftX, barY, barWidth, barHeight, barWidth / 2)
      } else {
        ctx.rect(leftX, barY, barWidth, barHeight)
      }
      ctx.fill()

      // Draw right bar (mirror)
      ctx.beginPath()
      if ((ctx as any).roundRect) {
        (ctx as any).roundRect(rightX, barY, barWidth, barHeight, barWidth / 2)
      } else {
        ctx.rect(rightX, barY, barWidth, barHeight)
      }
      ctx.fill()

      // Reset shadow
      ctx.shadowBlur = 0
    }

    // Draw center bar if odd number of bars
    if (barCount % 2 === 1) {
      let targetCenterBarHeight = baseHeight

      if (isToolCall) {
        // Tool call center bar - subtle, relaxed digital core
        const time = Date.now() * 0.002
        const digitalCore = Math.floor(Math.sin(time * 4) * 2) / 2 * 0.4 + 0.3  // Gentler quantized pulse
        targetCenterBarHeight = baseHeight + (digitalCore * maxHeight * 0.5)  // Much reduced height
      } else if (isProcessing) {
        // Center bar gets special "core" processing animation
        const time = Date.now() * 0.003
        const corePulse = Math.sin(time * 4) * 0.7 + 0.5  // Strong central pulse
        targetCenterBarHeight = baseHeight + (corePulse * maxHeight * 0.9)
      } else if (isPlaying && audioData[0] !== undefined) {
        const audioValue = audioData[0] / 255
        targetCenterBarHeight = baseHeight + (audioValue * maxHeight)
      } else if (!isPlaying) {
        const time = Date.now() * 0.002
        const wave = Math.sin(time) * 0.3 + 0.7
        targetCenterBarHeight = baseHeight + wave * 20
      }

      gsap.to(animatedCenterBarHeight.current, { height: targetCenterBarHeight, duration: 0.8, ease: 'power2.out' })
      const centerBarHeight = animatedCenterBarHeight.current.height

      const centerColor = getColorAtPosition(0.5)
      ctx.fillStyle = centerColor
      ctx.shadowColor = centerColor
      ctx.shadowBlur = 8

      const centerBarY = centerY - centerBarHeight / 2
      ctx.beginPath()
      if ((ctx as any).roundRect) {
        (ctx as any).roundRect(centerX - barWidth / 2, centerBarY, barWidth, centerBarHeight, barWidth / 2)
      } else {
        ctx.rect(centerX - barWidth / 2, centerBarY, barWidth, centerBarHeight)
      }
      ctx.fill()
      ctx.shadowBlur = 0
    }

    animationRef.current = requestAnimationFrame(animate)
  }, [audioData, isPlaying, variant, isAISpeaking, isProcessing, isToolCall])

  // Start animation loop
  useEffect(() => {
    animate()
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [animate])

  // Handle canvas resize
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width
      canvas.height = rect.height
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    return () => window.removeEventListener('resize', resizeCanvas)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={cn(className || "w-full h-64", 'pointer-events-none')}
      style={{ width: '100%', height: '256px' }}
    />
  )
} 