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

// 알림을 눌러 앱이 열렸는데 첫 화면으로만 온 경우, 알림이 가리키는 화면으로 이동한다.
async function consumePendingNav() {
  try {
    if (!('caches' in window)) return
    const cache = await caches.open('gts-pending-nav')
    const hit = await cache.match('/__pending-nav')
    if (!hit) return
    await cache.delete('/__pending-nav')
    const { url, at } = await hit.json()
    if (!url || Date.now() - Number(at || 0) > 2 * 60 * 1000) return
    const next = new URL(url, window.location.origin)
    if (next.origin !== window.location.origin) return
    const target = next.pathname + next.search + next.hash
    const current = window.location.pathname + window.location.search + window.location.hash
    if (target !== current) window.location.replace(target)
  } catch {
    // ignore
  }
}

consumePendingNav()
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') consumePendingNav()
})

preloadVapidPublicKey()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
