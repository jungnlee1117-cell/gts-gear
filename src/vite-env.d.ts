/// <reference types="vite/client" />

/** vite.config.js define — Vercel 빌드 시 VITE_VAPID_PUBLIC_KEY 주입 */
declare const __GTS_VAPID_PUBLIC_KEY__: string;

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_VAPID_PUBLIC_KEY: string;
  readonly VITE_SUPER_ADMIN_ID: string;
  readonly VITE_GOOGLE_TTS_KEY: string;
  readonly VITE_PASSWORD_CHANGE_REQUIRED: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
