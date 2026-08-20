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

async function loadCatalog(admin) {
  const [{ data: categories }, { data: items, error: iErr }, { data: ris }, { data: rets }] = await Promise.all([
    admin.from("gear_categories").select("id, label, color, icon, sort_order").order("sort_order"),
    // items 테이블에는 active 컬럼이 없음 — status (available | maintenance | retired)
    admin
      .from("items")
      .select("id, code, name, category, branch, total_quantity, photo_url, status")
      .eq("status", "available")
      .order("code"),
    admin.from("rental_items").select("id, item_id, quantity, status"),
    admin.from("return_requests").select("rental_item_id, quantity, status"),
  ]);
  if (iErr) throw iErr;
  const availableItems = (items || []).filter((it) => it.status === "available");
  const list = availableItems.map((it) => ({
    id: it.id,
    code: it.code,
    name: it.name,
    category: it.category,
    branch: it.branch,
    photo_url: it.photo_url || null,
    total_quantity: it.total_quantity,
    status: it.status,
    available: availQty(it, ris || [], rets || []),
  }));
  return {
    categories: categories || [],
    items: list,
    branches: BRANCHES,
  };
}

async function listTeachers(admin) {
  const { data, error } = await admin
    .from("teachers")
    .select("id, name, has_kiosk_pin, active, resigned_at, role")
    .order("name");
  if (error) throw error;
  return (data || [])
    .filter((t) => t.active !== false && !t.resigned_at && t.role !== "superadmin")
    .map((t) => ({
      id: t.id,
      name: t.name,
      has_kiosk_pin: Boolean(t.has_kiosk_pin),
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
}: {
  teacherId: string;
  lines: Array<{ itemId: string; quantity: number }>;
  location: string;
  teacherName: string;
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

  const catalog = await loadCatalog(admin);
  const resolved = [];
  for (const [itemId, qty] of qtyById.entries()) {
    const item = catalog.items.find((i) => i.id === itemId);
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

  const { data: req, error: reqErr } = await admin
    .from("rental_requests")
    .insert({
      teacher_id: teacherId,
      dispatch_location: loc,
      dispatch_start: start,
      dispatch_end: end,
      memo: "키오스크 대여",
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
    },
  });

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

    if (!devicePin) {
      return jsonError("DEVICE_PIN_MISSING", "키오스크 기기 PIN이 설정되지 않았습니다.", 500);
    }
    if (!pinSecret) {
      return jsonError("PIN_SECRET_MISSING", "키오스크 PIN 비밀키가 설정되지 않았습니다.", 500);
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

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

    const allowed = await requireDeviceAccess(body, req.headers, devicePin, pinSecret);
    if (!allowed) {
      return jsonError("DEVICE_LOCKED", "키오스크 기기 인증이 필요합니다.", 401);
    }

    if (action === "catalog") {
      const data = await loadCatalog(admin);
      return jsonResponse({ data });
    }

    if (action === "teachers") {
      const data = await listTeachers(admin);
      return jsonResponse({ data });
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
      const data = await loadTeacherWeekGear(admin, String(body.teacher_id || ""));
      return jsonResponse({ data });
    }

    if (action === "holdings") {
      const teacher = await assertTeacherPin(admin, String(body.teacher_id || ""), body.teacher_pin, pinSecret);
      const data = await teacherHoldings(admin, teacher.id);
      return jsonResponse({ data: { teacher: { id: teacher.id, name: teacher.name }, holdings: data } });
    }

    if (action === "rent") {
      const teacher = await assertTeacherPin(admin, String(body.teacher_id || ""), body.teacher_pin, pinSecret);
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
      const teacher = await assertTeacherPin(admin, String(body.teacher_id || ""), body.teacher_pin, pinSecret);
      const rawLines = Array.isArray(body.items) ? body.items : [];
      const data = await rentItemsBatch(admin, {
        teacherId: teacher.id,
        location: String(body.location || DEFAULT_LOCATION),
        teacherName: teacher.name,
        lines: rawLines.map((row) => ({
          itemId: String(row?.item_id || row?.id || ""),
          quantity: row?.quantity,
        })),
      });
      return jsonResponse({ data });
    }

    if (action === "return") {
      const teacher = await assertTeacherPin(admin, String(body.teacher_id || ""), body.teacher_pin, pinSecret);
      const data = await returnItem(admin, {
        teacherId: teacher.id,
        itemId: String(body.item_id || ""),
        quantity: body.quantity,
        location: String(body.location || DEFAULT_LOCATION),
        teacherName: teacher.name,
      });
      return jsonResponse({ data });
    }

    return jsonError("UNKNOWN_ACTION", "Unknown action", 400);
  } catch (err) {
    const code = err?.code || "INTERNAL_ERROR";
    const status = code === "VALIDATION_ERROR" || code === "PIN_NOT_SET" || code === "PIN_INVALID"
      || code === "INSUFFICIENT_STOCK" || code === "INSUFFICIENT_RETURNABLE" || code === "ITEM_NOT_FOUND"
      || code === "TEACHER_INACTIVE"
      ? (code === "PIN_INVALID" || code === "PIN_NOT_SET" ? 401 : 400)
      : 500;
    console.error("[kiosk]", { code, status });
    return jsonError(code, err?.message || "키오스크 요청 처리에 실패했습니다.", status, err?.field ? { field: err.field } : {});
  }
});
