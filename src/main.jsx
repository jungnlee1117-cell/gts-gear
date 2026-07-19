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
  navigator.serviceWorker.addEventListener('message', (event) => {
    const data = event?.data
    if (data?.type === 'GTS_NAVIGATE' && typeof data.url === 'string' && data.url) {
      try {
        const next = new URL(data.url, window.location.origin)
        if (next.origin === window.location.origin) {
          window.location.assign(next.pathname + next.search + next.hash)
        }
      } catch {
        // ignore
      }
    }
  })
}

preloadVapidPublicKey()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
