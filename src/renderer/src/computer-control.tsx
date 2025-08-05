import './assets/main.css'

import React from 'react'
import { createRoot } from 'react-dom/client'
import { ComputerControl } from './components/ComputerControl'

const App = () => {
  return (
    <div style={{ padding: '20px' }}>
      <ComputerControl />
    </div>
  )
}

const container = document.getElementById('app')
const root = createRoot(container!)
root.render(<App />)