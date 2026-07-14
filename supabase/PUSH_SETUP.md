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

# verify_jwt=false — supabase/config.toml (재배포 필수)
supabase functions deploy send-push
supabase functions deploy vapid-public-key
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

| 이벤트 | 수신자 | 트리거 |
|--------|--------|--------|
| 대여 승인/거절 | 해당 선생님 | 관리자 승인/거절 |
| 수업 변동 | 해당 선생님 + 스케줄 관리자 | 수업 변동 저장 |
| 대여 신청 | 교구 관리자 | 선생님 대여 신청 |
| 반납 신청 | 교구 관리자 | 선생님 반납 |
| **반납 D-1** | 해당 선생님 | pg_cron 매일 KST 08:00 |
| **공지사항** | 전체 활성 선생님 | 관리자 공지 등록 |
| **행사 일정** | 해당 원 담당 강사 | 관리자 행사 등록 |
| **상담 신청** | 슈퍼관리자 | 상담 신청 폼 제출 |

### `consultation_requested` payload

```json
{
  "event": "consultation_requested",
  "payload": {
    "name": "홍길동",
    "program": "유치부 성장 프로그램",
    "brand": "gts"
  }
}
```

- `brand`: `"gts"` (기본) 또는 `"elitecore"` / `"엘리트코어"`
- 알림 본문: `[이름]님이 [프로그램] 상담을 신청했습니다 (GTS)` 또는 `(엘리트코어)`
- **Google Apps Script:** 인증 **불필요** (`verify_jwt=false` + 함수 내부 공개 처리)
- **앱 내:** 로그인 세션으로 `sendPushEvent(supabase, "consultation_requested", { name, program, brand })`

#### Google Apps Script에서 호출

Supabase 게이트웨이는 `apikey` 헤더(anon key)만 필요합니다. `Authorization`은 **없어도 됩니다.**

```javascript
function notifyConsultationPush(name, program, brand) {
  const url = "https://YOUR_PROJECT.supabase.co/functions/v1/send-push";
  const anonKey = PropertiesService.getScriptProperties().getProperty("SUPABASE_ANON_KEY");

  const res = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    muteHttpExceptions: true,
    headers: {
      apikey: anonKey,
    },
    payload: JSON.stringify({
      event: "consultation_requested",
      payload: { name: name, program: program, brand: brand || "gts" },
    }),
  });

  Logger.log(res.getResponseCode() + " " + res.getContentText());
}
```

배포 확인 (Dashboard → Edge Functions → send-push → **Enforce JWT Verification = OFF**):

```bash
supabase functions deploy send-push
```

`401 Unauthorized`가 계속되면 **재배포 전** 설정이 반영되지 않은 것입니다.

## 5. 반납 D-1 자동 알림 (pg_cron)

SQL Editor에서 실행 (프로젝트 URL·Service Role Key 교체):

```
supabase/push_cron_return_due.sql
```

- 매일 **UTC 23:00** (= KST **08:00**) `send-push` 호출
- 내일(`due_date`) 반납 예정 교구 → 선생님별 푸시
- 메시지: `내일까지 [교구명] 반납 기한입니다. 잊지 마세요!`

Dashboard → Database → Extensions에서 **pg_cron**, **pg_net** 활성화 필요.

## 6. 할 일 당일 마감 알림 (pg_cron)

SQL Editor에서 실행 (Service Role Key 교체):

```
supabase/push_cron_todo_due_today.sql
```

- 매일 **UTC 23:30** (= KST **08:30**) `send-push` 호출 (`todo_due_today`)
- 오늘(`due_date`) 마감 · 미완료 할 일 → 담당자 + 슈퍼관리자 푸시
- 담당자 미지정(전체)이면 관리자 전체 + 슈퍼관리자
- 메시지: `오늘 마감: [할 일 제목]`

## 문제 해결

- 콘솔 `[push] send-push: 전송 0건 — 수신자 push 구독 없음` → **관리자 계정**으로 앱에 로그인 후「알림 허용」필수
- `push_subscriptions` 테이블이 비어 있으면 푸시가 가지 않음 (Supabase SQL Editor에서 확인)
- Edge Function VAPID 시크릿이 placeholder면 전송 실패 — `supabase secrets set`으로 실제 키 재설정

## iOS

홈 화면에 PWA를 추가한 뒤 알림을 허용해야 합니다 (iOS 16.4+).
