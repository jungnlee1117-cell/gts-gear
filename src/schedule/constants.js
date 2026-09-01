export const PAY_TYPES = ["정규", "방과후", "어린이집", "가정방문", "센터", "센터보조", "참관수업"];
/** 급여 요약 집계·표시 순서 */
export const PAYROLL_SUMMARY_TYPES = ["정규", "방과후", "어린이집", "가정방문", "센터", "센터보조", "참관수업"];
export const CLASS_TYPES = ["정규", "방과후", "어린이집", "센터보조", "참관수업"];

/** 화면에서는 기존 내부값 「센터보조」를 간결하게 「보조」로 표시 */
export function classTypeLabel(classType) {
  return classType === "센터보조" ? "보조" : classType;
}

const DAYCARE_INSTITUTION_NAME_KEYS = ["어린이집", "유치원"];

/** 기관명에 어린이집·유치원이 포함되면 급여 요약의 「어린이집」 항목으로 집계 */
export function isDaycareInstitution(institutionOrName) {
  const name = typeof institutionOrName === "string"
    ? institutionOrName
    : institutionOrName?.name;
  const n = String(name || "").trim();
  if (!n) return false;
  return DAYCARE_INSTITUTION_NAME_KEYS.some(k => n.includes(k));
}

/**
 * 어린이집/유치원 기관 수업 → 「어린이집」 (정규·방과후 등 pay_type 무관)
 * 그 외는 DB pay_type 그대로. 단가 계산은 pay_type을 그대로 씀.
 */
export function resolvePayrollSummaryType(entry) {
  if (isDaycareInstitution(entry?.institutions || entry?.institution_name)) {
    return "어린이집";
  }
  return entry?.pay_type || "";
}

export const CONTRACT_TYPES = {
  gts_official: "GTS 공식",
  manager_personal: "관리자 개인",
  manager_fixed_payout: "고정지급 (GTS 전액)",
  manager_threshold_split: "100만 기준 분배",
  partner_billing: "파트너 과금",
};
export const BILLING_TYPES = {
  monthly_fixed: "월 고정",
  per_session: "회당 과금",
  per_capita: "인당 과금",
  manual: "수동 입력",
};
export const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
export const EXCEPTION_LABELS = {
  cancelled: "휴원",
  event: "행사",
  time_change: "시간변경",
};

export const SCHEDULE_MENU = [
  { id: "institution-schedule", title: "선생님 시간표", desc: "주간·월간 수업 일정", icon: "building", color: "#8b5cf6", roles: "all" },
  { id: "home-visit", title: "선생님 방문수업 일정", desc: "매주 반복 방문수업 등록·조회", icon: "user", color: "#6366f1", roles: "all" },
  { id: "events", title: "행사 일정", desc: "전체 원 행사·휴원 안내", icon: "party", color: "#ec4899", roles: "all" },
  { id: "change-alerts", title: "수업등록/변경", desc: "강사 스케줄 변경 알림 · 확인", icon: "bell", color: "#ef4444", roles: "admin" },
  { id: "payroll", title: "급여/정산", desc: "수업시간 입력 · 급여 확인", icon: "wallet", color: "#22c55e", roles: "all" },
  { id: "institutions", title: "원 관리", desc: "원 마스터 · 시간표 · 계약", icon: "settings", color: "#f97316", roles: "admin" },
];

export function yearMonthKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** YYYY-MM 또는 YYYY-MM-DD → 해당 월 1일(YYYY-MM-01) */
export function yearMonthFirstDay(key) {
  const prefix = String(key || "").slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(prefix)) return `${key}-01`;
  return `${prefix}-01`;
}

/** YYYY-MM 해당 월 마지막 날 (로컬 타임존 — toISOString 사용 금지) */
export function yearMonthLastDay(key) {
  const prefix = String(key || "").slice(0, 7);
  const [y, m] = prefix.split("-").map(Number);
  return fmtLocalDate(new Date(y, m, 0));
}

export function formatWon(n) {
  return `${Math.round(n || 0).toLocaleString("ko-KR")}원`;
}

