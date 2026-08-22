import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  assertValidPin,
  hashKioskPin,
  timingSafeEqual,
  verifyKioskPin,
} from "./kioskPin.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version, x-kiosk-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const BRANCHES = ["사무실", "엘리트코어", "삼성점", "한남점", "나비에로"];
const DEFAULT_LOCATION = "사무실";
const DEFAULT_RENT_DAYS = 7;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(code: string, message: string, status = 500, extra: Record<string, unknown> = {}) {
  console.error("[kiosk]", { code, status });
  return jsonResponse({ error: message, code, ...extra }, status);
}

function todayYmd(offsetDays = 0) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 해당 날짜가 속한 주의 일요일 (일요일 시작) */
function sundayOfWeekContaining(ymd: string) {
  const d = new Date(`${String(ymd).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(ymd).slice(0, 10);
  d.setDate(d.getDate() - d.getDay());
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 순환 주차가 이번주/다음주 중 어디에 해당하는지 (일~토 기준) */
function relativeGuideWeekTag(
  weekStart: string,
  weekEnd: string,
  thisSunday: string,
  nextSunday: string,
  nextSaturday: string,
): "이번주" | "다음주" | null {
  const thisSaturday = ymdAddDays(thisSunday, 6) || thisSunday;
  const ws = String(weekStart || "").slice(0, 10);
  const we = String(weekEnd || "").slice(0, 10);
  if (!ws || !we) return null;
  const overlapsThis = ws <= thisSaturday && we >= thisSunday;
  const overlapsNext = ws <= nextSaturday && we >= nextSunday;
  if (overlapsThis && !overlapsNext) return "이번주";
  if (overlapsNext && !overlapsThis) return "다음주";
  if (overlapsThis && overlapsNext) {
    const slotSun = sundayOfWeekContaining(ws);
    if (slotSun === nextSunday) return "다음주";
    return "이번주";
  }
  return null;
}

function formatRelativeGuideLabel(tag: "이번주" | "다음주", teacherName: string) {
  return `${tag} ${teacherName} 선생님 정규교구`;
}

function normalizeItemName(value: string) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

/** 시트 교구명 → DB items.name (itemRotation.js 와 동일 매핑) */
const ITEM_NAME_ALIASES: Record<string, string> = {
  "사각징검다리/방구": "밸런스 징검다리",
  "에어허들": "에어 허들",
  "딱딱이컵": "스태킹컵(작은컵)",
  "스태킹컵 (작은컵)": "스태킹컵(작은컵)",
  "에어도넛": "에어 도넛",
  "에어브릿지": "레인보우 브릿지",
  "에어사각브릿지": "레인보우 브릿지",
  "에어스파이더": "에어 스파이더",
  "에어지네": "에어 지네",
  "에어클라이밍": "에어 둥근 클라이밍 매트",
  "에어삼각사다리": "에어 자이언트 삼각다리",
  "에어정글짐": "에어 정글짐",
  "에어옥타곤": "에어 T 터널",
  "에어트램폴린": "에어트램폴린",
  "에어T터널": "에어 T 터널",
  "에어사다리": "에어 사다리",
  "에어육각": "에어 T 터널",
  "스테핑 스톤(스켈레톤)": "밸런스 스톤 세트",
  "도미노(벽돌)": "미니 도미노",
  "매트(구르기)": "롱매트 (long matt)",
  "아이짐징검다리": "아이짐 원형링",
  "모양징검다리": "모양 징검다리",
  "원형징검다리": "원형 징검다리",
  "악어징검다리": "악어 징검다리",
  "웨이브징검다리": "웨이브징검다리",
  "무빙바스켓": "무빙 바스켓",
  "애벌레징검다리": "애벌레 징검다리",
  "밸런스쿠션": "밸런스 쿠션",
  "고슴도치쿠션": "고슴도치공",
  "점핑블럭": "점핑 블럭",
  "점보컵쌓기": "점보컵",
  "파이프공나르기": "파이프 공 나르기",
  "타이어굴리기": "타이어",
  "캐치볼": "캐치볼 (Catchball)",
  "축구공": "축구공 3호",
  "호핑볼": "호핑볼 (Hopping ball)",
  "풍선치기": "풍선 라켓",
  "플라잉디스크": "플라잉디스크",
  "런닝맨": "런닝맨 (벨크로 조끼)",
  "노랑터널": "노랑허들",
  "사각매트": "사각매트 (rectangle matt)",
  "터널통과하기": "무지개터널",
  "터널통과": "무지개터널",
  "다트축구공": "축구공 3호",
  "펭귄놀이": "펭귄수트",
  "집게": "로봇집게",
  "미니스틱": "미니 하키스틱",
  "스펀지 체조볼": "에어 체조볼 (Gymnastic ball)",
};

function resolveCatalogItem(
  items: Array<{ id: string; name: string; alias?: string | null }>,
  sheetName: string,
) {
  const raw = normalizeItemName(sheetName);
  if (!raw) return null;
  const alias = ITEM_NAME_ALIASES[raw];
  const candidates = [raw, alias].filter(Boolean);
  for (const c of candidates) {
    const exact = items.find((i) =>
      normalizeItemName(i.name) === c || normalizeItemName(i.alias || "") === c
    );
    if (exact) return exact;
  }
  // 부분 일치 폴백
  const compact = raw.replace(/\s+/g, "");
  return items.find((i) => {
    const n = normalizeItemName(i.name).replace(/\s+/g, "");
    const a = normalizeItemName(i.alias || "").replace(/\s+/g, "");
    return n.includes(compact) || compact.includes(n) || (a && (a.includes(compact) || compact.includes(a)));
  }) || null;
}

function formatKoMonthDay(ymd: string) {
  if (!ymd) return "";
  const parts = String(ymd).slice(0, 10).split("-").map(Number);
  if (parts.length < 3 || !parts[1] || !parts[2]) return String(ymd).slice(0, 10);
  return `${parts[1]}월 ${parts[2]}일`;
}

function ymdAddDays(ymd: string, deltaDays: number) {
  if (!ymd) return null;
  const d = new Date(`${String(ymd).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + deltaDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthsSpanned(startYmd: string, endYmd: string) {
  const months = new Set<string>();
  const cur = new Date(`${startYmd}T12:00:00`);
  const end = new Date(`${endYmd}T12:00:00`);
  if (Number.isNaN(cur.getTime()) || Number.isNaN(end.getTime())) return [];
  while (cur <= end) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    months.add(`${y}-${m}-01`);
    cur.setMonth(cur.getMonth() + 1, 1);
  }
  return [...months];
}

/**
 * 교구별 다가오는 정규수업(순환) 안내.
 * 표시: "이번주/다음주 [선생님] 선생님 정규교구"
 * 기간: 이번 주(일~토) + 다음 주만
 */
async function loadRotationGuides(admin, items: Array<{ id: string; name: string; alias?: string | null }>) {
  const thisSunday = sundayOfWeekContaining(todayYmd(0));
  const nextSunday = ymdAddDays(thisSunday, 7) || thisSunday;
  const nextSaturday = ymdAddDays(thisSunday, 13) || todayYmd(13);
  const fromYmd = thisSunday;
  const toYmd = nextSaturday;
  const months = monthsSpanned(fromYmd, toYmd);
  if (!months.length || !items?.length) return {};

  const [schedRes, weeklyRes, weeksRes, teachersRes] = await Promise.all([
    admin
      .from("item_rotation_schedule")
      .select("teacher_id, year_month, assigned_letter")
      .in("year_month", months),
    admin.from("item_weekly_lists").select("letter, week_number, item_name, target_type"),
    admin
      .from("item_rotation_month_weeks")
      .select("year_month, week_number, week_start_date, week_end_date")
      .in("year_month", months),
    admin.from("teachers").select("id, name, active, resigned_at, role"),
  ]);

  if (schedRes.error && schedRes.error.code !== "42P01") throw schedRes.error;
  if (weeklyRes.error && weeklyRes.error.code !== "42P01") throw weeklyRes.error;
  if (weeksRes.error && weeksRes.error.code !== "42P01") throw weeksRes.error;
  if (teachersRes.error) throw teachersRes.error;

  const schedules = schedRes.data || [];
  const weeklyLists = weeklyRes.data || [];
  const monthWeeks = weeksRes.data || [];
  if (!schedules.length || !weeklyLists.length) return {};

  const teacherMap = new Map(
    (teachersRes.data || [])
      .filter((t) => t.active !== false && !t.resigned_at && t.role !== "superadmin")
      .map((t) => [t.id, t.name]),
  );

  const byItem = new Map();
  for (const sched of schedules) {
    const teacherName = teacherMap.get(sched.teacher_id);
    if (!teacherName) continue;
    const schedYm = String(sched.year_month || "").slice(0, 7);
    const weeksForMonth = monthWeeks.filter((w) => String(w.year_month || "").slice(0, 7) === schedYm);
    const assignedRows = weeklyLists.filter((w) => w.letter === sched.assigned_letter);
    for (const row of assignedRows) {
      const item = resolveCatalogItem(items, row.item_name);
      if (!item) continue;
      const mw = weeksForMonth.find((w) => Number(w.week_number) === Number(row.week_number));
      if (!mw?.week_start_date || !mw?.week_end_date) continue;

      const tag = relativeGuideWeekTag(
        mw.week_start_date,
        mw.week_end_date,
        thisSunday,
        nextSunday,
        nextSaturday,
      );
      if (!tag) continue;

      const untilYmd = ymdAddDays(mw.week_start_date, -1) || mw.week_start_date;
      const entry = {
        teacher_id: sched.teacher_id,
        teacher_name: teacherName,
        week_start: mw.week_start_date,
        week_end: mw.week_end_date,
        until_ymd: untilYmd,
        relative_week: tag,
        target_type: row.target_type || null,
        label: formatRelativeGuideLabel(tag, teacherName),
      };
      const list = byItem.get(item.id) || [];
      const dedupeKey = `${entry.teacher_id}|${entry.week_start}|${entry.week_end}`;
      if (list.some((x) => `${x.teacher_id}|${x.week_start}|${x.week_end}` === dedupeKey)) continue;
      list.push(entry);
      byItem.set(item.id, list);
    }
  }

  const out: Record<string, Array<{
    teacher_id: string;
    teacher_name: string;
    week_start: string;
    week_end: string;
    until_ymd: string;
    relative_week: "이번주" | "다음주";
    target_type: string | null;
    label: string;
  }>> = {};
  for (const [itemId, list] of byItem.entries()) {
    list.sort((a, b) => {
      const ra = a.relative_week === "이번주" ? 0 : 1;
      const rb = b.relative_week === "이번주" ? 0 : 1;
      if (ra !== rb) return ra - rb;
      return String(a.week_start).localeCompare(String(b.week_start));
    });
    out[itemId] = list.slice(0, 4);
  }
  return out;
}

async function notifyAssignedTeachersOfConflictRent({
  supabaseUrl,
  serviceKey,
  assigneeIds,
  renterName,
  itemNames,
  reason,
}: {
  supabaseUrl: string;
  serviceKey: string;
  assigneeIds: string[];
  renterName: string;
  itemNames: string[];
  reason: string;
}) {
  const ids = [...new Set((assigneeIds || []).filter(Boolean))];
  if (!ids.length || !supabaseUrl || !serviceKey) return;
  const names = (itemNames || []).filter(Boolean).slice(0, 5);
  const itemLabel = names.length <= 2
    ? names.join(", ")
    : `${names.slice(0, 2).join(", ")} 외 ${names.length - 2}종`;
  const reasonPart = String(reason || "").trim() ? ` (사유: ${String(reason).trim().slice(0, 80)})` : "";
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        event: "kiosk_rotation_conflict_rent",
        payload: {
          teacher_ids: ids,
          renter_name: renterName,
          item_names: names,
          body: `${renterName} 선생님이 정규수업 전에 ${itemLabel || "교구"}을(를) 대여했어요${reasonPart}`,
        },
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.warn("[kiosk] conflict rent push failed", data);
    }
  } catch (err) {
    console.warn("[kiosk] conflict rent push error", err?.message || err);
  }
}

