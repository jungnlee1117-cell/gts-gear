# Web Push (푸시 알림) 설정

## 1. VAPID 키 생성

```bash
npx web-push generate-vapid-keys
```

- **Public Key** → `.env` 의 `VITE_VAPID_PUBLIC_KEY`
- **Private Key** → Supabase Edge Function 시크릿 `VAPID_PRIVATE_KEY`

## 2. Supabase SQL

SQL Editor에서 실행:

```
supabase/push_subscriptions.sql
```

## 3. Edge Function 배포

```bash
supabase secrets set VAPID_PUBLIC_KEY="(public key)"
supabase secrets set VAPID_PRIVATE_KEY="(private key)"
supabase secrets set VAPID_SUBJECT="mailto:admin@gts.kr"

supabase functions deploy send-push
supabase functions deploy vapid-public-key --no-verify-jwt
```

`vapid-public-key`는 공개키만 반환합니다 (JWT 검증 불필요). `send-push`와 동일한 `VAPID_PUBLIC_KEY` 시크릿을 사용합니다.

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` 는 Supabase가 자동 주입합니다.

## 4. 클라언트 `.env` / Vercel

```
VITE_VAPID_PUBLIC_KEY=(public key)
```

**Vercel:** Project → Settings → Environment Variables → `VITE_VAPID_PUBLIC_KEY` 추가 후 **Redeploy** 필수  
(Vite는 `VITE_` 변수를 **빌드 시** 번들에 포함합니다)

런타임 폴백: `/api/push/vapid-public-key` (빌드에 키가 없어도 Vercel env에서 읽음)

## 알림 종류

| 이벤트 | 수신자 |
|--------|--------|
| 대여 승인/거절 | 해당 선생님 |
| 수업 변동 | 해당 선생님 + 스케줄 관리자 |
| 대여 신청 | 교구 관리자 (superadmin / is_item_admin) |
| 반납 신청 | 교구 관리자 |

## 문제 해결

- 콘솔 `[push] send-push: 전송 0건 — 수신자 push 구독 없음` → **관리자 계정**으로 앱에 로그인 후「알림 허용」필수
- `push_subscriptions` 테이블이 비어 있으면 푸시가 가지 않음 (Supabase SQL Editor에서 확인)
- Edge Function VAPID 시크릿이 placeholder면 전송 실패 — `supabase secrets set`으로 실제 키 재설정

## iOS

홈 화면에 PWA를 추가한 뒤 알림을 허용해야 합니다 (iOS 16.4+).
