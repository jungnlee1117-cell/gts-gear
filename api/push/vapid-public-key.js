/**
 * Vercel 런타임 VAPID 공개키 (빌드 시 VITE_ 변수 누락 시 폴백)
 * Vercel Dashboard → Environment Variables:
 *   VITE_VAPID_PUBLIC_KEY 또는 VAPID_PUBLIC_KEY
 */
export default function handler(_req, res) {
  const publicKey =
    process.env.VITE_VAPID_PUBLIC_KEY
    || process.env.VAPID_PUBLIC_KEY
    || "";

  res.setHeader("Cache-Control", "public, max-age=3600");
  res.status(200).json({
    publicKey,
    configured: Boolean(publicKey),
  });
}
