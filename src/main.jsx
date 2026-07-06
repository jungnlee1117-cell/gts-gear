import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import './peMedia/pe-audio-library.css'
import App from './App.jsx'
import { preloadVapidPublicKey } from './pushNotifications.js'

if ('serviceWorker' in navigator) {
  registerSW({ immediate: true })
}

preloadVapidPublicKey()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