/** 사업소득세 3.3% 원천징수 후 예상 실수령액 */
export function grossToNetPay(gross) {
  return Math.round(Number(gross || 0) * 0.967);
}

export function formatMinutes(m) {
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h && min) return `${h}시간 ${min}분`;
  if (h) return `${h}시간`;
  return `${min}분`;
}

export function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesBetween(start, end) {
  return Math.max(0, timeToMinutes(end) - timeToMinutes(start));
}

/** 시간 구간 겹침 여부 (끝=시작이면 비겹침) */
export function timesOverlap(startA, endA, startB, endB) {
  const a0 = timeToMinutes(startA);
  const a1 = timeToMinutes(endA);
  const b0 = timeToMinutes(startB);
  const b1 = timeToMinutes(endB);
  if (!a0 && !a1) return false;
  if (!b0 && !b1) return false;
  if (a1 <= a0 || b1 <= b0) return false;
  return a0 < b1 && b0 < a1;
}

/** institution_weekly_schedule → payroll pay_type (label에 센터/센터보조 표기 가능) */
export function resolveInstitutionSlotPayType(slot) {
  const label = String(slot?.label ?? "").trim();
  if (label.startsWith("센터보조")) return "센터보조";
  if (label.startsWith("센터")) return "센터";
  return slot?.class_type;
}

/** 급여·집계용 분 — 보조 수업도 등록된 실제 시작·종료 시간으로 계산 */
export function resolveInstitutionSlotBillableMinutes(slot) {
  return minutesBetween(slot.start_time, slot.end_time);
}

export function compareByStartTime(a, b) {
  const diff = timeToMinutes(a.start_time) - timeToMinutes(b.start_time);
  if (diff !== 0) return diff;
  return timeToMinutes(a.end_time) - timeToMinutes(b.end_time);
}

export function sortSlotsByTime(slots) {
  return [...slots].sort(compareByStartTime);
}

const INSTITUTION_DOT_COLORS = [
  "#7c3aed", "#2563eb", "#059669", "#d97706", "#db2777",
  "#0891b2", "#4f46e5", "#ca8a04", "#dc2626", "#0d9488",
  "#9333ea", "#ea580c", "#0284c7", "#65a30d", "#c026d3",
];

export function institutionColor(institutionId) {
  if (!institutionId) return "#94a3b8";
  let hash = 0;
  for (let i = 0; i < institutionId.length; i++) {
    hash = (hash * 31 + institutionId.charCodeAt(i)) | 0;
  }
  return INSTITUTION_DOT_COLORS[Math.abs(hash) % INSTITUTION_DOT_COLORS.length];
}

const HOME_VISIT_DOT_COLORS = ["#0d9488", "#14b8a6", "#059669", "#047857", "#0f766e"];

/** 가정방문 캘린더 점 색 (원 색과 구분되는 teal 계열) */
export function homeVisitColor(patternId) {
  if (!patternId) return HOME_VISIT_DOT_COLORS[0];
  let hash = 0;
  for (let i = 0; i < patternId.length; i++) {
    hash = (hash * 31 + patternId.charCodeAt(i)) | 0;
  }
  return HOME_VISIT_DOT_COLORS[Math.abs(hash) % HOME_VISIT_DOT_COLORS.length];
}

export function isHomeVisitPlanned(planned) {
  return planned?.source === "home_visit" || Boolean(planned?.patternId);
}

export function fmtLocalDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

/** 월간 캘린더 그리드 (일~토 7열, 앞뒤 달 패딩 포함) */
export function getMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0).getDate();
  const startPad = first.getDay();
  const cells = [];

  for (let i = startPad - 1; i >= 0; i--) {
    cells.push({ date: new Date(year, month, -i), inMonth: false });
  }
  for (let d = 1; d <= lastDay; d++) {
    cells.push({ date: new Date(year, month, d), inMonth: true });
  }
  let next = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ date: new Date(year, month + 1, next++), inMonth: false });
  }
  while (cells.length < 42) {
    cells.push({ date: new Date(year, month + 1, next++), inMonth: false });
  }
  return cells;
}