function heldQty(ri: { quantity: number }, rets: { rental_item_id: string; quantity: number; status: string }[]) {
  const returned = (rets || [])
    .filter((r) => r.rental_item_id === ri.id && r.status === "return_approved")
    .reduce((s, r) => s + Number(r.quantity || 0), 0);
  return Math.max(0, Number(ri.quantity || 0) - returned);
}

function returnPendingQty(riId: string, rets: { rental_item_id: string; quantity: number; status: string }[]) {
  return (rets || [])
    .filter((r) => r.rental_item_id === riId && r.status === "return_pending")
    .reduce((s, r) => s + Number(r.quantity || 0), 0);
}

function rentedQty(itemId: string, ris: { id: string; item_id: string; status: string; quantity: number }[], rets) {
  return ris
    .filter((r) => r.item_id === itemId && ["rented", "partial_returned"].includes(r.status))
    .reduce((s, r) => s + heldQty(r, rets), 0);
}

function pendingQty(itemId: string, ris: { item_id: string; status: string; quantity: number }[]) {
  return ris
    .filter((r) => r.item_id === itemId && r.status === "pending")
    .reduce((s, r) => s + Number(r.quantity || 0), 0);
}

function availQty(item, ris, rets) {
  return Math.max(0, Number(item.total_quantity || 0) - rentedQty(item.id, ris, rets) - pendingQty(item.id, ris));
}

