# 지티(GiTi) 15일 리포트

## 개요
- 질문 로그: `giti_usage_events` (앱에서 질문 시 자동 저장)
- 리포트 메타: `giti_reports`
- Edge Function: `giti-biweekly-report` → **Google Apps Script 웹앱** → Docs 저장
- Cron: 매월 1·16일 UTC 00:00 (KST 09:00), 내부 14일 가드
- Drive 폴더: `1uKmiizsoyteFx1wqOo__YwdT3AXwe-B0`
- 파일명: `지티리포트_YYYY-MM-DD`
- 완료 푸시: `새 지티 리포트가 도착했어요!` → 슈퍼관리자

## 배포 순서

### 1) DB
SQL Editor에서 `giti_usage_and_reports.sql` 실행

### 2) Google Apps Script 웹앱
1. [script.google.com](https://script.google.com) 새 프로젝트
2. `giti_report_apps_script.gs` 내용 붙여넣기
3. (권장) `SCRIPT_SECRET` 값을 임의 문자열로 설정
4. **배포 → 새 배포 → 웹 앱**
   - 실행 계정: **나**
   - 액세스: **모든 사용자**
5. 웹앱 URL 복사 (`https://script.google.com/macros/s/.../exec`)
6. 배포 Google 계정이 폴더 `1uKmiizsoyteFx1wqOo__YwdT3AXwe-B0`에 접근 가능한지 확인

### 3) Edge secrets
```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set GITI_APPS_SCRIPT_URL='https://script.google.com/macros/s/XXXX/exec'
supabase secrets set GITI_APPS_SCRIPT_SECRET='(Apps Script SCRIPT_SECRET 과 동일)'
supabase secrets set GITI_REPORT_FOLDER_ID=1uKmiizsoyteFx1wqOo__YwdT3AXwe-B0
supabase secrets set SUPER_ADMIN_ID=<uuid>
```

> Service Account JSON은 더 이상 사용하지 않습니다.

### 4) 함수·크론
```bash
supabase functions deploy giti-biweekly-report
supabase functions deploy send-push
```
`push_cron_giti_biweekly_report.sql` 실행 (`YOUR_SERVICE_ROLE_KEY` 교체)

### 5) 테스트
슈퍼관리자 메인 → 지티 리포트 → **지금 생성**

## 수동 호출
```bash
curl -X POST "$SUPABASE_URL/functions/v1/giti-biweekly-report" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"force":true}'
```

## Apps Script 수신 payload (요약)
```json
{
  "secret": "...",
  "folderId": "1uKmiizsoyteFx1wqOo__YwdT3AXwe-B0",
  "title": "지티리포트_2026-07-27",
  "body": "...문서 본문...",
  "periodStart": "2026-07-13",
  "periodEnd": "2026-07-27",
  "summary": "...",
  "suggestions": "...",
  "stats": {}
}
```
응답: `{ "ok": true, "docId": "...", "docUrl": "https://docs.google.com/..." }`
