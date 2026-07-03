import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const THEME_COLOR = '#16a34a'
const APP_BG = '#f8fafc'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Vercel 빌드: process.env.VITE_* 를 loadEnv가 읽음 (.env + CI env)
  const env = loadEnv(mode, process.cwd(), '')
  const vapidPublicKey =
    env.VITE_VAPID_PUBLIC_KEY
    || process.env.VITE_VAPID_PUBLIC_KEY
    || ''

  return {
    define: {
      // import.meta.env 치환 누락 시에도 빌드 타임 키 주입
      __GTS_VAPID_PUBLIC_KEY__: JSON.stringify(vapidPublicKey),
    },
    plugins: [
      react(),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.js',
        registerType: 'autoUpdate',
        injectRegister: null,
        includeAssets: ['pwa-192x192.png', 'pwa-512x512.png', 'apple-touch-icon.png', 'favicon.svg'],
        manifest: {
          name: 'GTS 시스템',
          short_name: 'GTS',
          description: 'GTS 통합 플랫폼 — 교구, 스케줄, 영상자료실',
          theme_color: THEME_COLOR,
          background_color: APP_BG,
          display: 'standalone',
          orientation: 'portrait',
          scope: '/',
          start_url: '/',
          lang: 'ko',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webp,json}'],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    optimizeDeps: {
      include: ['qrcode.react', '@supabase/supabase-js'],
    },
  }
})
