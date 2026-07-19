/* eslint-disable no-restricted-globals */
// iOS 16.4+ PWA: push 핸들러는 SW 로드 시 동기 등록 (importScripts 분리 시 iOS에서 누락될 수 있음)
import { clientsClaim } from 'workbox-core'
import { ExpirationPlugin } from 'workbox-expiration'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { NetworkFirst } from 'workbox-strategies'

self.addEventListener('push', (event) => {
  event.waitUntil(handlePushEvent(event))
})

self.addEventListener('notificationclick', (event) => {
  event.waitUntil(handleNotificationClick(event))
})

async function handlePushEvent(event) {
  const defaults = { title: 'GTS 알림', body: '', url: '/' }
  let data = { ...defaults }

  try {
    if (event.data) {
      try {
        const parsed = event.data.json()
        if (parsed && typeof parsed === 'object') {
          data = { ...defaults, ...parsed }
        }
      } catch {
        const text = event.data.text()
        if (text) {
          try {
            data = { ...defaults, ...JSON.parse(text) }
          } catch {
            data.body = text
          }
        }
      }
    }
  } catch {
    // defaults 유지
  }

  const title = String(data.title || defaults.title)
  const body = String(data.body || defaults.body)
  const url = String(data.url || defaults.url)

  // iOS Safari: renotify·requireInteraction 등 미지원 옵션은 showNotification 실패 원인
  const options = {
    body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: data.event ? `gts-${String(data.event)}` : 'gts-notification',
    data: { url },
  }

  try {
    await self.registration.showNotification(title, options)
  } catch {
    try {
      await self.registration.showNotification(title, { body, data: { url } })
    } catch {
      await self.registration.showNotification(title, { body })
    }
  }
}

async function handleNotificationClick(event) {
  event.notification.close()

  const rawUrl = event.notification.data?.url || '/'
  let targetUrl
  try {
    targetUrl = new URL(rawUrl, self.location.origin).href
  } catch {
    targetUrl = `${self.location.origin}/`
  }

  const windowClients = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  })

  for (const client of windowClients) {
    if ('focus' in client) {
      await client.focus()
      if (typeof client.navigate === 'function') {
        try {
          await client.navigate(targetUrl)
          return
        } catch {
          // navigate 미지원/실패 시 postMessage로 폴백
        }
      }
      try {
        client.postMessage({ type: 'GTS_NAVIGATE', url: targetUrl })
      } catch {
        // ignore
      }
      return
    }
  }

  if (self.clients.openWindow) {
    await self.clients.openWindow(targetUrl)
  }
}

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

self.skipWaiting()
clientsClaim()

registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), {
    denylist: [/^\/api/],
  }),
)

registerRoute(
  /^https:\/\/.*\.supabase\.co\/.*/i,
  new NetworkFirst({
    cacheName: 'supabase-api',
    networkTimeoutSeconds: 10,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 60 * 24,
      }),
    ],
  }),
  'GET',
)
