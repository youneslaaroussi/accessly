import { useEffect, useState } from 'react';
import { useConfigurationStore } from '../../core/state/useConfigurationStore';

export const MicrophoneSelection = () => {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const { microphoneDeviceId, setMicrophoneDeviceId } = useConfigurationStore();

  useEffect(() => {
    let stream: MediaStream | null = null;
    const getDevices = async () => {
      try {
        setLoading(true);
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const audioInputDevices = allDevices.filter(device => device.kind === 'audioinput');
        setDevices(audioInputDevices);
        if (!microphoneDeviceId && audioInputDevices.length > 0) {
          setMicrophoneDeviceId(audioInputDevices[0].deviceId);
        }
      } catch (error) {
        console.error("Could not get microphone permissions.", error);
        setDevices([]);
      } finally {
        setLoading(false);
      }
    };

    getDevices();

    return () => {
        if (stream) {
            stream.getTracks().forEach((track) => track.stop());
        }
    }
  }, [microphoneDeviceId, setMicrophoneDeviceId]);

  const handleDeviceChange = (value: string) => {
    setMicrophoneDeviceId(value);
  };

  if (loading) {
    return (
      <div className="bg-gray-800/50 text-gray-400 border border-gray-600/50 rounded text-xs px-2 py-1">
        Loading...
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="bg-red-900/20 text-red-400 border border-red-600/50 rounded text-xs px-2 py-1">
        No microphones found
      </div>
    );
  }

  return (
    <select 
      className="bg-gray-800/50 text-white border border-gray-600/50 rounded text-xs px-2 py-1 w-full focus:border-gray-500 focus:outline-none"
      onChange={(e) => handleDeviceChange(e.target.value)} 
      value={microphoneDeviceId || ''}
    >
      <option value="">Select microphone</option>
      {devices.map((device) => {
        const label = device.label || `Microphone ${device.deviceId.slice(0, 8)}`;
        const truncatedLabel = label.length > 20 ? label.substring(0, 20) + '...' : label;
        return (
          <option key={device.deviceId} value={device.deviceId}>
            {truncatedLabel}
          </option>
        );
      })}
    </select>
  );
}; 