/** 한국(Asia/Seoul) 달력 날짜 유틸 — date 컬럼(YYYY-MM-DD) D-day·표시용 */

const KST = "Asia/Seoul";

/** @returns {string} YYYY-MM-DD (KST) */
export function kstTodayYmd(from = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: KST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(from);
}

/** @returns {{ y: number, m: number, d: number, ymd: string } | null} */
export function parseDateOnly(value) {
  if (value == null || value === "") return null;
  const s = String(value).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d, ymd: s };
}

/** date input / DB date 컬럼에 넣을 YYYY-MM-DD (이미 날짜면 그대로) */
export function toKstDateOnly(value) {
  if (value == null || value === "") return null;
  const parsed = parseDateOnly(value);
  if (parsed) return parsed.ymd;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return kstTodayYmd(dt);
}

/** due(YYYY-MM-DD) − 오늘(KST) 일수. 0=당일, 양수=남음, 음수=지남 */
export function ddayKst(due) {
  const dueParts = parseDateOnly(due);
  if (!dueParts) return null;
  const today = parseDateOnly(kstTodayYmd());
  if (!today) return null;
  const dueUtc = Date.UTC(dueParts.y, dueParts.m - 1, dueParts.d);
  const todayUtc = Date.UTC(today.y, today.m - 1, today.d);
  return Math.round((dueUtc - todayUtc) / 86_400_000);
}

/**
 * due − asOf 일수 (KST 달력).
 * asOf: Date | ISO | YYYY-MM-DD. 생략 시 오늘.
 * 음수 = asOf 기준 연체 일수 (절대값이 연체일수)
 */
export function ddayKstAsOf(due, asOf) {
  const dueParts = parseDateOnly(due);
  if (!dueParts) return null;
  const asOfYmd = asOf == null ? kstTodayYmd() : toKstDateOnly(asOf);
  const asOfParts = parseDateOnly(asOfYmd);
  if (!asOfParts) return null;
  const dueUtc = Date.UTC(dueParts.y, dueParts.m - 1, dueParts.d);
  const asOfUtc = Date.UTC(asOfParts.y, asOfParts.m - 1, asOfParts.d);
  return Math.round((dueUtc - asOfUtc) / 86_400_000);
}

export function formatYmdWeekday(value) {
  const parts = parseDateOnly(value);
  if (parts) {
    const days = ["일", "월", "화", "수", "목", "금", "토"];
    const dow = new Date(Date.UTC(parts.y, parts.m - 1, parts.d)).getUTCDay();
    const m = String(parts.m).padStart(2, "0");
    const d = String(parts.d).padStart(2, "0");
    return `${parts.y}.${m}.${d} (${days[dow]})`;
  }
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: KST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).format(dt);
}

export function formatYmdShort(value) {
  const parts = parseDateOnly(value);
  if (parts) return `${parts.m}/${parts.d}`;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "-";
  const ymd = kstTodayYmd(dt);
  const p = parseDateOnly(ymd);
  return p ? `${p.m}/${p.d}` : "-";
}
