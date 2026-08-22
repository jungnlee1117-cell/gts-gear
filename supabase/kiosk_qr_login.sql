-- GTS 키오스크 QR 로그인 연결 세션
-- Supabase SQL Editor에서 한 번 실행하세요.

create table if not exists public.kiosk_pairing_sessions (
  id uuid primary key default gen_random_uuid(),
  secret_hash text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'consumed', 'expired', 'cancelled')),
  teacher_id uuid references public.teachers(id) on delete set null,
  expires_at timestamptz not null,
  approved_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists kiosk_pairing_sessions_expires_at_idx
  on public.kiosk_pairing_sessions (expires_at);

alter table public.kiosk_pairing_sessions enable row level security;

-- 브라우저는 테이블에 직접 접근하지 않습니다.
-- 모든 생성·승인·확인은 kiosk Edge Function(service role)을 통해 처리합니다.
revoke all on table public.kiosk_pairing_sessions from anon, authenticated;