async function importHmacKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function b64url(bytes: Uint8Array) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromB64url(s: string) {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** 기기 PIN 통과 후 발급하는 단기 토큰 (기본 12시간) */
async function mintKioskToken(secret: string, ttlSec = 12 * 3600) {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const payload = `kiosk|${exp}`;
  const key = await importHmacKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
  return `${b64url(new TextEncoder().encode(payload))}.${b64url(sig)}`;
}

async function verifyKioskToken(token: string, secret: string) {
  const raw = String(token || "");
  const [p, s] = raw.split(".");
  if (!p || !s) return false;
  let payload = "";
  try {
    payload = new TextDecoder().decode(fromB64url(p));
  } catch {
    return false;
  }
  const key = await importHmacKey(secret);
  const ok = await crypto.subtle.verify("HMAC", key, fromB64url(s), new TextEncoder().encode(payload));
  if (!ok) return false;
  const [, expStr] = payload.split("|");
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  return true;
}

async function sha256Hex(value: string) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomPairSecret() {
  return b64url(crypto.getRandomValues(new Uint8Array(32)));
}

async function mintTeacherSession(teacherId: string, secret: string, ttlSec = 10 * 60) {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const payload = `teacher|${teacherId}|${exp}`;
  const key = await importHmacKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
  return `${b64url(new TextEncoder().encode(payload))}.${b64url(sig)}`;
}

async function verifyTeacherSession(token: string, secret: string) {
  const [p, s] = String(token || "").split(".");
  if (!p || !s) return null;
  let payload = "";
  try {
    payload = new TextDecoder().decode(fromB64url(p));
  } catch {
    return null;
  }
  const [kind, teacherId, expStr] = payload.split("|");
  if (kind !== "teacher" || !teacherId) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null;
  const key = await importHmacKey(secret);
  const ok = await crypto.subtle.verify("HMAC", key, fromB64url(s), new TextEncoder().encode(payload));
  return ok ? { teacherId, exp } : null;
}

async function assertTeacherAccess(admin, body: Record<string, unknown>, secret: string) {
  const requestedId = String(body.teacher_id || "");
  const session = await verifyTeacherSession(String(body.teacher_session || ""), secret);
  if (!session) {
    throw Object.assign(new Error("휴대폰 QR 로그인이 필요합니다."), { code: "QR_LOGIN_REQUIRED" });
  }
  if (requestedId && requestedId !== session.teacherId) {
    throw Object.assign(new Error("다른 선생님 정보에는 접근할 수 없습니다."), { code: "FORBIDDEN" });
  }
  const { data: teacher } = await admin
    .from("teachers")
    .select("id, name, active, resigned_at")
    .eq("id", session.teacherId)
    .maybeSingle();
  if (!teacher || teacher.active === false || teacher.resigned_at) {
    throw Object.assign(new Error("사용할 수 없는 선생님 계정입니다."), { code: "TEACHER_INACTIVE" });
  }
  return teacher;
}

function requireDeviceAccess(body: Record<string, unknown>, headers: Headers, devicePin: string, tokenSecret: string) {
  return (async () => {
    const headerToken = headers.get("x-kiosk-token") || "";
    const bodyToken = String(body.kiosk_token || "");
    const token = headerToken || bodyToken;
    if (token && await verifyKioskToken(token, tokenSecret)) return true;
    const pin = String(body.device_pin || "");
    if (devicePin && timingSafeEqual(pin, devicePin)) return true;
    return false;
  })();
}

async function loadCatalogStock(admin) {
  const [{ data: items, error: iErr }, { data: ris }, { data: rets }] = await Promise.all([
    admin
      .from("items")
      .select("id, code, name, alias, category, branch, total_quantity, photo_url, activity_photos, status")
      .eq("status", "available")
      .order("code"),
    admin.from("rental_items").select("id, item_id, quantity, status"),
    admin.from("return_requests").select("rental_item_id, quantity, status"),
  ]);
  if (iErr) throw iErr;
  return (items || [])
    .filter((it) => it.status === "available")
    .map((it) => ({
      id: it.id,
      code: it.code,
      name: it.name,
      alias: it.alias || null,
      category: it.category,
      branch: it.branch,
      photo_url: it.photo_url || null,
      activity_photos: Array.isArray(it.activity_photos) ? it.activity_photos : [],
      total_quantity: it.total_quantity,
      status: it.status,
      available: availQty(it, ris || [], rets || []),
    }));
}

async function loadCatalog(admin) {
  const [{ data: categories }, list] = await Promise.all([
    admin.from("gear_categories").select("id, label, color, icon, sort_order").order("sort_order"),
    loadCatalogStock(admin),
  ]);
  let rotation_guides = {};
  try {
    rotation_guides = await loadRotationGuides(admin, list);
  } catch (err) {
    console.warn("[kiosk] rotation_guides failed", err?.message || err);
  }
  return {
    categories: categories || [],
    items: list,
    branches: BRANCHES,
    rotation_guides,
  };
}

async function listTeachers(admin) {
  const { data, error } = await admin
    .from("teachers")
    .select("id, name, has_kiosk_pin, active, resigned_at, role")
    .order("name");
  if (error) throw error;
  return (data || [])
    .filter((t) => t.active !== false && !t.resigned_at)
    .map((t) => ({
      id: t.id,
      name: t.name,
      has_kiosk_pin: Boolean(t.has_kiosk_pin),
      role: t.role || "teacher",
    }));
}

function kstTodayYmd() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** 이번 주 배정 교구 — 순환 스케줄/주간 리스트 원본 (클라이언트에서 주차 계산) */
async function loadTeacherWeekGear(admin, teacherId: string) {
  const id = String(teacherId || "").trim();
  if (!id) {
    const err = new Error("선생님을 선택해 주세요.");
    err.code = "VALIDATION_ERROR";
    err.field = "teacher_id";
    throw err;
  }

  const { data: teacher, error: tErr } = await admin
    .from("teachers")
    .select("id, name, active, resigned_at")
    .eq("id", id)
    .maybeSingle();
  if (tErr) throw tErr;
  if (!teacher || teacher.active === false || teacher.resigned_at) {
    const err = new Error("선생님을 찾을 수 없습니다.");
    err.code = "TEACHER_INACTIVE";
    throw err;
  }

  const [schedRes, weeklyRes, weeksRes, itemsRes] = await Promise.all([
    admin
      .from("item_rotation_schedule")
      .select("year_month, assigned_letter, teacher_id")
      .eq("teacher_id", id),
    admin.from("item_weekly_lists").select("*").order("week_number"),
    admin.from("item_rotation_month_weeks").select("*").order("week_number"),
    admin
      .from("items")
      .select("id, code, name, alias, category, photo_url, status, total_quantity")
      .order("code"),
  ]);

  if (schedRes.error && schedRes.error.code !== "42P01") throw schedRes.error;
  if (weeklyRes.error && weeklyRes.error.code !== "42P01") throw weeklyRes.error;
  if (weeksRes.error && weeksRes.error.code !== "42P01") throw weeksRes.error;
  if (itemsRes.error) throw itemsRes.error;

  return {
    teacher: { id: teacher.id, name: teacher.name },
    schedules: schedRes.data || [],
    weeklyLists: weeklyRes.data || [],
    monthWeeks: weeksRes.data || [],
    items: (itemsRes.data || []).map((it) => ({
      id: it.id,
      code: it.code,
      name: it.name,
      alias: it.alias || null,
      category: it.category,
      photo_url: it.photo_url || null,
      status: it.status,
      total_quantity: it.total_quantity,
    })),
  };
}

async function getPinRow(admin, teacherId: string) {
  const { data, error } = await admin
    .from("teacher_kiosk_pins")
    .select("pin_hash")
    .eq("teacher_id", teacherId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function assertTeacherPin(admin, teacherId: string, pin: string, secret: string) {
  const clean = assertValidPin(pin, "teacher_pin");
  const row = await getPinRow(admin, teacherId);
  if (!row?.pin_hash) {
    const err = new Error("키오스크 PIN이 설정되지 않았습니다. 마이페이지에서 PIN을 먼저 설정해 주세요.");
    err.code = "PIN_NOT_SET";
    throw err;
  }
  const ok = await verifyKioskPin(teacherId, clean, row.pin_hash, secret);
  if (!ok) {
    const err = new Error("PIN이 올바르지 않습니다.");
    err.code = "PIN_INVALID";
    throw err;
  }
  const { data: teacher, error } = await admin
    .from("teachers")
    .select("id, name, active, resigned_at")
    .eq("id", teacherId)
    .maybeSingle();
  if (error) throw error;
  if (!teacher || teacher.active === false || teacher.resigned_at) {
    const err = new Error("사용할 수 없는 선생님 계정입니다.");
    err.code = "TEACHER_INACTIVE";
    throw err;
  }
  return teacher;
}

async function audit(admin, row: Record<string, unknown>) {
  await admin.from("kiosk_action_audit").insert(row);
}

async function rentItem(admin, {
  teacherId,
  itemId,
  quantity,
  location,
  teacherName,
}: {
  teacherId: string;
  itemId: string;
  quantity: number;
  location: string;
  teacherName: string;
}) {
  return rentItemsBatch(admin, {
    teacherId,
    location,
    teacherName,
    lines: [{ itemId, quantity }],
  });
}

/** 여러 교구를 한 번의 대여 신청으로 처리 */
async function rentItemsBatch(admin, {
  teacherId,
  lines,
  location,
  teacherName,
  conflictReason = "",
  conflictNotify = null,
}: {
  teacherId: string;
  lines: Array<{ itemId: string; quantity: number }>;
  location: string;
  teacherName: string;
  conflictReason?: string;
  conflictNotify?: null | {
    supabaseUrl: string;
    serviceKey: string;
    assigneeIds: string[];
    itemNames: string[];
  };
}) {
  const loc = BRANCHES.includes(location) ? location : DEFAULT_LOCATION;
  const normalized = (lines || [])
    .map((l) => ({
      itemId: String(l.itemId || "").trim(),
      quantity: Math.floor(Number(l.quantity)),
    }))
    .filter((l) => l.itemId && Number.isFinite(l.quantity) && l.quantity >= 1);

  if (!normalized.length) {
    const err = new Error("대여할 교구를 담아 주세요.");
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  // 동일 교구 수량 합산
  const qtyById = new Map();
  for (const line of normalized) {
    qtyById.set(line.itemId, (qtyById.get(line.itemId) || 0) + line.quantity);
  }

  const catalogItems = await loadCatalogStock(admin);
  const resolved = [];
  for (const [itemId, qty] of qtyById.entries()) {
    const item = catalogItems.find((i) => i.id === itemId);
    if (!item) {
      const err = new Error("교구를 찾을 수 없습니다.");
      err.code = "ITEM_NOT_FOUND";
      throw err;
    }
    if (item.available < qty) {
      const err = new Error(`${item.name}: 재고가 부족합니다. (가능 ${item.available}개)`);
      err.code = "INSUFFICIENT_STOCK";
      throw err;
    }
    resolved.push({ item, quantity: qty });
  }

  const start = todayYmd(0);
  const end = todayYmd(DEFAULT_RENT_DAYS);
  const reasonNote = String(conflictReason || "").trim().slice(0, 120);
  const memo = reasonNote
    ? `키오스크 대여 | 순환충돌 확인: ${reasonNote}`
    : "키오스크 대여";

  const { data: req, error: reqErr } = await admin
    .from("rental_requests")
    .insert({
      teacher_id: teacherId,
      dispatch_location: loc,
      dispatch_start: start,
      dispatch_end: end,
      memo,
      status: "pending",
    })
    .select("id")
    .single();
  if (reqErr || !req) throw reqErr || new Error("대여 신청 실패");

  const inserted = [];
  try {
    for (const row of resolved) {
      const { data: ri, error: riErr } = await admin
        .from("rental_items")
        .insert({
          request_id: req.id,
          item_id: row.item.id,
          set_id: null,
          component_name: null,
          quantity: row.quantity,
          due_date: end,
          status: "pending",
        })
        .select("id")
        .single();
      if (riErr || !ri) throw riErr || new Error("대여 항목 저장 실패");
      inserted.push({
        rental_item_id: ri.id,
        item_id: row.item.id,
        item_name: row.item.name,
        quantity: row.quantity,
      });
    }
  } catch (err) {
    await admin.from("rental_items").delete().eq("request_id", req.id);
    await admin.from("rental_requests").delete().eq("id", req.id);
    throw err;
  }

  await audit(admin, {
    action: "rent_batch_pending",
    teacher_id: teacherId,
    item_id: inserted[0]?.item_id || null,
    quantity: inserted.reduce((s, r) => s + r.quantity, 0),
    meta: {
      location: loc,
      request_id: req.id,
      teacher_name: teacherName,
      lines: inserted,
      status: "pending",
      conflict_reason: reasonNote || null,
    },
  });

  if (conflictNotify?.assigneeIds?.length) {
    await notifyAssignedTeachersOfConflictRent({
      supabaseUrl: conflictNotify.supabaseUrl,
      serviceKey: conflictNotify.serviceKey,
      assigneeIds: conflictNotify.assigneeIds,
      renterName: teacherName,
      itemNames: conflictNotify.itemNames?.length
        ? conflictNotify.itemNames
        : inserted.map((r) => r.item_name),
      reason: reasonNote,
    });
  }

  const summary = inserted.map((r) => `${r.item_name} ${r.quantity}개`).join(", ");
  return {
    request_id: req.id,
    due_date: end,
    location: loc,
    lines: inserted,
    item_name: inserted.length === 1 ? inserted[0].item_name : `${inserted.length}종`,
    quantity: inserted.reduce((s, r) => s + r.quantity, 0),
    summary,
    status: "pending",
  };
}

async function teacherHoldings(admin, teacherId: string) {
  const [{ data: reqs }, { data: ris }, { data: rets }, { data: items }] = await Promise.all([
    admin.from("rental_requests").select("id, teacher_id, dispatch_start, status").eq("teacher_id", teacherId),
    admin.from("rental_items").select("id, request_id, item_id, quantity, status, due_date, approved_at, created_at"),
    admin.from("return_requests").select("rental_item_id, quantity, status"),
    admin.from("items").select("id, code, name, category, photo_url"),
  ]);
  const reqIds = new Set((reqs || []).map((r) => r.id));
  const itemMap = Object.fromEntries((items || []).map((i) => [i.id, i]));
  const holdings = [];
  for (const ri of ris || []) {
    if (!reqIds.has(ri.request_id)) continue;
    if (!["rented", "partial_returned"].includes(ri.status)) continue;
    if (!ri.item_id) continue;
    const held = heldQty(ri, rets || []);
    const pending = returnPendingQty(ri.id, rets || []);
    const returnable = Math.max(0, held - pending);
    if (returnable <= 0) continue;
    const item = itemMap[ri.item_id];
    holdings.push({
      rental_item_id: ri.id,
      item_id: ri.item_id,
      name: item?.name || "교구",
      code: item?.code || "",
      photo_url: item?.photo_url || null,
      returnable,
      due_date: ri.due_date,
    });
  }
  // 같은 item_id 합산 뷰
  const byItem = new Map();
  for (const h of holdings) {
    const cur = byItem.get(h.item_id) || {
      item_id: h.item_id,
      name: h.name,
      code: h.code,
      photo_url: h.photo_url,
      returnable: 0,
      lines: [],
    };
    cur.returnable += h.returnable;
    cur.lines.push({
      rental_item_id: h.rental_item_id,
      returnable: h.returnable,
      due_date: h.due_date,
    });
    byItem.set(h.item_id, cur);
  }
  return [...byItem.values()];
}

async function returnItem(admin, {
  teacherId,
  itemId,
  quantity,
  location,
  teacherName,
}: {
  teacherId: string;
  itemId: string;
  quantity: number;
  location: string;
  teacherName: string;
}) {
  const qty = Math.floor(Number(quantity));
  if (!Number.isFinite(qty) || qty < 1) {
    const err = new Error("수량을 확인해 주세요.");
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  const loc = BRANCHES.includes(location) ? location : DEFAULT_LOCATION;
  const holdings = await teacherHoldings(admin, teacherId);
  const group = holdings.find((h) => h.item_id === itemId);
  if (!group || group.returnable < qty) {
    const err = new Error(`반납 가능 수량이 부족합니다. (가능 ${group?.returnable || 0}개)`);
    err.code = "INSUFFICIENT_RETURNABLE";
    throw err;
  }

  let remaining = qty;
  const created = [];
  const sorted = [...group.lines].sort((a, b) => String(a.due_date || "").localeCompare(String(b.due_date || "")));

  for (const line of sorted) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, line.returnable);
    if (take <= 0) continue;
    const { data: ret, error } = await admin
      .from("return_requests")
      .insert({
        rental_item_id: line.rental_item_id,
        quantity: take,
        condition: "normal",
        memo: "키오스크 반납",
        teacher_id: teacherId,
        status: "return_pending",
        return_location: loc,
      })
      .select("id, rental_item_id, quantity")
      .single();
    if (error) throw error;
    created.push(ret);
    remaining -= take;
  }

  await audit(admin, {
    action: "return_pending",
    teacher_id: teacherId,
    item_id: itemId,
    quantity: qty,
    meta: {
      item_name: group.name,
      location: loc,
      teacher_name: teacherName,
      return_ids: created.map((c) => c.id),
      status: "return_pending",
    },
  });

  return {
    item_name: group.name,
    quantity: qty,
    location: loc,
    status: "return_pending",
  };
}

async function teacherPendingReturns(admin, teacherId: string) {
  const { data: rets, error } = await admin
    .from("return_requests")
    .select("id, rental_item_id, quantity, status, created_at, memo, return_location, teacher_id")
    .eq("teacher_id", teacherId)
    .eq("status", "return_pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!rets?.length) return [];

  const riIds = [...new Set(rets.map((r) => r.rental_item_id).filter(Boolean))];
  const { data: ris } = await admin
    .from("rental_items")
    .select("id, item_id")
    .in("id", riIds);
  const itemIds = [...new Set((ris || []).map((r) => r.item_id).filter(Boolean))];
  const { data: items } = itemIds.length
    ? await admin.from("items").select("id, code, name, photo_url").in("id", itemIds)
    : { data: [] };
  const riMap = Object.fromEntries((ris || []).map((r) => [r.id, r]));
  const itemMap = Object.fromEntries((items || []).map((i) => [i.id, i]));

  return rets.map((ret) => {
    const ri = riMap[ret.rental_item_id];
    const item = ri ? itemMap[ri.item_id] : null;
    return {
      id: ret.id,
      rental_item_id: ret.rental_item_id,
      item_id: ri?.item_id || null,
      name: item?.name || "교구",
      code: item?.code || "",
      photo_url: item?.photo_url || null,
      quantity: Number(ret.quantity || 0),
      created_at: ret.created_at,
      memo: ret.memo || null,
      return_location: ret.return_location || null,
    };
  });
}

async function cancelReturnRequest(admin, {
  teacherId,
  returnId,
  teacherName,
}: {
  teacherId: string;
  returnId: string;
  teacherName: string;
}) {
  const id = String(returnId || "").trim();
  if (!id) {
    const err = new Error("반납 신청을 선택해 주세요.");
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  const { data: ret, error } = await admin
    .from("return_requests")
    .select("id, teacher_id, rental_item_id, quantity, status")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!ret || ret.teacher_id !== teacherId) {
    const err = new Error("반납 신청을 찾을 수 없습니다.");
    err.code = "NOT_FOUND";
    throw err;
  }
  if (ret.status !== "return_pending") {
    const err = new Error("이미 처리된 반납 신청입니다.");
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  const { error: updErr } = await admin
    .from("return_requests")
    .update({ status: "return_cancelled" })
    .eq("id", id)
    .eq("status", "return_pending");
  if (updErr) throw updErr;

  let itemId = null;
  let itemName = "교구";
  const { data: ri } = await admin
    .from("rental_items")
    .select("id, item_id, status")
    .eq("id", ret.rental_item_id)
    .maybeSingle();
  if (ri?.item_id) {
    itemId = ri.item_id;
    const { data: item } = await admin.from("items").select("name").eq("id", ri.item_id).maybeSingle();
    itemName = item?.name || itemName;
  }

  await audit(admin, {
    action: "return_cancelled",
    teacher_id: teacherId,
    item_id: itemId,
    quantity: Number(ret.quantity || 0),
    meta: {
      return_id: id,
      item_name: itemName,
      teacher_name: teacherName,
      status: "return_cancelled",
    },
  });

  return {
    return_id: id,
    item_name: itemName,
    quantity: Number(ret.quantity || 0),
    status: "return_cancelled",
  };
}

const MAX_KIOSK_EXTENSIONS = 5;

function computeExtendedDueYmd(currentDue: string | null, weeks: number) {
  const today = todayYmd(0);
  const base = String(currentDue || "").slice(0, 10) || today;
  const from = base > today ? base : today;
  return ymdAddDays(from, Math.max(1, weeks) * 7) || from;
}

async function extendHoldings(admin, {
  teacherId,
  itemIds,
  weeks,
  teacherName,
}: {
  teacherId: string;
  itemIds: string[];
  weeks: number;
  teacherName: string;
}) {
  const w = Math.max(1, Math.min(2, Math.floor(Number(weeks) || 1)));
  const ids = [...new Set((itemIds || []).map((id) => String(id || "").trim()).filter(Boolean))];
  if (!ids.length) {
    const err = new Error("다시 대여할 교구를 선택해 주세요.");
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  const catalog = await loadCatalogStock(admin);
  const guidesByItem = await loadRotationGuides(admin, catalog);
  const itemNameMap = Object.fromEntries(catalog.map((i) => [i.id, i.name]));

  for (const itemId of ids) {
    const guides = guidesByItem[itemId] || [];
    const other = guides.find((g) => g.teacher_id && g.teacher_id !== teacherId);
    if (other) {
      const err = new Error(
        `${itemNameMap[itemId] || "교구"}은(는) ${other.teacher_name}님의 ${other.relative_week} 정규수업 교구라 다시 대여할 수 없습니다.`,
      );
      err.code = "ROTATION_BLOCKED";
      throw err;
    }
  }

  const holdings = await teacherHoldings(admin, teacherId);
  const holdingByItem = new Map(holdings.map((h) => [h.item_id, h]));
  const extended = [];

  for (const itemId of ids) {
    const group = holdingByItem.get(itemId);
    if (!group?.lines?.length) {
      const err = new Error(`${itemNameMap[itemId] || "교구"}은(는) 보유 중이 아니거나 반납 대기 중이라 다시 대여할 수 없습니다.`);
      err.code = "VALIDATION_ERROR";
      throw err;
    }
    for (const line of group.lines) {
      const { data: ri, error: riErr } = await admin
        .from("rental_items")
        .select("id, item_id, due_date, extension_count, status")
        .eq("id", line.rental_item_id)
        .maybeSingle();
      if (riErr) throw riErr;
      if (!ri || !["rented", "partial_returned"].includes(ri.status)) continue;
      const extCount = Number(ri.extension_count || 0);
      if (extCount >= MAX_KIOSK_EXTENSIONS) {
        const err = new Error(`${group.name}은(는) 연장 한도에 도달했습니다.`);
        err.code = "VALIDATION_ERROR";
        throw err;
      }
      const newDue = computeExtendedDueYmd(ri.due_date, w);
      const { data: updated, error: updErr } = await admin
        .from("rental_items")
        .update({
          due_date: newDue,
          extension_count: extCount + 1,
          last_extended_at: new Date().toISOString(),
        })
        .eq("id", ri.id)
        .select("id, item_id, due_date, extension_count")
        .single();
      if (updErr) throw updErr;
      extended.push({
        rental_item_id: updated.id,
        item_id: updated.item_id,
        item_name: group.name,
        due_date: updated.due_date,
        extension_count: updated.extension_count,
      });
    }
  }

  if (!extended.length) {
    const err = new Error("다시 대여 처리할 교구가 없습니다.");
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  await audit(admin, {
    action: "kiosk_extend",
    teacher_id: teacherId,
    item_id: extended[0]?.item_id || null,
    quantity: extended.length,
    meta: {
      teacher_name: teacherName,
      weeks: w,
      lines: extended,
    },
  });

  return {
    weeks: w,
    lines: extended,
    item_names: [...new Set(extended.map((e) => e.item_name))],
    status: "extended",
  };
}

async function setPin(admin, {
  teacherId,
  pin,
  currentPin,
  secret,
  actorId,
}: {
  teacherId: string;
  pin: string;
  currentPin?: string;
  secret: string;
  actorId: string;
}) {
  const next = assertValidPin(pin, "pin");
  const existing = await getPinRow(admin, teacherId);
  if (existing?.pin_hash) {
    if (!currentPin) {
      const err = new Error("현재 PIN을 입력해 주세요.");
      err.code = "VALIDATION_ERROR";
      err.field = "current_pin";
      throw err;
    }
    const ok = await verifyKioskPin(teacherId, currentPin, existing.pin_hash, secret);
    if (!ok) {
      const err = new Error("현재 PIN이 올바르지 않습니다.");
      err.code = "PIN_INVALID";
      err.field = "current_pin";
      throw err;
    }
  }
  const pinHash = await hashKioskPin(teacherId, next, secret);
  const { error } = await admin.from("teacher_kiosk_pins").upsert({
    teacher_id: teacherId,
    pin_hash: pinHash,
    updated_at: new Date().toISOString(),
    updated_by: actorId,
  }, { onConflict: "teacher_id" });
  if (error) throw error;
  await admin.from("teachers").update({ has_kiosk_pin: true }).eq("id", teacherId);
  return { has_kiosk_pin: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const devicePin = Deno.env.get("KIOSK_DEVICE_PIN") ?? "";
    const pinSecret = Deno.env.get("KIOSK_PIN_SECRET")
      || Deno.env.get("SETTLEMENT_ENCRYPTION_KEY")
      || "";
    const authHeader = req.headers.get("Authorization") || "";

    if (!pinSecret) {
      return jsonError("PIN_SECRET_MISSING", "키오스크 PIN 비밀키가 설정되지 않았습니다.", 500);
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    if (action === "create_pair") {
      const pairSecret = randomPairSecret();
      const expiresAt = new Date(Date.now() + 90 * 1000).toISOString();
      const { data, error } = await admin.from("kiosk_pairing_sessions").insert({
        secret_hash: await sha256Hex(pairSecret),
        status: "pending",
        expires_at: expiresAt,
      }).select("id, expires_at").single();
      if (error) throw error;
      return jsonResponse({ data: { pair_id: data.id, pair_secret: pairSecret, expires_at: data.expires_at } });
    }

    if (action === "approve_pair") {
      if (!authHeader) return jsonError("NO_AUTHORIZATION", "GTS 로그인이 필요합니다.", 401);
      const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: { user }, error: userError } = await userClient.auth.getUser();
      if (userError || !user) return jsonError("INVALID_SESSION", "GTS 로그인이 필요합니다.", 401);
      const { data: teacher } = await admin.from("teachers")
        .select("id, name, active, resigned_at").eq("id", user.id).maybeSingle();
      if (!teacher || teacher.active === false || teacher.resigned_at) {
        return jsonError("TEACHER_INACTIVE", "사용할 수 없는 선생님 계정입니다.", 403);
      }
      const pairId = String(body.pair_id || "");
      const pairSecret = String(body.pair_secret || "");
      const { data: pair } = await admin.from("kiosk_pairing_sessions")
        .select("id, secret_hash, status, expires_at").eq("id", pairId).maybeSingle();
      if (!pair || pair.secret_hash !== await sha256Hex(pairSecret)) return jsonError("PAIR_INVALID", "유효하지 않은 QR입니다.", 400);
      if (pair.status !== "pending" || new Date(pair.expires_at).getTime() <= Date.now()) {
        return jsonError("PAIR_EXPIRED", "QR 로그인 시간이 만료되었습니다.", 400);
      }
      const { error } = await admin.from("kiosk_pairing_sessions").update({
        status: "approved", teacher_id: teacher.id, approved_at: new Date().toISOString(),
      }).eq("id", pair.id).eq("status", "pending");
      if (error) throw error;
      return jsonResponse({ data: { approved: true, teacher_name: teacher.name } });
    }

    if (action === "pair_status") {
      const pairId = String(body.pair_id || "");
      const pairSecret = String(body.pair_secret || "");
      const { data: pair } = await admin.from("kiosk_pairing_sessions")
        .select("id, secret_hash, status, teacher_id, expires_at").eq("id", pairId).maybeSingle();
      if (!pair || pair.secret_hash !== await sha256Hex(pairSecret)) return jsonError("PAIR_INVALID", "유효하지 않은 QR입니다.", 400);
      if (new Date(pair.expires_at).getTime() <= Date.now()) {
        if (pair.status === "pending") await admin.from("kiosk_pairing_sessions").update({ status: "expired" }).eq("id", pair.id);
        return jsonResponse({ data: { status: "expired" } });
      }
      if (pair.status !== "approved" || !pair.teacher_id) return jsonResponse({ data: { status: pair.status } });
      const { data: teacher } = await admin.from("teachers").select("id, name, active, resigned_at")
        .eq("id", pair.teacher_id).maybeSingle();
      if (!teacher || teacher.active === false || teacher.resigned_at) return jsonError("TEACHER_INACTIVE", "사용할 수 없는 계정입니다.", 403);
      const teacherSession = await mintTeacherSession(teacher.id, pinSecret);
      await admin.from("kiosk_pairing_sessions").update({ status: "consumed", consumed_at: new Date().toISOString() }).eq("id", pair.id);
      return jsonResponse({ data: {
        status: "approved",
        teacher: { id: teacher.id, name: teacher.name },
        teacher_session: teacherSession,
        expires_in: 10 * 60,
      } });
    }

    if (action === "extend_teacher_session") {
      const current = await verifyTeacherSession(String(body.teacher_session || ""), pinSecret);
      if (!current) return jsonError("QR_LOGIN_REQUIRED", "휴대폰 QR 로그인이 필요합니다.", 401);
      const { data: teacher } = await admin.from("teachers").select("id, active, resigned_at")
        .eq("id", current.teacherId).maybeSingle();
      if (!teacher || teacher.active === false || teacher.resigned_at) {
        return jsonError("TEACHER_INACTIVE", "사용할 수 없는 선생님 계정입니다.", 403);
      }
      return jsonResponse({ data: {
        teacher_session: await mintTeacherSession(teacher.id, pinSecret),
        expires_in: 10 * 60,
      } });
    }

    // 로그인 사용자: PIN 설정/상태
    if (action === "get_pin_status" || action === "set_pin") {
      if (!authHeader) return jsonError("NO_AUTHORIZATION", "Unauthorized", 401);
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: userError } = await userClient.auth.getUser();
      if (userError || !user) return jsonError("INVALID_SESSION", "Unauthorized", 401);

      const { data: caller } = await admin
        .from("teachers")
        .select("id, role")
        .eq("id", user.id)
        .maybeSingle();
      if (!caller) return jsonError("TEACHER_NOT_FOUND", "Forbidden", 403);

      const targetId = String(body.teacher_id || caller.id);
      const isSelf = targetId === caller.id;
      const isSuper = caller.role === "superadmin";
      if (!isSelf && !isSuper) {
        return jsonError("FORBIDDEN", "PIN을 변경할 권한이 없습니다.", 403);
      }

      if (action === "get_pin_status") {
        const { data: t } = await admin
          .from("teachers")
          .select("id, has_kiosk_pin")
          .eq("id", targetId)
          .maybeSingle();
        return jsonResponse({
          data: {
            teacher_id: targetId,
            has_kiosk_pin: Boolean(t?.has_kiosk_pin),
          },
        });
      }

      // superadmin이 타인 PIN 강제 초기화
      if (isSuper && !isSelf && body.force === true) {
        const next = assertValidPin(body.pin, "pin");
        const pinHash = await hashKioskPin(targetId, next, pinSecret);
        await admin.from("teacher_kiosk_pins").upsert({
          teacher_id: targetId,
          pin_hash: pinHash,
          updated_at: new Date().toISOString(),
          updated_by: caller.id,
        }, { onConflict: "teacher_id" });
        await admin.from("teachers").update({ has_kiosk_pin: true }).eq("id", targetId);
        return jsonResponse({ data: { has_kiosk_pin: true } });
      }

      const data = await setPin(admin, {
        teacherId: targetId,
        pin: body.pin,
        currentPin: body.current_pin,
        secret: pinSecret,
        actorId: caller.id,
      });
      return jsonResponse({ data });
    }

    // 기기 잠금 해제
    if (action === "unlock") {
      const pin = String(body.device_pin || "");
      if (!timingSafeEqual(pin, devicePin)) {
        return jsonError("DEVICE_PIN_INVALID", "기기 PIN이 올바르지 않습니다.", 401);
      }
      const token = await mintKioskToken(pinSecret);
      return jsonResponse({ data: { kiosk_token: token, expires_in: 12 * 3600 } });
    }

    if (action === "catalog" || action === "teachers" || action === "notices") {
      if (action === "catalog") return jsonResponse({ data: await loadCatalog(admin) });
      if (action === "teachers") return jsonResponse({ data: await listTeachers(admin) });
    }

    const allowed = action === "notices" || (body.teacher_session
      ? Boolean(await verifyTeacherSession(String(body.teacher_session), pinSecret))
      : await requireDeviceAccess(body, req.headers, devicePin, pinSecret));
    if (!allowed) {
      return jsonError("DEVICE_LOCKED", "키오스크 기기 인증이 필요합니다.", 401);
    }

    if (action === "notices") {
      const [{ data, error }, { data: birthdayTeachers, error: birthdayError }] = await Promise.all([
        admin
          .from("notices")
          .select("id, title, body, importance, author_name, created_at")
          .order("created_at", { ascending: false })
          .limit(12),
        admin
          .from("teachers")
          .select("id, name, birth_date")
          .eq("active", true)
          .is("resigned_at", null)
          .not("birth_date", "is", null),
      ]);
      if (error) throw error;
      if (birthdayError) throw birthdayError;
      const today = kstTodayYmd();
      const birthdaySlides = (birthdayTeachers || [])
        .filter((teacher) => String(teacher.birth_date || "").slice(5) === today.slice(5))
        .map((teacher) => ({
          id: `birthday-${teacher.id}-${today}`,
          title: "오늘의 특별한 소식 🎂",
          body: `오늘은 ${teacher.name} 선생님 생일이에요! 다 함께 축하해 주세요. 🎉`,
          importance: "normal",
          author_name: "GTS",
          created_at: `${today}T08:00:00+09:00`,
          kind: "birthday",
        }));
      return jsonResponse({
        data: [...birthdaySlides, ...(data || []).map((n) => ({
          id: n.id,
          title: n.title,
          body: n.body || "",
          importance: n.importance || "normal",
          author_name: n.author_name || null,
          created_at: n.created_at,
        }))],
      });
    }

    if (action === "teacher_week_gear") {
      const teacher = await assertTeacherAccess(admin, body, pinSecret);
      const data = await loadTeacherWeekGear(admin, teacher.id);
      return jsonResponse({ data });
    }

    if (action === "holdings") {
      const teacher = await assertTeacherAccess(admin, body, pinSecret);
      const [holdings, pending_returns] = await Promise.all([
        teacherHoldings(admin, teacher.id),
        teacherPendingReturns(admin, teacher.id),
      ]);
      return jsonResponse({
        data: {
          teacher: { id: teacher.id, name: teacher.name },
          holdings,
          pending_returns,
        },
      });
    }

    if (action === "rent") {
      const teacher = await assertTeacherAccess(admin, body, pinSecret);
      const data = await rentItem(admin, {
        teacherId: teacher.id,
        itemId: String(body.item_id || ""),
        quantity: body.quantity,
        location: String(body.location || DEFAULT_LOCATION),
        teacherName: teacher.name,
      });
      return jsonResponse({ data });
    }

    if (action === "rent_batch") {
      const teacher = await assertTeacherAccess(admin, body, pinSecret);
      const rawLines = Array.isArray(body.items) ? body.items : [];
      const assigneeIds = Array.isArray(body.conflict_assignee_ids)
        ? body.conflict_assignee_ids.map((id) => String(id || "").trim()).filter(Boolean)
        : [];
      const conflictItemNames = Array.isArray(body.conflict_item_names)
        ? body.conflict_item_names.map((n) => String(n || "").trim()).filter(Boolean)
        : [];
      const data = await rentItemsBatch(admin, {
        teacherId: teacher.id,
        location: String(body.location || DEFAULT_LOCATION),
        teacherName: teacher.name,
        conflictReason: String(body.conflict_reason || ""),
        conflictNotify: assigneeIds.length
          ? {
            supabaseUrl,
            serviceKey,
            assigneeIds,
            itemNames: conflictItemNames,
          }
          : null,
        lines: rawLines.map((row) => ({
          itemId: String(row?.item_id || row?.id || ""),
          quantity: row?.quantity,
        })),
      });
      return jsonResponse({ data });
    }

    if (action === "return") {
      const teacher = await assertTeacherAccess(admin, body, pinSecret);
      const data = await returnItem(admin, {
        teacherId: teacher.id,
        itemId: String(body.item_id || ""),
        quantity: body.quantity,
        location: String(body.location || DEFAULT_LOCATION),
        teacherName: teacher.name,
      });
      return jsonResponse({ data });
    }

    if (action === "cancel_return") {
      const teacher = await assertTeacherAccess(admin, body, pinSecret);
      const data = await cancelReturnRequest(admin, {
        teacherId: teacher.id,
        returnId: String(body.return_id || ""),
        teacherName: teacher.name,
      });
      return jsonResponse({ data });
    }

    if (action === "extend") {
      const teacher = await assertTeacherAccess(admin, body, pinSecret);
      const rawIds = Array.isArray(body.item_ids)
        ? body.item_ids
        : (body.item_id ? [body.item_id] : []);
      const data = await extendHoldings(admin, {
        teacherId: teacher.id,
        itemIds: rawIds.map((id) => String(id || "")),
        weeks: body.weeks,
        teacherName: teacher.name,
      });
      return jsonResponse({ data });
    }

    return jsonError("UNKNOWN_ACTION", "Unknown action", 400);
  } catch (err) {
    const code = err?.code || "INTERNAL_ERROR";
    const status = code === "FORBIDDEN" ? 403
      : code === "QR_LOGIN_REQUIRED" ? 401
      : code === "VALIDATION_ERROR" || code === "PIN_NOT_SET" || code === "PIN_INVALID"
      || code === "INSUFFICIENT_STOCK" || code === "INSUFFICIENT_RETURNABLE" || code === "ITEM_NOT_FOUND"
      || code === "TEACHER_INACTIVE" || code === "ROTATION_BLOCKED" || code === "NOT_FOUND"
      ? (code === "PIN_INVALID" || code === "PIN_NOT_SET" ? 401 : 400)
      : 500;
    console.error("[kiosk]", { code, status });
    return jsonError(code, err?.message || "키오스크 요청 처리에 실패했습니다.", status, err?.field ? { field: err.field } : {});
  }
});
