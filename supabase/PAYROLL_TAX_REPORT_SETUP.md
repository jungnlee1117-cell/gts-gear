# GTS 월별 사업소득 Excel Google Drive 자동 저장 설정

## 동작

- 슈퍼관리자가 급여/정산 대시보드를 열면 해당 월 세전 지급액 스냅샷이 갱신됩니다.
- `세무 엑셀` 버튼으로 파일을 직접 내려받을 수 있습니다.
- `구글 드라이브 저장` 버튼으로 `GTS 사업소득 자동자료` 폴더에 즉시 저장합니다.
- 같은 월 파일이 이미 있으면 새 파일을 중복 생성하지 않고 기존 파일을 갱신합니다.
- 매월 1일 오전 9시(KST)에 직전 달 파일을 자동 저장할 수 있습니다.
- 주민등록번호 원문은 보고서 테이블에 저장하지 않고 파일 생성 순간에만 서버에서 복호화합니다.

## 1. SQL 실행

Supabase SQL Editor에서 아래 파일 내용을 실행합니다.

1. `supabase/payroll_tax_reports.sql`
2. `supabase/payroll_tax_report_drive_patch.sql`
3. 자동 저장 예약을 사용할 때만 `supabase/payroll_tax_report_cron.sql`

## 2. Drive 폴더와 서비스 계정 연결

Drive 폴더 ID:

```text
1oHFCb3kyj-aGksbPP5R8oE0xRQYi11iD
```

Supabase secret에 폴더 ID를 등록합니다.

```bash
npx supabase secrets set PAYROLL_DRIVE_FOLDER_ID="1oHFCb3kyj-aGksbPP5R8oE0xRQYi11iD"
```

Google Drive에서 `GTS 사업소득 자동자료` 폴더를 `GOOGLE_SERVICE_ACCOUNT_JSON`의
`client_email` 주소에 편집자 권한으로 공유해야 합니다. 암호화 키나 private key는 Drive에 입력하지 않습니다.

## 3. Edge Function 배포

```bash
npx supabase functions deploy payroll-tax-report --no-verify-jwt
```

게이트웨이 JWT 검증은 끄지만, 함수 내부에서 로그인 사용자와 superadmin 역할을 다시 검증합니다.
자동 저장 요청은 service role key만 허용합니다.

## 4. 확인

1. 슈퍼관리자로 `급여/정산` 화면을 엽니다.
2. 조회 월을 선택합니다.
3. `구글 드라이브 저장`을 누릅니다.
4. Drive의 `GTS 사업소득 자동자료` 폴더에서 파일을 확인합니다.
5. 같은 버튼을 다시 눌러 중복 파일이 생기지 않고 기존 파일이 갱신되는지 확인합니다.

자동 작업 확인:

```sql
SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname = 'gts-monthly-payroll-tax-report';
```

저장 이력은 `payroll_tax_report_drive_uploads`에서 확인할 수 있습니다.
