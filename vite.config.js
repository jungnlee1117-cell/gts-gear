import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const THEME_COLOR = '#16a34a'
const APP_BG = '#f8fafc'
const KIOSK_MANIFEST = '/kiosk.webmanifest'

function rewriteKioskHtmlFile(filePath) {
  if (!fs.existsSync(filePath)) return false
  let html = fs.readFileSync(filePath, 'utf8')
  html = html.replace(/<link[^>]*rel=["']manifest["'][^>]*>\s*/gi, '')
  if (!/rel=["']manifest["']/.test(html)) {
    html = html.replace(
      /<\/head>/i,
      `    <link rel="manifest" href="${KIOSK_MANIFEST}" />\n  </head>`,
    )
  }
  html = html
    .replace(/content="GTS 시스템"/g, 'content="GTS 키오스크"')
    .replace(/<title>GTS 시스템<\/title>/g, '<title>GTS 키오스크</title>')
  fs.writeFileSync(filePath, html)
  return true
}

/** iOS A2HS는 정적 <link rel="manifest">의 start_url을 사용. kiosk.html에 메인 manifest가 남으면 / 로 열림. */
function kioskHtmlManifestPlugin() {
  return {
    name: 'kiosk-html-manifest',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const file = String(ctx.filename || ctx.path || '')
        const isKiosk = file.endsWith('kiosk.html') || file.includes(`${path.sep}kiosk.html`)
        if (!isKiosk) return html

        let next = html.replace(/<link[^>]*rel=["']manifest["'][^>]*>/gi, '')
        if (!next.includes('rel="manifest"') && !next.includes("rel='manifest'")) {
          next = next.replace(
            /<\/head>/i,
            `    <link rel="manifest" href="${KIOSK_MANIFEST}" />\n  </head>`,
          )
        }
        return next
          .replace(/content="GTS 시스템"/g, 'content="GTS 키오스크"')
          .replace(/<title>GTS 시스템<\/title>/g, '<title>GTS 키오스크</title>')
      },
    },
    closeBundle() {
      // VitePWA가 transformIndexHtml 이후에 메인 manifest를 다시 넣으므로 파일로 최종 교정
      rewriteKioskHtmlFile(path.resolve(__dirname, 'dist/kiosk.html'))
    },
  }
}

function kioskDevRewritePlugin() {
  return {
    name: 'kiosk-dev-rewrite',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url || ''
        if (url === '/kiosk' || url.startsWith('/kiosk?')) {
          req.url = `/kiosk.html${url.slice('/kiosk'.length)}`
        }
        next()
      })
    },
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const file = String(ctx.filename || ctx.path || '')
        const isKiosk = file.endsWith('kiosk.html') || file.includes(`${path.sep}kiosk.html`)
        if (!isKiosk) return html
        let next = html.replace(/<link[^>]*rel=["']manifest["'][^>]*>/gi, '')
        if (!next.includes('rel="manifest"') && !next.includes("rel='manifest'")) {
          next = next.replace(
            /<\/head>/i,
            `    <link rel="manifest" href="${KIOSK_MANIFEST}" />\n  </head>`,
          )
        }
        return next
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Vercel 빌드: process.env.VITE_* 를 loadEnv가 읽음 (.env + CI env)
  const env = loadEnv(mode, process.cwd(), '')
  const vapidPublicKey =
    env.VITE_VAPID_PUBLIC_KEY
    || process.env.VITE_VAPID_PUBLIC_KEY
    || ''
  const anthropicApiKey =
    env.VITE_ANTHROPIC_API_KEY
    || process.env.VITE_ANTHROPIC_API_KEY
    || ''

  return {
    define: {
      // import.meta.env 치환 누락 시에도 빌드 타임 키 주입
      __GTS_VAPID_PUBLIC_KEY__: JSON.stringify(vapidPublicKey),
      'import.meta.env.VITE_ANTHROPIC_API_KEY': JSON.stringify(anthropicApiKey),
    },
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          kiosk: path.resolve(__dirname, 'kiosk.html'),
        },
      },
    },
    plugins: [
      react(),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.js',
        registerType: 'autoUpdate',
        injectRegister: null,
        includeAssets: ['pwa-192x192.png', 'pwa-512x512.png', 'apple-touch-icon.png', 'favicon.svg', 'kiosk.webmanifest'],
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
          // 메인 번들이 기본 한도(2 MiB)를 넘어 프리캐시에서 빠지는 것 방지
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        },
        // iOS Safari에서 개발용 SW가 모듈 로딩을 가로채 흰 화면을 만드는 경우가 많음
        devOptions: {
          enabled: false,
        },
      }),
      kioskHtmlManifestPlugin(),
      kioskDevRewritePlugin(),
    ],
    optimizeDeps: {
      include: ['qrcode.react', '@supabase/supabase-js'],
    },
  }
})
