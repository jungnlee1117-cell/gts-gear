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
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` 는 Supabase가 자동 주입합니다.

## 4. 클라이언트 `.env`

```
VITE_VAPID_PUBLIC_KEY=(public key)
```

## 알림 종류

| 이벤트 | 수신자 |
|--------|--------|
| 대여 승인/거절 | 해당 선생님 |
| 수업 변동 | 해당 선생님 + 스케줄 관리자 |
| 대여 신청 | 교구 관리자 (superadmin / is_item_admin) |
| 반납 신청 | 교구 관리자 |

## iOS

홈 화면에 PWA를 추가한 뒤 알림을 허용해야 합니다 (iOS 16.4+).
