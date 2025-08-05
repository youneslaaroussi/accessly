import React, { useState, forwardRef } from 'react';
import { Send } from 'lucide-react';

interface TextInputProps {
  onSendMessage: (message: string) => void;
  disabled: boolean;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(({ onSendMessage, disabled }, ref) => {
  const [message, setMessage] = useState('');

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  return (
    <div className="flex items-center space-x-3">
      <input
        ref={ref}
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder="Type your message..."
        disabled={disabled}
        className="flex-1 h-10 px-3 bg-transparent text-white placeholder-gray-400 border-none outline-none focus:outline-none focus:ring-0"
        style={{ 
          border: 'none',
          boxShadow: 'none',
          background: 'rgba(255, 255, 255, 0.05)',
        }}
      />
      {!disabled && (
        <button
          onClick={handleSend}
          disabled={!message.trim()}
          className="h-10 px-4 bg-transparent text-white border-none outline-none hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ 
            border: 'none',
            boxShadow: 'none',
            background: 'rgba(255, 255, 255, 0.05)',
          }}
        >
          <Send className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}); 