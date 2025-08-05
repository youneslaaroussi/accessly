import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

// Custom scrollbar styles
const scrollbarStyles = `
  /* Webkit browsers (Chrome, Safari, Edge) */
  ::-webkit-scrollbar {
    width: 4px;
    height: 4px;
  }

  ::-webkit-scrollbar-track {
    background: rgba(17, 24, 39, 0.3);
    border-radius: 2px;
  }

  ::-webkit-scrollbar-thumb {
    background: rgba(107, 114, 128, 0.5);
    border-radius: 2px;
    transition: background 0.2s ease;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: rgba(156, 163, 175, 0.7);
  }

  ::-webkit-scrollbar-corner {
    background: rgba(17, 24, 39, 0.3);
  }

  /* Firefox */
  * {
    scrollbar-width: thin;
    scrollbar-color: rgba(107, 114, 128, 0.5) rgba(17, 24, 39, 0.3);
  }
`;

// Inject styles into the document
const styleElement = document.createElement('style');
styleElement.textContent = scrollbarStyles;
document.head.appendChild(styleElement);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
