/**
 * GTS 교육용역 위탁 계약서 템플릿.
 * 첨부 표준 계약서 제1조~제13조를 유지하고, 선생님별로 달라지는 값만 치환한다.
 */

export const COMPANY_NAME = "지티에스";
export const COMPANY_CEO = "정형신";

export const RATE_UNIT_CODES = {
  hour: { label: "시간", phrase: "시간당" },
  session: { label: "회", phrase: "회당" },
  day: { label: "일", phrase: "일" },
  month: { label: "월", phrase: "월" },
  item: { label: "건", phrase: "건당" },
};

export const RATE_UNITS = Object.keys(RATE_UNIT_CODES);

export const RATE_PRESETS = [
  { rate_type: "regular", rate_name: "정규수업", unit: "hour", core: true },
  { rate_type: "after_school", rate_name: "방과후수업", unit: "hour", core: true },
  { rate_type: "event", rate_name: "행사수업", unit: "session" },
  { rate_type: "private", rate_name: "개인레슨", unit: "session" },
  { rate_type: "center", rate_name: "센터수업", unit: "hour" },
  { rate_type: "assistant", rate_name: "보조수업", unit: "hour" },
  { rate_type: "transportation", rate_name: "교통비", unit: "day" },
  { rate_type: "custom", rate_name: "기타", unit: "item", customName: true },
];

export const RATE_TYPE_SET = new Set(RATE_PRESETS.map((p) => p.rate_type));

export function defaultCoreRates() {
  return RATE_PRESETS.filter((p) => p.core).map((p) => ({
    rate_type: p.rate_type,
    rate_name: p.rate_name,
    amount: "",
    unit: p.unit,
  }));
}

export function toUnitCode(unit) {
  const raw = String(unit || "").trim();
  if (RATE_UNIT_CODES[raw]) return raw;
  const found = Object.entries(RATE_UNIT_CODES).find(([, meta]) => meta.label === raw);
  return found ? found[0] : "";
}

export function unitLabel(unit) {
  return RATE_UNIT_CODES[toUnitCode(unit)]?.label || unit || "";
}

export function unitPhrase(unit) {
  return RATE_UNIT_CODES[toUnitCode(unit)]?.phrase || unit || "";
}

export function formatWon(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "0";
  return Math.round(n).toLocaleString("ko-KR");
}

export function formatYmd(value) {
  const raw = String(value || "").slice(0, 10);
  const [y, m, d] = raw.split("-");
  if (!y || !m || !d) return raw || "미정";
  return `${y}년 ${Number(m)}월 ${Number(d)}일`;
}

export function formatDotDate(value) {
  const raw = String(value || "").slice(0, 10);
  const [y, m, d] = raw.split("-");
  if (!y || !m || !d) return raw || "—";
  return `${y}.${m}.${d}`;
}

export function formatResidentFront(front) {
  const d = String(front || "").replace(/\D/g, "").slice(0, 6);
  if (d.length !== 6) return "미등록";
  return `${d}-*******`;
}

export function formatRateLine(rate) {
  return `${rate.rate_name}: ${unitPhrase(rate.unit)} ${formatWon(rate.amount)}원`;
}

export function parseAmount(raw) {
  const n = Number(String(raw ?? "").replace(/[^\d]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

export function rateError(message, field = "rates") {
  const err = new Error(message);
  err.code = "VALIDATION_ERROR";
  err.field = field;
  return err;
}

export function normalizeContractRates(input) {
  const list = Array.isArray(input) ? input : [];
  const out = [];
  for (let i = 0; i < list.length; i += 1) {
    const row = list[i] || {};
    const preset = RATE_PRESETS.find((p) => p.rate_type === row.rate_type);
    const rateType = String(row.rate_type || "").trim();
    if (!RATE_TYPE_SET.has(rateType)) throw rateError("급여 항목 종류가 올바르지 않습니다.");
    const unit = toUnitCode(row.unit || preset?.unit);
    if (!unit) throw rateError("급여 단위가 올바르지 않습니다.");
    const amount = parseAmount(row.amount);
    if (amount == null) {
      if (preset?.core) throw rateError(`${preset.rate_name} 금액을 입력해 주세요.`);
      continue;
    }
    if (preset?.core) {
      out.push({
        rate_type: rateType,
        rate_name: preset.rate_name,
        amount,
        unit: "hour",
        sort_order: out.length,
      });
      continue;
    }
    let rateName = String(row.rate_name || preset?.rate_name || "").trim();
    if (rateType === "custom") {
      if (!rateName || rateName === "기타") throw rateError("기타 항목 이름을 입력해 주세요.");
    } else if (!rateName) {
      rateName = preset?.rate_name || rateType;
    }
    out.push({
      rate_type: rateType,
      rate_name: rateName,
      amount,
      unit,
      sort_order: out.length,
    });
  }
  if (!out.some((r) => r.rate_type === "after_school")) {
    throw rateError("방과후수업 금액을 입력해 주세요.");
  }
  return out;
}

export function contractEndDate(startDate, years = 1) {
  const count = Number(years);
  if (!Number.isInteger(count) || count < 1 || count > 5) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(startDate || ""))) return "";
  const date = new Date(`${startDate}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== startDate) return "";
  date.setUTCFullYear(date.getUTCFullYear() + count);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

// Names, dates and rates remain synchronized with the structured contract fields.
export const EDITABLE_CONTRACT_SECTIONS = [1, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

export function contractParagraphEditKey(sectionIndex, paragraphIndex, text) {
  if (sectionIndex === 2 && paragraphIndex > 0) return `2.${paragraphIndex + 1}`;
  if (sectionIndex === 3) {
    const ordinal = String(text).match(/^(\d+)\./)?.[1];
    return ordinal ? `3.${ordinal}` : null;
  }
  return null;
}

export function validateContractIssueInput(input = {}) {
  const teacherName = String(input.teacherName || "").trim();
  const teacherPhone = String(input.teacherPhone || "").trim();
  const residentFront = String(input.residentFront || "").replace(/\D/g, "").slice(0, 6);
  const contractType = String(input.contractType || "위탁계약").trim() || "위탁계약";
  const startDate = String(input.startDate || "").slice(0, 10);
  const endDate = String(input.endDate || "").slice(0, 10);
  const contractDate = String(input.contractDate || input.startDate || "").slice(0, 10);
  if (!teacherName) throw rateError("선생님 이름이 필요합니다.", "teacher_name");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) throw rateError("계약 시작일을 입력해 주세요.", "start_date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) throw rateError("계약 종료일을 입력해 주세요.", "end_date");
  if (endDate < startDate) throw rateError("계약 종료일은 시작일 이후여야 합니다.", "end_date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(contractDate)) throw rateError("계약일을 입력해 주세요.", "contract_date");
  if (input.contractYears != null && contractEndDate(startDate, input.contractYears) !== endDate) {
    throw rateError("계약 종료일이 선택한 연 단위 기간과 일치하지 않습니다.", "end_date");
  }
  const rates = normalizeContractRates(input.rates);
  return {
    teacherName,
    teacherPhone,
    residentFront: residentFront.length === 6 ? residentFront : "",
    contractType,
    startDate,
    endDate,
    contractDate,
    rates,
  };
}

export function formatSignedAtKst(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const pick = (type) => parts.find((p) => p.type === type)?.value || "";
  return `${pick("year")}-${pick("month")}-${pick("day")} ${pick("hour")}:${pick("minute")}`;
}
