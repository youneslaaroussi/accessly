import { create } from 'zustand'

interface ConfigurationState {
  microphoneDeviceId: string | null
  ttsVoiceURI: string | null
  setMicrophoneDeviceId: (deviceId: string) => void
  setTtsVoiceURI: (voiceURI: string) => void
}

export const useConfigurationStore = create<ConfigurationState>((set) => ({
  microphoneDeviceId: null,
  ttsVoiceURI: null,
  setMicrophoneDeviceId: (deviceId: string) => set({ microphoneDeviceId: deviceId }),
  setTtsVoiceURI: (voiceURI: string) => set({ ttsVoiceURI: voiceURI }),
}))

export const getDefaultVoiceURI = (): string | null => {
  const voices = window.speechSynthesis.getVoices()
  
  // Try to find a good default voice
  const preferredVoices = [
    'Microsoft Zira - English (United States)',
    'Microsoft David - English (United States)', 
    'Google US English',
    'en-US'
  ]
  
  for (const preferred of preferredVoices) {
    const voice = voices.find(v => v.name.includes(preferred) || v.lang.includes(preferred))
    if (voice) return voice.voiceURI
  }
  
  // Fallback to first English voice
  const englishVoice = voices.find(v => v.lang.startsWith('en'))
  return englishVoice?.voiceURI || null
} 