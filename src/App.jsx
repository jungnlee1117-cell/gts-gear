// ═══════════════════════════════════════════════════════════════════════
// GTS 교구 대여 관리 시스템 v4 — 리디자인 버전
// ═══════════════════════════════════════════════════════════════════════

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Routes, Route, useNavigate, useLocation, Navigate } from "react-router-dom";
import {
  saveLastRoute,
  markRestoreAfterLogin,
  consumeRestoreAfterLogin,
  getLastRoute,
} from "./routePersistence.js";
import { createRoot } from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import { QRCodeCanvas } from "qrcode.react";
import { PersonStanding, MapPin, ChevronLeft, ChevronRight } from "lucide-react";
import GrowthApp from "./GrowthApp.jsx";
import ScheduleApp from "./ScheduleApp.jsx";
import PlatformMainButton from "./PlatformMainButton.jsx";
import PeResourcesApp from "./PeResourcesApp.jsx";
import EnglishScriptApp from "./EnglishScriptApp.jsx";
import GearScriptRegisterApp from "./GearScriptRegisterApp.jsx";
import SituationManualApp from "./SituationManualApp.jsx";
import ChildTypeApp from "./ChildTypeApp.jsx";
import ClassFlowTipsApp from "./ClassFlowTipsApp.jsx";
import LessonScriptBuilderApp from "./LessonScriptBuilderApp.jsx";
import LessonScriptDataAdminPage from "./LessonScriptDataAdminPage.jsx";
import PronunciationTipsApp from "./PronunciationTipsApp.jsx";
import PushNotificationPrompt from "./PushNotificationPrompt.jsx";
import { formatPushItemNames, sendPushEvent } from "./pushNotifications.js";
import MyGearRotationPage, {
  checkRotationRentalConflicts,
  earliestRotationConflictByItem,
  formatRotationConflictConfirmMessage,
  ymdAddDays,
} from "./MyGearRotationPage.jsx";
import GearRotationManagePage from "./GearRotationManagePage.jsx";
import GearCategoryManagePage from "./GearCategoryManagePage.jsx";
import { GearCategoriesProvider, useGearCategories } from "./GearCategoriesContext.jsx";
import {
  categoryMatchesFilter,
  getCategoryMeta,
  normalizeCategoryKey,
} from "./gearCategoryData.js";
import TeacherGearStatusSection from "./TeacherGearStatusSection.jsx";
import UnifiedNoticesFeed from "./UnifiedNoticesFeed.jsx";
import TeacherAccountsPage from "./TeacherAccountsPage.jsx";
import { getTeacherAccessBlock } from "./teacherResign.js";
import { loadUnifiedNoticeFeed } from "./unifiedNotices.js";
import {
  NOTICE_KIND_OPTIONS,
  deleteNoticeEventSchedule,
  formatEventSummary,
  kindToNoticeFields,
  noticeToKind,
  syncNoticeEventSchedule,
} from "./noticeEventSync.js";
import {
  EMPTY_NOTICE_AUDIENCE,
  NOTICE_AUDIENCE_OPTIONS,
  audienceBadgeTone,
  audienceLabel,
  noticeToAudience,
  selectableNoticeTeachers,
  validateNoticeAudience,
} from "./noticeAudience.js";
import {
  buildNoticeReadStats,
  fetchInstitutionTeacherIdMap,
  fetchMyNoticeReadIds,
  fetchNoticeReads,
  markNoticeAsRead,
  splitReadUnreadTeachers,
} from "./noticeReads.js";
import { isGearPlatformAdmin, isGearTeacher, isItemAdmin, isSuperAdmin, canPersonalGearRental } from "./authRoles.js";
import {
  RETURN_PHOTO_REQUIRED,
  compressReturnPhoto,
  uploadReturnPhoto,
  validateReturnLocationGroups,
} from "./returnPhoto.js";
import { useMediaQuery } from "./useMediaQuery.js";
import { isScheduleAdmin } from "./schedule/roles.js";
import { fetchInstitutions } from "./schedule/api.js";
import { EventScheduleFields, EMPTY_EVENT_FORM } from "./schedule/EventRegisterForm.jsx";
import { shouldForcePasswordChange } from "./authPolicy.js";
import { ddayKst, ddayKstAsOf, formatYmdShort, formatYmdWeekday, toKstDateOnly } from "./kstDate.js";
import {
  DUPLICATE_ITEM_NAME_MESSAGE,
  findItemNameConflict,
  isDuplicateItemNameError,
} from "./itemNames.js";
import { buildCurrentRentals, buildDueReturns } from "./teacherGearStatus.js";
import { fetchItemIdeas, insertItemIdea, toggleItemIdeaLike } from "./itemIdeas.js";
import DataExportPage from "./DataExportPage.jsx";

const GEAR_SCAN_KEY = "gts_gear_scan";

const SUPABASE_URL   = import.meta.env.VITE_SUPABASE_URL  || "https://YOUR.supabase.co";
const SUPABASE_ANON  = import.meta.env.VITE_SUPABASE_ANON_KEY || "YOUR_ANON_KEY";
const SUPER_ADMIN_ID = import.meta.env.VITE_SUPER_ADMIN_ID || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// ═══════════════════════════════════════════════════════════════════════
// 상수
// ═══════════════════════════════════════════════════════════════════════
const BRANCHES = ["사무실","엘리트코어","삼성점","한남점","나비에로"];

const DEFAULT_PHOTO_POSITION = "50% 50%";

const PHOTO_POSITION_PRESETS = {
  "center top": "50% 0%",
  "center center": "50% 50%",
  "center bottom": "50% 100%",
  "left center": "0% 50%",
  "right center": "100% 50%",
  "left top": "0% 0%",
  "right top": "100% 0%",
  "left bottom": "0% 100%",
  "right bottom": "100% 100%",
};

function parsePhotoPosition(pos) {
  if (!pos) return { x: 50, y: 50 };
  const pct = String(pos).match(/^(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/);
  if (pct) return { x: parseFloat(pct[1]), y: parseFloat(pct[2]) };
  const preset = PHOTO_POSITION_PRESETS[pos];
  if (preset) return parsePhotoPosition(preset);
  return { x: 50, y: 50 };
}

function formatPhotoPosition(x, y) {
  const clamp = (n) => Math.min(100, Math.max(0, Math.round(n)));
  return `${clamp(x)}% ${clamp(y)}%`;
}

function itemPhotoPosition(item) {
  const raw = item?.photo_position || DEFAULT_PHOTO_POSITION;
  const preset = PHOTO_POSITION_PRESETS[raw];
  return preset || raw;
}

function itemPhotoStyle(item, extra = {}) {
  return {
    objectFit: "cover",
    objectPosition: itemPhotoPosition(item),
    ...extra,
  };
}

function GearItemImg({ item, alt, style }) {
  if (!item?.photo_url) return null;
  return (
    <img
      src={item.photo_url}
      alt={alt ?? item.name}
      style={itemPhotoStyle(item, { width: "100%", height: "100%", ...style })}
    />
  );
}

function CategoryIconFallback({ category, size = 80 }) {
  const { categoryMap } = useGearCategories();
  const meta = getCategoryMeta(category, categoryMap);
  return (
    <span
      role="img"
      aria-label={meta.label}
      style={{
        fontSize: Math.round(size * 0.44),
        lineHeight: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        background: `${meta.color}20`,
      }}
    >
      {meta.icon}
    </span>
  );
}

/** 교구 목록 카드 썸네일 (80×80, cover / 카테고리 아이콘 폴백) */
function GearItemThumbnail({ item, size = 80 }) {
  const [imgFailed, setImgFailed] = useState(false);
  const showPhoto = Boolean(item?.photo_url) && !imgFailed;

  useEffect(() => {
    setImgFailed(false);
  }, [item?.id, item?.photo_url]);

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 14,
        overflow: "hidden",
        background: "#f8fafc",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "1px solid #e2e8f0",
      }}
    >
      {showPhoto ? (
        <img
          src={item.photo_url}
          alt={item.name}
          onError={() => setImgFailed(true)}
          style={itemPhotoStyle(item, { width: "100%", height: "100%" })}
        />
      ) : (
        <CategoryIconFallback category={item?.category} size={size} />
      )}
    </div>
  );
}

const ROLE_CFG = {
  superadmin: { label:"슈퍼관리자", bg:"#fef9c3", color:"#854d0e" },
  admin:      { label:"관리자",     bg:"#fee2e2", color:"#991b1b" },
  teacher:    { label:"선생님",     bg:"#ede9fe", color:"#5b21b6" },
};

const canManage    = (u) => isItemAdmin(u) && u?.active !== false;
const canEditItems = (u) => isItemAdmin(u);
// ═══════════════════════════════════════════════════════════════════════
const fmt   = d => {
  if (!d) return "-";
  const only = toKstDateOnly(d);
  if (only && String(d).trim().length <= 10) {
    const [y, m, day] = only.split("-");
    return `${Number(y)}.${Number(m)}.${Number(day)}`;
  }
  return new Date(d).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" });
};
const fmtdt = d => d ? new Date(d).toLocaleString("ko-KR") : "-";
const WEEK_MS = 7 * 86400000;

function isWithinLastWeek(dateStr) {
  if (!dateStr) return false;
  return Date.now() - new Date(dateStr).getTime() <= WEEK_MS;
}

function filterReturnPendingLastWeek(rets) {
  return (rets || []).filter(r => r.status === "return_pending" && isWithinLastWeek(r.created_at));
}

const NOTICES_STORAGE_KEY = "gts_notices";

const NOTICE_IMPORTANCE = {
  normal: { label: "일반", bg: "#f1f5f9", color: "#64748b" },
  important: { label: "공고", bg: "#fee2e2", color: "#dc2626" },
};

function normalizeNoticeImportance(value) {
  return value === "important" ? "important" : "normal";
}

async function fetchNotices() {
  const { data, error } = await supabase
    .from("notices")
    .select("*, institutions(id, name)")
    .order("created_at", { ascending: false });
  if (!error && data) return data;
  // institution_id 조인 미적용 DB 폴백
  const fallback = await supabase.from("notices").select("*").order("created_at", { ascending: false });
  if (!fallback.error && fallback.data) return fallback.data;
  try {
    return JSON.parse(localStorage.getItem(NOTICES_STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

async function persistNotice(notice, existing) {
  const row = {
    title: notice.title,
    body: notice.body,
    importance: normalizeNoticeImportance(notice.importance),
    notice_type: notice.notice_type || "general",
    institution_id: notice.institution_id || null,
    audience_type: notice.audience_type || "all",
    audience_teacher_ids: Array.isArray(notice.audience_teacher_ids)
      ? notice.audience_teacher_ids
      : [],
    event_date: notice.event_date || null,
    event_end_date: notice.event_end_date || null,
    exception_type: notice.exception_type || null,
    event_time: notice.event_time || null,
    event_location: notice.event_location || null,
    schedule_exception_ids: notice.schedule_exception_ids || [],
    author_id: notice.author_id,
    author_name: notice.author_name,
  };
  const { data, error } = await supabase.from("notices").insert(row).select("*, institutions(id, name)").single();
  if (error && /audience_type|audience_teacher_ids|institution_id|event_end_date|exception_type/i.test(error.message || "")) {
    const {
      institution_id, event_end_date, exception_type,
      audience_type, audience_teacher_ids,
      ...legacy
    } = row;
    const retry = await supabase.from("notices").insert(legacy).select("*").single();
    if (!retry.error && retry.data) {
      if (retry.data.notice_type === "event") {
        try {
          const ids = await syncNoticeEventSchedule({ ...retry.data, institution_id, event_end_date, exception_type });
          const refreshed = {
            ...retry.data,
            schedule_exception_ids: ids,
            institution_id,
            event_end_date,
            exception_type,
            audience_type,
            audience_teacher_ids,
          };
          return { list: [refreshed, ...existing], savedToDb: true, notice: refreshed };
        } catch (syncErr) {
          await supabase.from("notices").delete().eq("id", retry.data.id);
          throw syncErr;
        }
      }
      return {
        list: [{
          ...retry.data,
          institution_id,
          audience_type,
          audience_teacher_ids,
        }, ...existing],
        savedToDb: true,
        notice: { ...retry.data, institution_id, audience_type, audience_teacher_ids },
      };
    }
  }
  if (!error && data) {
    if (data.notice_type === "event") {
      try {
        const ids = await syncNoticeEventSchedule(data);
        const refreshed = { ...data, schedule_exception_ids: ids };
        return { list: [refreshed, ...existing], savedToDb: true, notice: refreshed };
      } catch (syncErr) {
        await supabase.from("notices").delete().eq("id", data.id);
        throw syncErr;
      }
    }
    return { list: [data, ...existing], savedToDb: true, notice: data };
  }
  const fallback = { ...notice, id: notice.id || crypto.randomUUID(), importance: normalizeNoticeImportance(notice.importance) };
  const next = [fallback, ...existing];
  localStorage.setItem(NOTICES_STORAGE_KEY, JSON.stringify(next));
  return { list: next, savedToDb: false, notice: fallback };
}

async function updateNoticeRecord(id, patch, existing) {
  const payload = {
    title: patch.title,
    body: patch.body ?? "",
    importance: normalizeNoticeImportance(patch.importance),
    notice_type: patch.notice_type || "general",
    institution_id: patch.institution_id || null,
    audience_type: patch.audience_type || "all",
    audience_teacher_ids: Array.isArray(patch.audience_teacher_ids)
      ? patch.audience_teacher_ids
      : [],
    event_date: patch.event_date || null,
    event_end_date: patch.event_end_date || null,
    exception_type: patch.exception_type || null,
    event_time: patch.event_time || null,
    event_location: patch.event_location || null,
    schedule_exception_ids: patch.schedule_exception_ids || [],
    updated_at: new Date().toISOString(),
  };
  let { data, error } = await supabase.from("notices").update(payload).eq("id", id).select("*, institutions(id, name)").single();
  if (error && /audience_type|audience_teacher_ids|institution_id|event_end_date|exception_type/i.test(error.message || "")) {
    const {
      institution_id, event_end_date, exception_type,
      audience_type, audience_teacher_ids,
      ...legacy
    } = payload;
    ({ data, error } = await supabase.from("notices").update(legacy).eq("id", id).select("*").single());
    if (!error && data) {
      data = { ...data, institution_id, event_end_date, exception_type, audience_type, audience_teacher_ids };
    }
  }
  if (!error && data) return existing.map(n => (n.id === id ? data : n));
  const next = existing.map(n => (
    n.id === id ? { ...n, ...payload } : n
  ));
  localStorage.setItem(NOTICES_STORAGE_KEY, JSON.stringify(next));
  return next;
}

async function removeNotice(id, existing) {
  const target = existing.find(n => n.id === id);
  if (target?.notice_type === "event") {
    try { await deleteNoticeEventSchedule(target); } catch { /* ignore */ }
  }
  const { error } = await supabase.from("notices").delete().eq("id", id);
  if (!error) return existing.filter(n => n.id !== id);
  const next = existing.filter(n => n.id !== id);
  localStorage.setItem(NOTICES_STORAGE_KEY, JSON.stringify(next));
  return next;
}

/** teachers + auth.users 이메일 (get_teachers_with_email RPC) */
async function fetchTeachers() {
  const { data, error } = await supabase.rpc("get_teachers_with_email");
  if (error) throw error;
  return data || [];
}

function dday(due) {
  return ddayKst(due);
}
function ddayTag(due) {
  const d = dday(due);
  if (d === null) return null;
  if (d < 0)   return { text:`D+${Math.abs(d)}`, color:"#dc2626", urgent:true };
  if (d === 0) return { text:"D-Day",             color:"#dc2626", urgent:true };
  if (d <= 3)  return { text:`D-${d}`,            color:"#ea580c", urgent:true };
  return             { text:`D-${d}`,             color:"#64748b", urgent:false };
}
function returnApprovedQty(riId, rets) {
  return (rets || []).filter(r => r.rental_item_id === riId && r.status === "return_approved")
    .reduce((s, r) => s + r.quantity, 0);
}
function returnPendingQty(riId, rets) {
  return (rets || []).filter(r => r.rental_item_id === riId && r.status === "return_pending")
    .reduce((s, r) => s + r.quantity, 0);
}
function heldQtyForRi(ri, rets = []) {
  if (!["rented", "partial_returned"].includes(ri.status)) return 0;
  return Math.max(0, ri.quantity - returnApprovedQty(ri.id, rets));
}
function returnableQtyForRi(ri, rets = []) {
  const held = heldQtyForRi(ri, rets);
  return Math.max(0, held - returnPendingQty(ri.id, rets));
}
function rentedQty(iid, ris, rets = []) {
  return ris
    .filter(r => r.item_id === iid && ["rented", "partial_returned"].includes(r.status))
    .reduce((s, r) => s + heldQtyForRi(r, rets), 0);
}
function pendingQty(iid, ris) {
  return ris.filter(r => r.item_id === iid && r.status === "pending").reduce((s, r) => s + r.quantity, 0);
}

function getTeacherPendingReservation(reservations, teacherId, itemId) {
  return (reservations || []).find(
    r => r.teacher_id === teacherId && r.item_id === itemId && r.status === "pending"
  );
}

function reservationDisplayStatus(res) {
  if (res.status === "pending") return "pending";
  if (res.status === "confirmed") {
    return res.start_date > todayYmd() ? "reserved" : "rented";
  }
  if (res.status === "cancelled" && res.rejection_reason) return "rejected";
  return "cancelled";
}

function reservationLifecycleStatus(res, ris = [], rets = [], currentYmd = todayYmd()) {
  if (res.status !== "confirmed") return reservationDisplayStatus(res);

  const related = ris.filter(ri => ri.request_id === res.rental_request_id);
  const pendingReturn = related.some(ri =>
    rets.some(ret => ret.rental_item_id === ri.id && ret.status === "return_pending")
  );
  if (pendingReturn) return "return_pending";

  const returned = related.length > 0 && related.every(ri =>
    ri.status === "returned" || returnApprovedQty(ri.id, rets) >= ri.quantity
  );
  if (returned) return "returned";

  return res.start_date > currentYmd ? "reserved" : "rented";
}

function fmtShort(d) {
  if (!d) return "-";
  return formatYmdShort(d);
}

function fmtDateWeekday(d) {
  if (!d) return "-";
  return formatYmdWeekday(d);
}

function assigneeAvatarColor(name) {
  const palette = ["#16a34a", "#7c3aed", "#ea580c", "#2563eb", "#db2777", "#0891b2"];
  let h = 0;
  const s = String(name || "?");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

function parseLocalDay(value) {
  if (!value) return null;
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return null;
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

function todayLocalDay() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function todayYmd() {
  return toDateInputValue(todayLocalDay());
}

function useTodayYmd() {
  const [value, setValue] = useState(todayYmd);

  useEffect(() => {
    const refresh = () => setValue(todayYmd());
    const timer = window.setInterval(refresh, 60 * 1000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  return value;
}

function hasRentalStarted(req, currentYmd = todayYmd()) {
  if (!req?.dispatch_start) return true;
  return req.dispatch_start <= currentYmd;
}

function addDaysYmd(ymd, days) {
  const [y, m, d] = String(ymd || "").split("-").map(Number);
  if (!y || !m || !d) return "";
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return toDateInputValue(dt);
}

function defaultRentalDates() {
  const dispatch_start = todayYmd();
  return { dispatch_start, dispatch_end: addDaysYmd(dispatch_start, 7) };
}

function selectInputOnFocus(e) {
  e.target.select();
}

function clampQuantity(n, { min = 1, max } = {}) {
  let v = Number(n);
  if (!Number.isFinite(v)) return min;
  v = Math.floor(v);
  if (v < min) return min;
  if (max != null && v > max) return max;
  return v;
}

/** blur/submit 시에만 min·max 적용 (입력 중에는 draft 문자열 유지) */
function commitQuantityDraft(raw, { min = 1, max } = {}) {
  const cleaned = String(raw).replace(/\D/g, "");
  if (!cleaned) return min;
  const n = parseInt(cleaned, 10);
  if (Number.isNaN(n)) return min;
  return clampQuantity(n, { min, max });
}

function parseQuantityValue(raw, { min = 1, max } = {}) {
  return commitQuantityDraft(raw, { min, max });
}

const qtyStepBtn = {
  flex: "0 0 44px",
  width: 44,
  minHeight: 44,
  padding: 0,
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  color: "#334155",
  fontSize: 18,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
  lineHeight: 1,
};

function QuantityInput({
  value,
  onChange,
  min = 1,
  max,
  disabled = false,
  style,
  inputStyle,
}) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(() => String(value ?? min));

  useEffect(() => {
    if (!focused) setDraft(String(value ?? min));
  }, [value, focused, min]);

  const displayMax = max ?? null;
  const atMin = (value ?? min) <= min;
  const atMax = displayMax != null && (value ?? min) >= displayMax;

  const commit = (raw) => {
    const next = commitQuantityDraft(raw, { min, max: displayMax });
    onChange(next);
    return next;
  };

  const step = (delta) => {
    const base = focused ? commitQuantityDraft(draft, { min, max: displayMax }) : (value ?? min);
    const next = clampQuantity(base + delta, { min, max: displayMax });
    setDraft(String(next));
    onChange(next);
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        width: "100%",
        ...style,
      }}
    >
      <button
        type="button"
        aria-label="수량 줄이기"
        disabled={disabled || atMin}
        onClick={() => step(-1)}
        style={{
          ...qtyStepBtn,
          borderRadius: "10px 0 0 10px",
          opacity: disabled || atMin ? 0.45 : 1,
          cursor: disabled || atMin ? "not-allowed" : "pointer",
        }}
      >
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        disabled={disabled}
        value={focused ? draft : String(value ?? min)}
        onFocus={(e) => {
          setFocused(true);
          setDraft(String(value ?? min));
          selectInputOnFocus(e);
        }}
        onBlur={() => {
          setFocused(false);
          const next = commit(draft);
          setDraft(String(next));
        }}
        onChange={(e) => {
          setDraft(e.target.value.replace(/\D/g, ""));
        }}
        style={{
          ...inp,
          flex: 1,
          minWidth: 0,
          minHeight: 44,
          textAlign: "center",
          borderRadius: 0,
          borderLeft: "none",
          borderRight: "none",
          padding: "9px 8px",
          fontSize: 14,
          ...(inputStyle || {}),
        }}
      />
      <button
        type="button"
        aria-label="수량 늘리기"
        disabled={disabled || atMax}
        onClick={() => step(+1)}
        style={{
          ...qtyStepBtn,
          borderRadius: "0 10px 10px 0",
          opacity: disabled || atMax ? 0.45 : 1,
          cursor: disabled || atMax ? "not-allowed" : "pointer",
        }}
      >
        +
      </button>
    </div>
  );
}

function getScheduleTiming(start, end) {
  const today = todayLocalDay();
  const s = parseLocalDay(start);
  const e = parseLocalDay(end);
  if (!s || !e) return null;
  if (e < today) return "past";
  if (s > today) return "future";
  return "current";
}

function scheduleSortRank(entry) {
  const { timing, kind } = entry;
  if (timing === "current" && kind === "rental") return 0;
  if (timing === "future" && kind === "confirmed") return 1;
  if (timing === "future" && kind === "pending") return 2;
  if (timing === "current" && kind === "confirmed") return 3;
  if (timing === "current" && kind === "pending") return 4;
  if (timing === "future" && kind === "rental") return 5;
  return 99;
}

function scheduleLineColor(line) {
  if (line.type === "confirmed") return "#0d9488";
  if (line.timing === "future") return "#2563eb";
  if (line.type === "rental") return "#ea580c";
  return "#2563eb";
}

function buildItemScheduleLines(itemId, { ris, rets, reqs, reservations, teachers }) {
  const entries = [];
  const confirmedReqIds = new Set();

  (reservations || []).forEach(res => {
    if (res.item_id !== itemId) return;
    if (!["pending", "confirmed"].includes(res.status)) return;
    const timing = getScheduleTiming(res.start_date, res.end_date);
    if (!timing || timing === "past") return;
    if (res.status === "confirmed" && res.rental_request_id) {
      confirmedReqIds.add(res.rental_request_id);
    }
    const name = tname(res.teacher_id, teachers);
    const qty = res.quantity || 1;
    const kind = res.status === "confirmed" ? "confirmed" : "pending";
    let statusLabel;
    if (res.status === "confirmed") {
      statusLabel = timing === "future" ? "예약 중" : "대여 중";
    } else {
      statusLabel = timing === "future" ? "예약 대기" : "승인 대기";
    }
    entries.push({
      teacherId: res.teacher_id,
      start: res.start_date,
      end: res.end_date,
      timing,
      priority: res.status === "confirmed" ? 3 : 2,
      kind,
      sortAt: res.created_at || res.start_date,
      key: `res-${res.id}`,
      type: res.status === "confirmed" && timing === "current"
        ? "rental"
        : (res.status === "confirmed" ? "confirmed" : "reservation"),
      text: `${name} 선생님 ${statusLabel} ${qty}개 (${fmtShort(res.start_date)} ~ ${fmtShort(res.end_date)})`,
    });
  });

  (ris || []).forEach(ri => {
    if (ri.item_id !== itemId) return;
    if (!["rented", "partial_returned"].includes(ri.status)) return;
    const held = heldQtyForRi(ri, rets);
    if (held <= 0) return;
    const req = (reqs || []).find(r => r.id === ri.request_id);
    if (req?.id && confirmedReqIds.has(req.id)) return;

    const start = req?.dispatch_start || ri.approved_at;
    const end = req?.dispatch_end || ri.due_date;
    const timing = getScheduleTiming(start, end);
    if (!timing || timing === "past") return;

    const teacherId = req?.teacher_id || `ri-${ri.id}`;
    const name = req ? tname(req.teacher_id, teachers) : "-";
    const statusLabel = timing === "future" ? "예정" : "대여중";

    entries.push({
      teacherId,
      start,
      end,
      timing,
      priority: 1,
      kind: "rental",
      sortAt: ri.approved_at || ri.created_at || start,
      key: `rent-${ri.id}`,
      type: "rental",
      text: `${name} 선생님 ${statusLabel} ${held}개 (${fmtShort(start)} ~ ${fmtShort(end)})`,
    });
  });

  const byTeacher = new Map();
  entries.forEach(entry => {
    const existing = byTeacher.get(entry.teacherId);
    if (!existing) {
      byTeacher.set(entry.teacherId, entry);
      return;
    }
    if (entry.priority > existing.priority) {
      byTeacher.set(entry.teacherId, entry);
      return;
    }
    if (entry.priority === existing.priority) {
      const entryTime = new Date(entry.sortAt || 0).getTime();
      const existingTime = new Date(existing.sortAt || 0).getTime();
      if (entryTime > existingTime) {
        byTeacher.set(entry.teacherId, entry);
      }
    }
  });

  return [...byTeacher.values()]
    .sort((a, b) => {
      const rankDiff = scheduleSortRank(a) - scheduleSortRank(b);
      if (rankDiff !== 0) return rankDiff;
      return a.text.localeCompare(b.text, "ko");
    })
    .map(({ key, text, type, timing }) => ({ key, text, type, timing }));
}

function ItemScheduleLines({ lines }) {
  if (!lines?.length) return null;
  return (
    <div style={{ marginBottom: 10, display: "flex", flexDirection: "column", gap: 4 }}>
      {lines.map(line => (
        <div
          key={line.key}
          style={{
            fontSize: 12,
            color: scheduleLineColor(line),
            lineHeight: 1.45,
          }}
        >
          {line.text}
        </div>
      ))}
    </div>
  );
}

function availQty(item, ris, rets = []) {
  return Math.max(0, item.total_quantity - rentedQty(item.id, ris, rets) - pendingQty(item.id, ris));
}
function availQtyForRentalEdit(item, ris, rets, currentPendingQty = 0) {
  return availQty(item, ris, rets) + (currentPendingQty || 0);
}
function toDateInputValue(value) {
  if (!value) return "";
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return raw.slice(0, 10);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function buildTeacherHoldingsByItem(me, reqs, ris, items, rets) {
  const currentYmd = todayYmd();
  const activeRis = ris.filter(ri => {
    const req = reqs.find(r => r.id === ri.request_id);
    return req?.teacher_id === me.id
      && hasRentalStarted(req, currentYmd)
      && ["rented", "partial_returned"].includes(ri.status);
  });

  const byItem = new Map();
  for (const ri of activeRis) {
    const held = heldQtyForRi(ri, rets);
    if (held <= 0) continue;
    const pendingRet = returnPendingQty(ri.id, rets);
    const returnable = returnableQtyForRi(ri, rets);
    const req = reqs.find(r => r.id === ri.request_id);

    if (!byItem.has(ri.item_id)) {
      byItem.set(ri.item_id, {
        item_id: ri.item_id,
        item: items.find(i => i.id === ri.item_id),
        totalHeld: 0,
        totalReturnable: 0,
        totalPendingReturn: 0,
        lines: [],
      });
    }
    const group = byItem.get(ri.item_id);
    group.totalHeld += held;
    group.totalReturnable += returnable;
    group.totalPendingReturn += pendingRet;
    group.lines.push({ ri, held, returnable, pendingRet, req, due_date: ri.due_date });
  }

  return [...byItem.values()].sort((a, b) => (a.item?.name || "").localeCompare(b.item?.name || "", "ko"));
}
function tname(id,ts)        { return ts.find(t=>t.id===id)?.name || "-"; }
function iname(id,items)     { return items.find(i=>i.id===id)?.name || "-"; }

function nextItemCode(category, items, { excludeId } = {}) {
  const prefix = category;
  const re = new RegExp(`^${prefix}-(\\d+)$`, "i");
  let max = 0;
  (items || []).forEach(i => {
    if (excludeId && i.id === excludeId) return;
    const m = i.code?.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

function sanitizeItemCode(code) {
  return (code || "").trim().replace(/[^a-zA-Z0-9_-]/g, "_");
}

function itemQrStoragePath(code) {
  return `qr/${sanitizeItemCode(code)}.png`;
}

function itemQrPayload(item) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const path = typeof window !== "undefined" ? (window.location.pathname || "/") : "/";
  const base = `${origin}${path}`;
  if (item?.id) return `${base}?gear_id=${encodeURIComponent(item.id)}`;
  const code = (item?.code || item || "").toString().trim();
  if (code) return `${base}?gear_item=${encodeURIComponent(code)}`;
  return base;
}

function parseGearScanFromLocation() {
  if (typeof window === "undefined") return null;
  const p = new URLSearchParams(window.location.search);
  const gear_id = p.get("gear_id");
  const gear_item = p.get("gear_item");
  if (!gear_id && !gear_item) return null;
  return { gear_id: gear_id || null, gear_item: gear_item || null };
}

function saveGearScan(scan) {
  if (scan && typeof sessionStorage !== "undefined") {
    sessionStorage.setItem(GEAR_SCAN_KEY, JSON.stringify(scan));
  }
}

function peekGearScan() {
  try {
    const raw = sessionStorage.getItem(GEAR_SCAN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function consumeGearScan() {
  const scan = peekGearScan();
  if (scan) sessionStorage.removeItem(GEAR_SCAN_KEY);
  return scan;
}

function clearGearScanUrl() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has("gear_id") && !url.searchParams.has("gear_item")) return;
  url.searchParams.delete("gear_id");
  url.searchParams.delete("gear_item");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

function findItemByScan(items, scan) {
  if (!scan || !items?.length) return null;
  if (scan.gear_id) return items.find(i => i.id === scan.gear_id) || null;
  if (scan.gear_item) {
    const code = scan.gear_item.trim();
    return items.find(i => i.code === code || i.code?.toLowerCase() === code.toLowerCase()) || null;
  }
  return null;
}

function parseQrScanText(text) {
  if (!text?.trim()) return null;
  const raw = text.trim();
  try {
    const url = new URL(raw);
    const gear_id = url.searchParams.get("gear_id");
    const gear_item = url.searchParams.get("gear_item");
    if (gear_id || gear_item) return { gear_id: gear_id || null, gear_item: gear_item || null };
  } catch {
    /* not a URL */
  }
  if (/^https?:\/\//i.test(raw)) {
    const q = raw.split("?")[1];
    if (q) {
      const p = new URLSearchParams(q);
      const gear_id = p.get("gear_id");
      const gear_item = p.get("gear_item");
      if (gear_id || gear_item) return { gear_id: gear_id || null, gear_item: gear_item || null };
    }
  }
  return { gear_id: null, gear_item: raw };
}

function getItemQrPublicUrl(code, qrUrl) {
  if (qrUrl) return qrUrl;
  if (!code?.trim()) return null;
  return supabase.storage.from("item-photos").getPublicUrl(itemQrStoragePath(code)).data.publicUrl;
}

async function qrValueToDataUrl(value, size = 220) {
  if (!value || typeof document === "undefined") return null;
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-9999px;top:0;pointer-events:none";
  document.body.appendChild(host);
  const root = createRoot(host);
  return new Promise((resolve, reject) => {
    const finish = (canvas) => {
      try {
        resolve(canvas.toDataURL("image/png"));
      } catch (e) {
        reject(e);
      } finally {
        root.unmount();
        host.remove();
      }
    };
    const timer = setTimeout(() => {
      root.unmount();
      host.remove();
      reject(new Error("QR 생성 시간 초과"));
    }, 4000);
    root.render(
      <QRCodeCanvas
        value={value}
        size={size}
        level="M"
        marginSize={1}
        bgColor="#ffffff"
        fgColor="#111827"
        ref={(node) => {
          if (!node) return;
          const canvas = node.querySelector?.("canvas") ?? node;
          if (canvas?.toDataURL) {
            clearTimeout(timer);
            requestAnimationFrame(() => finish(canvas));
          }
        }}
      />
    );
  });
}

function dataUrlToBlob(dataUrl) {
  const [meta, b64] = dataUrl.split(",");
  const mime = meta.match(/:(.*?);/)?.[1] || "image/png";
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

async function uploadItemQrImage(code, dataUrl) {
  const path = itemQrStoragePath(code);
  const { error } = await supabase.storage
    .from("item-photos")
    .upload(path, dataUrlToBlob(dataUrl), { upsert: true, contentType: "image/png" });
  if (error) {
    console.warn("QR upload failed:", error.message);
    return null;
  }
  return supabase.storage.from("item-photos").getPublicUrl(path).data.publicUrl;
}

async function createItemQr(item) {
  const row = typeof item === "string" ? { code: item } : item;
  if (!row?.code?.trim()) return null;
  const dataUrl = await qrValueToDataUrl(itemQrPayload(row));
  if (!dataUrl) return null;
  return uploadItemQrImage(row.code.trim(), dataUrl) || dataUrl;
}

function GearQrDisplay({ item, size = 160, style }) {
  const value = itemQrPayload(item);
  if (!value) return null;
  return (
    <QRCodeCanvas
      value={value}
      size={size}
      level="M"
      marginSize={1}
      bgColor="#ffffff"
      fgColor="#111827"
      style={style}
    />
  );
}

const FORCE_RETURN_MEMO = "강제 반납 (관리자 처리)";

function buildItemRentalHistory(itemId, ris, reqs, teachers, rets) {
  return ris
    .filter(ri => ri.item_id === itemId)
    .map(ri => {
      const req = reqs.find(r => r.id === ri.request_id);
      const forceRet = (rets || [])
        .filter(r => r.rental_item_id === ri.id && r.status === "return_approved" && (r.memo || "").includes("강제 반납"))
        .sort((a, b) => new Date(b.approved_at || 0) - new Date(a.approved_at || 0))[0];
      return {
        ...ri,
        req,
        teacherName: req ? tname(req.teacher_id, teachers) : "-",
        location: req?.dispatch_location || "-",
        start: req?.dispatch_start,
        end: req?.dispatch_end,
        sortAt: ri.approved_at || ri.created_at || req?.created_at || "",
        forceReturn: forceRet || null,
        forceReturnBy: forceRet ? tname(forceRet.approved_by, teachers) : null,
        forceReturnAt: forceRet?.approved_at || null,
      };
    })
    .sort((a, b) => new Date(b.sortAt) - new Date(a.sortAt));
}

function getDueAlerts(ris, reqs, items, teachers) {
  return ris
    .filter(ri => ["rented", "partial_returned"].includes(ri.status) && ri.due_date)
    .map(ri => {
      const d = dday(ri.due_date);
      const req = reqs.find(r => r.id === ri.request_id);
      return {
        ri,
        d,
        req,
        itemName: iname(ri.item_id, items),
        teacher: req ? tname(req.teacher_id, teachers) : "-",
        dueDate: ri.due_date,
      };
    })
    .filter(x => x.d !== null && x.d <= 3)
    .sort((a, b) => a.d - b.d);
}

// ── 대여 연장 (반납 임박/연체 교구) ─────────────────────────────
/** 연장 가능 최대 횟수 (한도 도달 시 연장 불가) */
const MAX_RENTAL_EXTENSIONS = 5;

/** 연장 기간 선택지 */
const EXTENSION_PERIOD_OPTIONS = [
  { weeks: 1, label: "1주" },
  { weeks: 2, label: "2주" },
];

function extensionCountOf(ri) {
  return Number(ri?.extension_count || 0);
}

function toLocalYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 현재 반납예정일 기준으로 weeks 만큼 연장한 새 날짜(YYYY-MM-DD).
 *  연체된 경우 오늘 기준으로, 미래인 경우 기존 예정일 기준으로 연장. */
function computeExtendedDueDate(currentDue, weeks) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const base = currentDue ? new Date(currentDue) : today;
  if (Number.isNaN(base.getTime())) return null;
  const from = base > today ? base : today;
  const next = new Date(from);
  next.setDate(next.getDate() + weeks * 7);
  return toLocalYMD(next);
}

/** 로그인 강사가 보유 중이면서 반납 기한이 임박(D-3 이내)하거나 지난 교구 목록 */
function getExtensionCandidates(me, reqs, ris, items, rets) {
  const groups = buildTeacherHoldingsByItem(me, reqs, ris, items, rets);
  const out = [];
  for (const g of groups) {
    for (const line of g.lines) {
      const d = dday(line.due_date);
      if (d === null || d > 3) continue;
      out.push({
        ri: line.ri,
        itemName: g.item?.name || iname(line.ri.item_id, items),
        location: line.req?.dispatch_location || "-",
        due_date: line.due_date,
        dday: d,
        held: line.held,
        extCount: extensionCountOf(line.ri),
      });
    }
  }
  return out.sort((a, b) => a.dday - b.dday);
}

const SC = {
  pending:          {l:"대여신청",  bg:"#fef3c7",c:"#d97706"},
  approved:         {l:"승인됨",    bg:"#dbeafe",c:"#2563eb"},
  rejected:         {l:"거절됨",    bg:"#fee2e2",c:"#dc2626"},
  rented:           {l:"대여중",    bg:"#ede9fe",c:"#7c3aed"},
  partial_returned: {l:"일부반납",  bg:"#ffedd5",c:"#ea580c"},
  returned:         {l:"반납완료",  bg:"#dcfce7",c:"#16a34a"},
  partial:          {l:"진행중",    bg:"#dbeafe",c:"#2563eb"},
  completed:        {l:"완료",      bg:"#dcfce7",c:"#16a34a"},
  return_pending:   {l:"반납 승인 대기", bg:"#fef9c3",c:"#ca8a04"},
  return_approved:  {l:"반납완료",  bg:"#dcfce7",c:"#16a34a"},
  damage_confirmed: {l:"파손확인",  bg:"#fee2e2",c:"#dc2626"},
  loss_confirmed:   {l:"분실확인",  bg:"#fce7f3",c:"#be185d"},
  cancelled:        {l:"취소됨",    bg:"#f1f5f9",c:"#64748b"},
};
const RSC = {
  pending:   { l: "대기", bg: "#fef3c7", c: "#d97706" },
  confirmed: { l: "승인", bg: "#dcfce7", c: "#16a34a" },
  reserved:  { l: "예약 중", bg: "#dbeafe", c: "#2563eb" },
  rented:    { l: "대여 중", bg: "#dcfce7", c: "#16a34a" },
  return_pending: { l: "반납 신청", bg: "#fef2f2", c: "#dc2626" },
  returned:  { l: "반납 완료", bg: "#f1f5f9", c: "#64748b" },
  rejected:  { l: "거절", bg: "#fee2e2", c: "#dc2626" },
  cancelled: { l: "취소", bg: "#f1f5f9", c: "#64748b" },
};
const CC = {
  normal:   {l:"정상",    c:"#16a34a"},
  damaged:  {l:"파손",    c:"#dc2626"},
  lost:     {l:"분실",    c:"#be185d"},
  shortage: {l:"수량부족",c:"#ea580c"},
};

// ═══════════════════════════════════════════════════════════════════════
// 글로벌 스타일 상수
// ═══════════════════════════════════════════════════════════════════════
const DS = {
  sidebar: {
    bg: "#ffffff",
    border: "1px solid #e2e8f0",
    text: "#1e293b",
    muted: "#94a3b8",
    activeBg: "#f0fdf4",
    activeBorder: "#16a34a",
    activeText: "#15803d",
  },
  pageBg: "#f8fafc",
  card: {
    bg: "#ffffff",
    border: "1px solid #e2e8f0",
    radius: 12,
    shadow: "0 1px 3px rgba(0,0,0,0.04)",
    shadowHover: "0 2px 8px rgba(0,0,0,0.06)",
  },
  primary: "#16a34a",
  primaryHover: "#15803d",
  primaryLight: "#f0fdf4",
  primaryText: "#15803d",
  textPrimary: "#0f172a",
  textSecondary: "#64748b",
  textMuted: "#94a3b8",
  inputBorder: "#e2e8f0",
  inputFocusBorder: "#16a34a",
  inputBg: "#f8fafc",
};

const RETURN_THEME = {
  primary: "#EF4444",
  hover: "#DC2626",
  light: "#FEF2F2",
  border: "#FECACA",
  text: "#B91C1C",
};

const DARK_SB = {
  bg: "#111827",
  border: "none",
  text: "rgba(255,255,255,0.55)",
  muted: "rgba(255,255,255,0.32)",
  activeBg: "#16a34a",
  activeText: "#ffffff",
  profileBg: "rgba(255,255,255,0.06)",
  profileBorder: "rgba(255,255,255,0.1)",
};

function GtsHexLogo({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden>
      <path d="M20 2L35 11v18L20 38 5 29V11L20 2z" fill="#16a34a"/>
      <path d="M20 8l10 6v12L20 32 10 26V14l10-6z" fill="#14532d" opacity="0.35"/>
      <text x="20" y="25" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="800" fontFamily="system-ui,sans-serif">G</text>
    </svg>
  );
}

const GTS_LOGO_SRC = "/gts-logo.png";

function GtsLogo({ height = 36, style }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <GtsHexLogo size={height} />;
  return (
    <img
      src={GTS_LOGO_SRC}
      alt="GTS"
      onError={() => setFailed(true)}
      style={{
        height,
        width: "auto",
        maxWidth: height * 2.6,
        objectFit: "contain",
        display: "block",
        flexShrink: 0,
        ...style,
      }}
    />
  );
}

function NavGlyph({ id, color = "currentColor", size = 18 }) {
  const s = { width: size, height: size, stroke: color, fill: "none", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
  if (id === "dashboard") return <svg {...s} viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
  if (id === "rental-status") return <svg {...s} viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
  if (id === "items") return <svg {...s} viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>;
  if (id === "items-browse") return <svg {...s} viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></svg>;
  if (id === "rentals" || id === "rental-return") return <svg {...s} viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>;
  if (id === "accounts") return <svg {...s} viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M6 20v-1a6 6 0 0 1 12 0v1"/></svg>;
  if (id === "institutions") return <svg {...s} viewBox="0 0 24 24"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/><path d="M9 9v.01"/><path d="M9 12v.01"/><path d="M9 15v.01"/><path d="M9 18v.01"/></svg>;
  if (id === "stats") return <svg {...s} viewBox="0 0 24 24"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>;
  if (id === "report") return <svg {...s} viewBox="0 0 24 24"><path d="M5 21V7"/><path d="M12 21V3"/><path d="M19 21V9"/></svg>;
  if (id === "notices") return <svg {...s} viewBox="0 0 24 24"><path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3z"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
  if (id === "settings") return <svg {...s} viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>;
  if (id === "data-export") return <svg {...s} viewBox="0 0 24 24"><path d="M12 3v12"/><path d="M8 11l4 4 4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>;
  if (id === "overdue") return <svg {...s} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>;
  if (id === "returns-approval") return <svg {...s} viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>;
  if (id === "rental-approval") return <svg {...s} viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="m9 15 2 2 4-4"/></svg>;
  if (id === "items-qr") return <svg {...s} viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h2v2h-2zM18 14h3v3h-3zM14 18h2v3h-2zM18 18h3v3h-3z"/></svg>;
  if (id === "qr-scan") return <svg {...s} viewBox="0 0 24 24"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/></svg>;
  if (id === "my-rental-status") return <svg {...s} viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
  if (id === "my-reservations") return <svg {...s} viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>;
  if (id === "english-script") return <svg {...s} viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M8 7h8M8 11h6"/></svg>;
  if (id === "pe-resources") return <svg {...s} viewBox="0 0 24 24"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 4 3 6 3s6-1 6-3v-5"/></svg>;
  if (id === "video-resources") return <svg {...s} viewBox="0 0 24 24"><rect x="2" y="5" width="15" height="14" rx="2"/><path d="M17 9l5-3v12l-5-3"/></svg>;
  if (id === "rental-manage") return <svg {...s} viewBox="0 0 24 24"><path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="M16 21h5v-5"/><path d="M8 21H3v-5"/><path d="M21 12H3"/></svg>;
  if (id === "my-gear-rotation") return <svg {...s} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l3 2"/></svg>;
  if (id === "gear-rotation-manage") return <svg {...s} viewBox="0 0 24 24"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/><circle cx="12" cy="12" r="3"/></svg>;
  if (id === "more") return <svg {...s} viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.2" fill={color} stroke="none"/><circle cx="12" cy="12" r="1.2" fill={color} stroke="none"/><circle cx="19" cy="12" r="1.2" fill={color} stroke="none"/></svg>;
  return <svg {...s} viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/></svg>;
}

function isNavPageActive(page, navId) {
  const aliases = {
    items: ["items", "item-detail"],
    "items-browse": ["items-browse"],
    "my-gear-rotation": ["my-gear-rotation", "item-detail"],
    gear: ["items", "item-detail", "items-register", "items-qr", "gear-rotation-manage"],
    rental: ["rental-approval", "rental-status", "returns-approval", "overdue", "reservation-approval"],
    "rental-manage": ["rental-approval", "rental-status", "returns-approval", "overdue", "rental-manage", "rentals"],
    "rental-return": ["rental-return", "rentals", "my-rental-status", "return-request"],
    "return-request": ["return-request", "my-rental-status"],
    "my-rental-status": ["my-rental-status", "return-request"],
  };
  if (page === navId) return true;
  return (aliases[navId] || []).includes(page);
}

function buildSidebarNav(me) {
  const superA = isSuperAdmin(me);
  const admin = isItemAdmin(me) && !superA;

  if (superA) {
    return [
      { type: "item", id: "notices", label: "공지사항", glyph: "notices" },
      { type: "item", id: "dashboard", label: "대시보드", glyph: "dashboard" },
      { type: "item", id: "my-gear-rotation", label: "이번 달 내 교구", glyph: "my-gear-rotation" },
      { type: "item", id: "items-browse", label: "교구 둘러보기", glyph: "items-browse" },
      { type: "item", id: "rental-return", label: "내 대여·반납", glyph: "rental-return" },
      {
        type: "group", id: "gear", label: "교구관리", glyph: "items",
        children: [
          { id: "items", label: "전체교구" },
          { id: "items-register", label: "교구등록" },
          { id: "gear-categories", label: "카테고리 관리" },
          { id: "gear-rotation-manage", label: "순환 교구 관리" },
          { id: "items-qr", label: "QR관리" },
        ],
      },
      {
        type: "group", id: "rental", label: "대여관리", glyph: "rental-manage",
        children: [
          { id: "rental-status", label: "대여현황" },
          { id: "rental-approval", label: "대여승인" },
          { id: "returns-approval", label: "반납승인" },
          { id: "reservation-approval", label: "예약승인" },
          { id: "overdue", label: "연체관리" },
        ],
      },
      { type: "item", id: "accounts", label: "선생님관리", glyph: "accounts" },
      { type: "item", id: "stats", label: "통계", glyph: "stats" },
      { type: "item", id: "report", label: "리포트", glyph: "report" },
      { type: "item", id: "data-export", label: "데이터 내보내기", glyph: "data-export" },
      { type: "item", id: "settings", label: "설정", glyph: "settings" },
    ];
  }

  if (admin) {
    return [
      { type: "item", id: "notices", label: "공지사항", glyph: "notices" },
      { type: "item", id: "dashboard", label: "대시보드", glyph: "dashboard" },
      { type: "item", id: "my-gear-rotation", label: "이번 달 내 교구", glyph: "my-gear-rotation" },
      { type: "item", id: "items-browse", label: "교구 둘러보기", glyph: "items-browse" },
      { type: "item", id: "rental-return", label: "내 대여·반납", glyph: "rental-return" },
      { type: "item", id: "items", label: "교구관리", glyph: "items" },
      { type: "item", id: "gear-categories", label: "카테고리 관리", glyph: "items" },
      { type: "item", id: "gear-rotation-manage", label: "순환 교구 관리", glyph: "gear-rotation-manage" },
      {
        type: "group", id: "rental", label: "대여관리", glyph: "rental-manage",
        children: [
          { id: "rental-status", label: "대여현황" },
          { id: "rental-approval", label: "대여승인" },
          { id: "returns-approval", label: "반납승인" },
          { id: "reservation-approval", label: "예약승인" },
          { id: "overdue", label: "연체관리" },
        ],
      },
      { type: "item", id: "stats", label: "통계", glyph: "stats" },
      { type: "item", id: "report", label: "리포트", glyph: "report" },
      { type: "item", id: "items-qr", label: "QR관리", glyph: "items-qr" },
    ];
  }

  return [
    { type: "item", id: "notices", label: "공지사항", glyph: "notices" },
    { type: "item", id: "my-gear-rotation", label: "이번 달 내 교구", glyph: "my-gear-rotation" },
    { type: "item", id: "items-browse", label: "교구 둘러보기", glyph: "items-browse" },
    { type: "item", id: "items", label: "교구검색", glyph: "items" },
    { type: "item", id: "qr-scan", label: "QR 스캔", glyph: "qr-scan" },
    { type: "item", id: "rental-return", label: "대여 반납신청", glyph: "rental-return" },
    { type: "item", id: "my-reservations", label: "내 예약 현황", glyph: "my-reservations" },
    { type: "item", id: "pe-resources", label: "교육 · 자료실", glyph: "pe-resources" },
  ];
}

function flattenSidebarNav(nav) {
  const out = [];
  nav.forEach(n => {
    if (n.type === "item") out.push(n);
    else if (n.type === "group") {
      n.children.forEach(c => out.push({ id: c.id, label: c.label, glyph: n.glyph }));
    }
  });
  return out;
}

function buildMobileBottomNav(me) {
  const superA = isSuperAdmin(me);
  const admin = isItemAdmin(me) && !superA;
  if (superA || admin) {
    return [
      { id: "notices", label: "공지", glyph: "notices" },
      { id: "dashboard", label: "대시보드", glyph: "dashboard" },
      { id: "items", label: "전체교구", glyph: "items" },
      { id: "rental-manage", label: "대여관리", glyph: "rental-manage" },
      { id: "more", label: "더보기", glyph: "more" },
    ];
  }
  return [
    { id: "notices", label: "공지", glyph: "notices" },
    { id: "items", label: "교구검색", glyph: "items" },
    { id: "my-rental-status", label: "내대여현황", glyph: "my-rental-status" },
    { id: "return-request", label: "반납요청", glyph: "returns-approval" },
    { id: "more", label: "더보기", glyph: "more" },
  ];
}

function buildMobileMoreNav(me, bottomNav) {
  const pinned = new Set(bottomNav.filter(n => n.id !== "more").map(n => n.id));
  const all = flattenSidebarNav(buildSidebarNav(me));
  const extra = canPersonalGearRental(me)
    ? [{ id: "rental-return", label: "내 대여·반납", glyph: "rental-return" }]
    : [];
  const seen = new Set();
  return [...all, ...extra].filter(n => {
    if (pinned.has(n.id) || seen.has(n.id)) return false;
    seen.add(n.id);
    return true;
  });
}

function MobileMoreSheet({ items, page, onSelect, onClose }) {
  return (
    <>
      <div
        role="presentation"
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", zIndex: 350 }}
      />
      <div style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        width: "100%",
        background: "#fff",
        borderRadius: "16px 16px 0 0",
        zIndex: 360,
        padding: "12px 12px calc(16px + env(safe-area-inset-bottom, 0px))",
        boxShadow: "0 -8px 32px rgba(0,0,0,0.18)",
        maxHeight: "min(70vh, 420px)",
        overflowY: "auto",
        animation: "slideUp 0.22s ease-out",
      }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "4px 8px 12px",
          borderBottom: "1px solid #f1f5f9",
          marginBottom: 8,
        }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: DS.textPrimary }}>메뉴</span>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: "none",
              background: "#f1f5f9",
              borderRadius: 8,
              padding: "10px 14px",
              minHeight: 44,
              fontSize: 13,
              fontWeight: 600,
              color: DS.textSecondary,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            닫기
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {items.map(n => {
            const active = isNavPageActive(page, n.id);
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => onSelect(n.id)}
                style={{
                  border: active ? `1.5px solid ${DS.primary}` : "1px solid #e2e8f0",
                  background: active ? "#f0fdf4" : "#fff",
                  borderRadius: 12,
                  padding: "14px 8px",
                  minHeight: 72,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <NavGlyph id={n.glyph || n.id} color={active ? DS.primary : "#64748b"} size={22}/>
                <span style={{
                  fontSize: 12,
                  fontWeight: active ? 700 : 600,
                  color: active ? DS.primary : DS.textSecondary,
                  lineHeight: 1.25,
                  textAlign: "center",
                }}>{n.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

function SidebarNav({ nav, page, setPage, sb, badge, reqBadge, retBadge, resBadge, overdueBadge = 0, admin, touchMode = false }) {
  const [expanded, setExpanded] = useState(() => {
    const init = {};
    nav.forEach(n => {
      if (n.type === "group" && n.children.some(c => isNavPageActive(page, c.id))) init[n.id] = true;
    });
    return init;
  });

  useEffect(() => {
    nav.forEach(n => {
      if (n.type === "group" && n.children.some(c => isNavPageActive(page, c.id))) {
        setExpanded(p => ({ ...p, [n.id]: true }));
      }
    });
  }, [page, nav]);

  const toggleGroup = (gid) => setExpanded(p => ({ ...p, [gid]: !p[gid] }));

  const itemBtn = (id, label, glyph, indent = false, badgeCount = 0) => {
    const active = isNavPageActive(page, id);
    return (
      <button
        key={id}
        type="button"
        onClick={() => setPage(id)}
        style={{
          width: "100%",
          padding: touchMode
            ? (indent ? "12px 14px 12px 38px" : "13px 14px")
            : (indent ? "9px 14px 9px 38px" : "11px 14px"),
          minHeight: touchMode ? 44 : undefined,
          borderRadius: indent ? 8 : 10,
          border: "none",
          background: active ? sb.activeBg : "transparent",
          color: active ? sb.activeText : sb.text,
          fontWeight: active ? 600 : 500,
          fontSize: indent ? 12 : 13,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: indent ? 8 : 10,
          marginBottom: indent ? 2 : 4,
          fontFamily: "inherit",
          textAlign: "left",
          transition: "all 0.15s",
        }}
      >
        {!indent && <NavGlyph id={glyph || id} color={active ? "#fff" : "rgba(255,255,255,0.45)"} size={indent ? 16 : 18}/>}
        {indent && <span style={{ width: 6, height: 6, borderRadius: "50%", background: active ? "#fff" : "rgba(255,255,255,0.25)", flexShrink: 0 }}/>}
        <span>{label}</span>
        {badgeCount > 0 && (
          <span style={{
            marginLeft: "auto",
            background: "#dc2626", color: "#fff",
            borderRadius: 99, fontSize: 10, fontWeight: 700,
            padding: "2px 7px", minWidth: 18, textAlign: "center",
          }}>{badgeCount}</span>
        )}
      </button>
    );
  };

  return (
    <nav style={{ flex: 1, padding: "4px 12px", overflowY: "auto" }}>
      {nav.map(n => {
        if (n.type === "item") {
      let itemBadge = 0;
      if (n.id === "dashboard" && badge > 0 && admin) itemBadge = badge;
      if (n.id === "rental-approval" && reqBadge > 0) itemBadge = reqBadge;
      return itemBtn(n.id, n.label, n.glyph, false, itemBadge);
        }
        const open = expanded[n.id] !== undefined
          ? expanded[n.id]
          : n.children.some(c => isNavPageActive(page, c.id));
        const groupActive = isNavPageActive(page, n.id) || n.children.some(c => isNavPageActive(page, c.id));
        return (
          <div key={n.id} style={{ marginBottom: 4 }}>
            <button
              type="button"
              onClick={() => toggleGroup(n.id)}
              style={{
                width: "100%",
                padding: touchMode ? "13px 14px" : "11px 14px",
                minHeight: touchMode ? 44 : undefined,
                borderRadius: 10,
                border: "none",
                background: groupActive && !open ? "rgba(255,255,255,0.06)" : "transparent",
                color: groupActive ? "#fff" : sb.text,
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontFamily: "inherit",
                textAlign: "left",
              }}
            >
              <NavGlyph id={n.glyph} color={groupActive ? "#fff" : "rgba(255,255,255,0.45)"}/>
              <span style={{ flex: 1 }}>{n.label}</span>
              <span style={{ fontSize: 10, opacity: 0.6 }}>{open ? "▾" : "▸"}</span>
            </button>
            {open && n.children.map(c => {
              let childBadge = 0;
              if (c.id === "rental-approval" && reqBadge > 0) childBadge = reqBadge;
              if (c.id === "reservation-approval" && resBadge > 0) childBadge = resBadge;
              if (c.id === "returns-approval" && retBadge > 0) childBadge = retBadge;
              if (c.id === "overdue" && overdueBadge > 0) childBadge = overdueBadge;
              return itemBtn(c.id, c.label, n.glyph, true, childBadge);
            })}
          </div>
        );
      })}
    </nav>
  );
}

function MobileNavDrawer({
  open, onClose, nav, page, setPage, sb, badge, reqBadge, retBadge, resBadge, overdueBadge = 0, admin,
  me, onBack, onLogout, onChangePw, cartCount, onOpenCart,
}) {
  if (!open) return null;
  const navigate = (id) => {
    setPage(id);
    onClose();
  };
  const touchBtn = {
    minHeight: 44,
    padding: "11px 14px",
    borderRadius: 10,
    border: "none",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: 13,
    fontWeight: 600,
  };
  return (
    <>
      <div
        role="presentation"
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 400 }}
      />
      <aside style={{
        position: "fixed",
        top: 0,
        left: 0,
        bottom: 0,
        width: "min(288px, 86vw)",
        background: sb.bg,
        zIndex: 410,
        display: "flex",
        flexDirection: "column",
        boxShadow: "4px 0 32px rgba(0,0,0,0.35)",
      }}>
        <div style={{ padding: "16px 14px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <PlatformMainButton
            onClick={() => { onBack(); onClose(); }}
            className="equipment-sidebar-main-btn"
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <GtsHexLogo size={32}/>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>GTS</div>
                <div style={{ fontSize: 10, color: sb.muted, marginTop: 2 }}>대여 관리</div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="메뉴 닫기"
              style={{
                ...touchBtn,
                width: 44,
                minWidth: 44,
                padding: 0,
                background: "rgba(255,255,255,0.08)",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {cartCount > 0 && (
          <div style={{ padding: "10px 12px 0" }}>
            <button
              type="button"
              onClick={() => { onOpenCart(); onClose(); }}
              style={{
                ...touchBtn,
                width: "100%",
                background: "rgba(22,163,74,0.15)",
                color: "#86efac",
                border: "1px solid rgba(22,163,74,0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span>장바구니</span>
              <span style={{
                background: DS.primary, color: "#fff", borderRadius: 99,
                padding: "2px 8px", fontSize: 11, fontWeight: 700,
              }}>{cartCount}</span>
            </button>
          </div>
        )}

        <SidebarNav
          nav={nav}
          page={page}
          setPage={navigate}
          sb={sb}
          badge={badge}
          reqBadge={reqBadge}
          retBadge={retBadge}
          resBadge={resBadge}
          overdueBadge={overdueBadge}
          admin={admin}
          touchMode
        />

        <div style={{ padding: "12px 14px calc(16px + env(safe-area-inset-bottom, 0px))", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{
            background: sb.profileBg,
            border: `1px solid ${sb.profileBorder}`,
            borderRadius: 14,
            padding: "12px 14px",
            marginBottom: 10,
          }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#fff", marginBottom: 4 }}>{me.name}님</div>
            <div style={{ marginBottom: 10 }}><RoleBadge role={me.role} isItemAdmin={me.is_item_admin}/></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                type="button"
                onClick={() => { onChangePw(); onClose(); }}
                style={{
                  ...touchBtn,
                  background: "rgba(255,255,255,0.06)",
                  color: "rgba(255,255,255,0.75)",
                }}
              >
                비밀번호 변경
              </button>
              <button
                type="button"
                onClick={() => { onLogout(); onClose(); }}
                style={{
                  ...touchBtn,
                  background: "rgba(220,38,38,0.15)",
                  color: "#fca5a5",
                }}
              >
                로그아웃
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

function buildMonthlyRentalCounts(ris) {
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: `${d.getMonth() + 1}월`, count: 0 });
  }
  (ris || []).forEach(ri => {
    const at = ri.approved_at || ri.created_at;
    if (!at || ["pending", "rejected"].includes(ri.status)) return;
    const d = new Date(at);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const m = months.find(x => x.key === key);
    if (m) m.count += ri.quantity || 1;
  });
  return months;
}

function buildRecentMonthOptions(count = 12) {
  const options = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    options.push({ key, label: `${d.getFullYear()}년 ${d.getMonth() + 1}월` });
  }
  return options;
}

function toMonthKey(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function isInMonthKey(iso, monthKey) {
  return toMonthKey(iso) === monthKey;
}

function riRentalAt(ri) {
  return ri.approved_at || ri.created_at;
}

function itemCurrentStatusLabel(item, ris, rets) {
  if (!item) return "-";
  const rented = rentedQty(item.id, ris, rets);
  const avail = availQty(item, ris, rets);
  if (rented > 0) return { label: "대여중", key: "rented" };
  if (avail > 0) return { label: "대여가능", key: "available" };
  return { label: "재고없음", key: "empty" };
}

function computeMonthlyReport(monthKey, { ris, rets, reqs, items, teachers }) {
  const monthRis = (ris || []).filter(ri => {
    if (["pending", "rejected"].includes(ri.status)) return false;
    return isInMonthKey(riRentalAt(ri), monthKey);
  });

  const totalRentals = monthRis.length;

  const monthReturnApproved = (rets || []).filter(
    r => r.status === "return_approved" && isInMonthKey(r.approved_at || r.created_at, monthKey)
  );
  const returnedRiIds = new Set(monthReturnApproved.map(r => r.rental_item_id));
  const returnedCount = returnedRiIds.size;
  const returnRate = totalRentals > 0 ? Math.round((returnedCount / totalRentals) * 100) : 0;

  const damageCount = (rets || []).filter(
    r => r.condition === "damaged" && isInMonthKey(r.created_at, monthKey)
  ).length;
  const lossCount = (rets || []).filter(
    r => r.condition === "lost" && isInMonthKey(r.created_at, monthKey)
  ).length;

  const teacherStatsMap = new Map();
  const ensureTeacherRow = (tid) => {
    if (!tid) return null;
    if (!teacherStatsMap.has(tid)) {
      teacherStatsMap.set(tid, {
        teacherId: tid,
        name: tname(tid, teachers),
        rentals: 0,
        returned: 0,
        unreturned: 0,
        damage: 0,
      });
    }
    return teacherStatsMap.get(tid);
  };

  monthRis.forEach(ri => {
    const req = reqs.find(r => r.id === ri.request_id);
    const row = ensureTeacherRow(req?.teacher_id);
    if (!row) return;
    row.rentals += 1;
    if (ri.status === "returned") row.returned += 1;
    else if (["rented", "partial_returned"].includes(ri.status)) row.unreturned += 1;
  });

  (rets || []).forEach(ret => {
    if (ret.condition !== "damaged" || !isInMonthKey(ret.created_at, monthKey)) return;
    const row = ensureTeacherRow(ret.teacher_id);
    if (row) row.damage += 1;
  });

  const teacherStats = [...teacherStatsMap.values()]
    .filter(t => t.rentals > 0 || t.damage > 0)
    .sort((a, b) => b.rentals - a.rentals || a.name.localeCompare(b.name, "ko"));

  const itemRentalCounts = new Map();
  monthRis.forEach(ri => {
    itemRentalCounts.set(ri.item_id, (itemRentalCounts.get(ri.item_id) || 0) + 1);
  });
  const topItems = [...itemRentalCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([itemId, rentalCount]) => {
      const item = items.find(i => i.id === itemId);
      const status = itemCurrentStatusLabel(item, ris, rets);
      return {
        itemId,
        name: item?.name || "-",
        rentalCount,
        statusLabel: status.label,
        statusKey: status.key,
      };
    });

  const incidents = (rets || [])
    .filter(r => ["damaged", "lost"].includes(r.condition) && isInMonthKey(r.created_at, monthKey))
    .map(r => {
      const ri = ris.find(x => x.id === r.rental_item_id);
      return {
        id: r.id,
        itemName: iname(ri?.item_id, items),
        teacherName: tname(r.teacher_id, teachers),
        date: r.created_at,
        condition: r.condition,
        status: r.status,
      };
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  return {
    totalRentals,
    returnedCount,
    returnRate,
    damageCount,
    lossCount,
    teacherStats,
    topItems,
    incidents,
  };
}

function LucideBarChart2({ size = 20, color = DS.primary }) {
  const s = {
    width: size,
    height: size,
    stroke: color,
    fill: "none",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };
  return (
    <svg {...s} viewBox="0 0 24 24" aria-hidden>
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  );
}

const panelCard = {
  background: "#fff",
  borderRadius: 20,
  padding: "22px 24px",
  border: "1px solid #e8ecee",
  boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
};

const PAGE_META = {
  dashboard:          { title: "대시보드",     sub: "오늘도 안정적이고 효율적인 자산 관리를 시작해보세요." },
  "my-gear-rotation":   { title: "이번 달 내 교구", sub: "이번 주 교구와 월별 순환 교구를 확인합니다." },
  "gear-rotation-manage": { title: "순환 교구 관리", sub: "알파벳별 주차 교구 목록을 수정합니다." },
  "gear-categories":      { title: "카테고리 관리", sub: "교구 카테고리를 추가·수정·삭제하고 순서를 변경합니다." },
  "rental-status":    { title: "대여현황",     sub: "선생님별 대여·반납 현황을 한눈에 확인하세요." },
  items:              { title: "전체교구",     sub: "교구 재고를 조회하고 관리합니다." },
  "items-browse":     { title: "교구 둘러보기", sub: "카테고리별 교구 사진과 대여 가능 수량을 확인합니다." },
  "items-register":   { title: "교구등록",     sub: "새 교구를 등록합니다." },
  "items-qr":         { title: "QR관리",       sub: "교구 QR 코드를 관리합니다." },
  "qr-scan":          { title: "QR 스캔",      sub: "교구 QR 코드를 스캔하여 상세 정보를 확인하고 대여 신청합니다." },
  rentals:            { title: "대여신청",     sub: "교구 대여 신청 내역을 확인합니다." },
  "rental-return":    { title: "대여 반납신청", sub: "교구 대여 신청과 반납 신청을 합니다." },
  "rental-manage":    { title: "대여관리",     sub: "대여·반납·연체 업무를 처리합니다." },
  "rental-approval":  { title: "대여승인",     sub: "선생님의 교구 대여 신청을 검토하고 승인합니다." },
  "returns-approval": { title: "반납승인",     sub: "반납 신청을 검토하고 승인합니다." },
  overdue:            { title: "연체관리",     sub: "연체 대여 건을 확인하고 조치합니다." },
  institutions:       { title: "기관관리",     sub: "보관 지점·기관 정보를 관리합니다." },
  accounts:           { title: "선생님관리",   sub: "계정과 권한을 관리합니다." },
  stats:              { title: "통계",         sub: "대여·재고 통계를 확인합니다." },
  report:             { title: "월간 리포트",  sub: "월별 대여·반납·파손·분실 현황을 분석합니다." },
  notices:            { title: "공지사항",     sub: "공지를 확인하고 관리자는 새 공지를 등록할 수 있습니다." },
  settings:           { title: "설정",         sub: "계정 및 시스템 설정을 관리합니다." },
  "data-export":      { title: "데이터 내보내기", sub: "교구·대여·급여 데이터를 Excel로 다운로드합니다." },
  "my-rental-status": { title: "내 대여현황",  sub: "대여 중인 교구를 확인하고 교구별 반납 신청을 합니다." },
  "my-reservations":  { title: "내 예약 현황", sub: "교구 예약 상태를 확인하고 승인 전 예약을 취소할 수 있습니다." },
  "reservation-approval": { title: "예약 승인", sub: "선생님의 교구 예약을 검토하고 승인·거절합니다." },
  "return-request":   { title: "반납요청",    sub: "대여 중인 교구의 반납을 신청합니다." },
  "qr-rent":          { title: "QR 대여 신청", sub: "스캔한 교구의 대여 가능 수량을 확인하고 신청합니다." },
  "item-detail":      { title: "교구 상세",    sub: "교구 정보와 대여 이력을 확인합니다." },
};

const DETAIL_BACK_LABELS = {
  items: "교구 검색",
  "items-register": "교구 관리",
  "items-browse": "교구 둘러보기",
  "my-gear-rotation": "이번 달 내 교구",
  "qr-scan": "QR 스캔",
  "qr-rent": "QR 대여",
};

function PageShell({children,style}) {
  return <div style={{maxWidth:1280,...style}}>{children}</div>;
}

function CartHeaderButton({ count, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={count > 0 ? `장바구니 ${count}개` : "장바구니"}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 44,
        height: 44,
        padding: 0,
        borderRadius: 12,
        border: `1px solid ${count > 0 ? DS.primary : "#e8ecee"}`,
        background: count > 0 ? DS.primaryLight : "#fff",
        color: count > 0 ? DS.primary : DS.textSecondary,
        cursor: "pointer",
        fontFamily: "inherit",
        flexShrink: 0,
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
      </svg>
      {count > 0 ? (
        <span style={{
          position: "absolute",
          top: -4,
          right: -4,
          minWidth: 18,
          height: 18,
          padding: "0 5px",
          borderRadius: 99,
          background: DS.primary,
          color: "#fff",
          fontSize: 10,
          fontWeight: 800,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "2px solid #fff",
        }}>
          {count}
        </span>
      ) : null}
    </button>
  );
}

function PageHeader({me,subtitle,alertCount=0,actions}) {
  return (
    <div className="page-header-block" style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:28,gap:16,flexWrap:"wrap"}}>
      <div>
        <div className="page-header-greeting" style={{fontSize:26,fontWeight:800,color:"#111827",letterSpacing:"-0.5px",marginBottom:8}}>
          안녕하세요, {me.name}님
        </div>
        <div className="page-header-subtitle" style={{fontSize:14,color:DS.textSecondary,lineHeight:1.5}}>{subtitle}</div>
      </div>
      <div style={{display:"flex",gap:10,alignItems:"center"}}>
        {alertCount>0&&(
          <div style={{
            width:40,height:40,borderRadius:12,background:"#fff",
            border:"1px solid #e8ecee",display:"flex",alignItems:"center",justifyContent:"center",
            position:"relative",color:DS.textSecondary,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            <span style={{position:"absolute",top:6,right:6,width:8,height:8,background:DS.primary,borderRadius:"50%",border:"2px solid #fff"}}/>
          </div>
        )}
        <div style={{
          display:"flex",alignItems:"center",gap:10,padding:"6px 12px 6px 6px",
          background:"#fff",borderRadius:12,border:"1px solid #e8ecee",
        }}>
          <div style={{
            width:32,height:32,borderRadius:10,background:DS.primaryLight,
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:13,fontWeight:800,color:DS.primary,
          }}>{me.name[0]}</div>
          <span style={{fontSize:13,fontWeight:600,color:DS.textPrimary}}>{me.name}</span>
        </div>
        {actions}
      </div>
    </div>
  );
}

function DashStatCard({label,value,iconMark,iconBg,iconColor,onClick,active}) {
  const inner=(
    <>
      <div style={{
        width:52,height:52,borderRadius:14,flexShrink:0,
        background:iconBg,display:"flex",alignItems:"center",justifyContent:"center",
        fontSize:12,fontWeight:800,color:iconColor,
      }}>{iconMark}</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:12,color:DS.textMuted,fontWeight:500,marginBottom:4}}>{label}</div>
        <div style={{fontSize:28,fontWeight:800,color:"#111827",letterSpacing:"-0.5px",lineHeight:1}}>{value}</div>
      </div>
      {onClick&&<span style={{color:"#cbd5e1",fontSize:18,fontWeight:300}}>›</span>}
    </>
  );
  const boxStyle={
    background:"#fff",borderRadius:18,padding:"20px 22px",
    border:active?`2px solid ${DS.primary}`:"1px solid #e8ecee",
    boxShadow:active?"0 8px 24px rgba(22,163,74,0.12)":"0 1px 4px rgba(0,0,0,0.04)",
    display:"flex",alignItems:"center",gap:16,width:"100%",
    fontFamily:"inherit",textAlign:"left",transition:"box-shadow 0.15s, border-color 0.15s",
  };
  if(onClick) return <button type="button" onClick={onClick} style={{...boxStyle,cursor:"pointer"}}>{inner}</button>;
  return <div style={boxStyle}>{inner}</div>;
}

function PanelSection({title,action,actionLabel,children,style}) {
  return (
    <div className="panel-section-card" style={{...panelCard,marginBottom:18,...style}}>
      {(title||action)&&(
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          {title&&<div style={{fontSize:16,fontWeight:700,color:"#111827"}}>{title}</div>}
          {action&&(
            <button type="button" onClick={action} style={{
              border:"none",background:"transparent",color:DS.primary,
              fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
            }}>{actionLabel||"전체 보기"}</button>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// UI ATOMS — 리디자인
// ═══════════════════════════════════════════════════════════════════════
const card = {
  ...panelCard,
  marginBottom: 12,
};

const inp = {
  width: "100%",
  padding: "11px 14px",
  borderRadius: 8,
  border: `1px solid ${DS.inputBorder}`,
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
  background: DS.inputBg,
  color: DS.textPrimary,
  transition: "border-color 0.2s",
};

const lbl = {
  display: "block",
  marginBottom: 6,
  fontSize: 12,
  fontWeight: 600,
  color: DS.textSecondary,
  letterSpacing: "0.02em",
};

function Badge({s, tone}) {
  const c = SC[s]||{l:s,bg:"#f1f5f9",c:"#64748b"};
  const themed = tone === "return"
    ? { ...c, bg: RETURN_THEME.light, c: RETURN_THEME.text }
    : c;
  return (
    <span style={{
      display:"inline-block",
      padding:"3px 10px",
      borderRadius:99,
      fontSize:11,
      fontWeight:700,
      background:themed.bg,
      color:themed.c,
      letterSpacing:"0.01em",
    }}>{themed.l}</span>
  );
}

function ReservationBadge({ res, status }) {
  const key = status || reservationDisplayStatus(res);
  const c = RSC[key] || RSC.pending;
  return (
    <span style={{
      display: "inline-block",
      padding: "3px 10px",
      borderRadius: 99,
      fontSize: 11,
      fontWeight: 700,
      background: c.bg,
      color: c.c,
      letterSpacing: "0.01em",
    }}>{c.l}</span>
  );
}

const ITEM_ADMIN_CFG = { label: "교구관리자", bg: "#dbeafe", color: "#1d4ed8" };

function RoleBadge({ role, isItemAdmin: itemAdmin }) {
  if (itemAdmin && role === "teacher") {
    const r = ITEM_ADMIN_CFG;
    return (
      <span style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: 99,
        fontSize: 11,
        fontWeight: 700,
        background: r.bg,
        color: r.color,
      }}>{r.label}</span>
    );
  }
  const r = ROLE_CFG[role] || ROLE_CFG.teacher;
  return (
    <span style={{
      display:"inline-block",
      padding:"3px 10px",
      borderRadius:99,
      fontSize:11,
      fontWeight:700,
      background:r.bg,
      color:r.color,
    }}>{r.label}</span>
  );
}

function CatTag({cat}) {
  const { categoryMap } = useGearCategories();
  const m = getCategoryMeta(cat, categoryMap);
  return (
    <span style={{
      display:"inline-block",
      padding:"2px 9px",
      borderRadius:99,
      fontSize:11,
      fontWeight:700,
      background:m.color,
      color:"#fff",
    }}>{m.label}</span>
  );
}

function Btn({children,color,sm,full,danger,ghost,onClick,disabled,type="button"}) {
  const baseColor = color || DS.primary;
  const dangerColor = "#dc2626";
  const bg = disabled
    ? "#e2e8f0"
    : ghost
      ? "#fff"
      : danger
        ? "#ef4444"
        : baseColor;
  const textColor = disabled
    ? "#94a3b8"
    : ghost
      ? (danger ? dangerColor : (color || baseColor))
      : "#fff";
  const border = ghost
    ? `1.5px solid ${danger ? dangerColor : (color || baseColor)}`
    : "none";
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{
      padding: sm ? "8px 16px" : "12px 20px",
      borderRadius: 8,
      border,
      background: bg,
      color: textColor,
      fontSize: sm ? 12 : 14,
      fontWeight: 700,
      cursor: disabled ? "not-allowed" : "pointer",
      fontFamily: "inherit",
      width: full ? "100%" : "auto",
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      justifyContent: "center",
      whiteSpace: "nowrap",
      opacity: disabled ? 0.6 : 1,
      transition: "all 0.15s",
      letterSpacing: "0.01em",
    }}>{children}</button>
  );
}

function Fld({label,children,error,hint}) {
  return (
    <div style={{marginBottom:14}}>
      {label && <label style={lbl}>{label}</label>}
      {children}
      {hint  && <div style={{fontSize:11,color:DS.textMuted,marginTop:3}}>{hint}</div>}
      {error && <div style={{fontSize:11,color:"#dc2626",marginTop:3,fontWeight:600}}>{error}</div>}
    </div>
  );
}
function Inp2({label,error,hint,...p}) {
  return <Fld label={label} error={error} hint={hint}><input {...p} style={{...inp,...(p.style||{})}}/></Fld>;
}
function Sel2({label,children,hint,...p}) {
  return <Fld label={label} hint={hint}><select {...p} style={{...inp,...(p.style||{})}}>{children}</select></Fld>;
}
function Txa2({label,...p}) {
  return <Fld label={label}><textarea {...p} style={{...inp,minHeight:72,resize:"vertical",...(p.style||{})}}/></Fld>;
}

function Modal({title,onClose,children,noPad,dismissible=true,center=false,closeLabel="×"}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev || ""; };
  }, []);
  const handleBackdrop = dismissible && onClose ? onClose : undefined;
  return (
    <div
      className={`app-modal-backdrop${center ? " app-modal-backdrop--center" : ""}`}
      onClick={handleBackdrop}
    >
      <div
        className={`app-modal-sheet${center ? " app-modal-sheet--center" : ""}`}
        style={{ padding: noPad ? 0 : undefined }}
        onClick={e => e.stopPropagation()}
      >
        {!noPad && (
          <div className="app-modal-sheet__head">
            <div className="app-modal-sheet__title">{title}</div>
            {dismissible && onClose ? (
              <button
                type="button"
                className="app-modal-sheet__close"
                onClick={onClose}
                aria-label="닫기"
              >
                {closeLabel}
              </button>
            ) : null}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

function Empty({text}) {
  return (
    <div style={{textAlign:"center",padding:"52px 20px",color:DS.textMuted}}>
      <div style={{fontSize:14,fontWeight:500}}>{text}</div>
    </div>
  );
}

function Stat({label,value,color,iconMark,onClick,active}) {
  const palettes={
    "#16a34a":{bg:DS.primaryLight,mark:"보유"},
    "#2563eb":{bg:"#dbeafe",mark:"대여"},
    "#64748b":{bg:"#f1f5f9",mark:"종류"},
    "#d97706":{bg:"#fef3c7",mark:"대기"},
    "#dc2626":{bg:"#fee2e2",mark:"연체"},
    "#7c3aed":{bg:"#ede9fe",mark:"반납"},
  };
  const p=palettes[color]||{bg:DS.primaryLight,mark:iconMark||"—"};
  return (
    <DashStatCard
      label={label}
      value={value}
      iconMark={iconMark||p.mark}
      iconBg={p.bg}
      iconColor={color||DS.primary}
      onClick={onClick}
      active={active}
    />
  );
}

function Spinner({text}) {
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"60px 20px",gap:14}}>
      <div style={{
        width:36,height:36,
        borderRadius:"50%",
        border:"3px solid #e2e8f0",
        borderTopColor:DS.primary,
        animation:"spin 0.7s linear infinite",
      }}/>
      {text && <div style={{color:DS.textMuted,fontSize:13,fontWeight:600}}>{text}</div>}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// INFINITE SCROLL
// ═══════════════════════════════════════════════════════════════════════
function InfList({all,renderItem}) {
  const [show,setShow] = useState(20);
  const ref = useRef(null);
  useEffect(()=>setShow(20),[all]);
  useEffect(()=>{
    if (!ref.current) return;
    const ob = new IntersectionObserver(([e])=>{ if(e.isIntersecting) setShow(v=>Math.min(v+20,all.length)); },{threshold:0.1});
    ob.observe(ref.current);
    return ()=>ob.disconnect();
  },[all.length]);
  return (
    <div>
      {all.slice(0,show).map(renderItem)}
      {show < all.length && <div ref={ref} style={{textAlign:"center",padding:"16px",color:DS.textMuted,fontSize:12}}>불러오는 중... ({show}/{all.length})</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 로그인 페이지 — 리디자인
// ═══════════════════════════════════════════════════════════════════════
const LOGIN_GREEN = "#16a34a";
const LOGIN_EMAIL_KEY = "gts_remember_email";

function LoginUserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  );
}

function LoginLockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3" y="11" width="18" height="11" rx="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );
}

function LoginEyeIcon({ open }) {
  if (open) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

function PasswordResetLink({ variant = "block" }) {
  const [open,setOpen] = useState(false);
  const [email,setEmail] = useState("");
  const [sent,setSent] = useState(false);
  const [loading,setLoading] = useState(false);
  const handle = async () => {
    if (!email.trim()) return alert("이메일을 입력하세요");
    setLoading(true);
    await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:window.location.origin});
    setLoading(false); setSent(true);
  };
  const trigger = variant === "inline" ? (
    <button type="button" onClick={()=>setOpen(true)} style={{
      background:"none",border:"none",padding:0,
      color:"#64748b",fontSize:12,cursor:"pointer",
      fontFamily:"inherit",fontWeight:500,
    }}>
      비밀번호 찾기 &gt;
    </button>
  ) : (
    <button type="button" onClick={()=>setOpen(true)} style={{
      display:"block",width:"100%",marginTop:20,
      background:"none",border:"none",
      color:"#999",fontSize:13,cursor:"pointer",
      fontFamily:"inherit",fontWeight:400,
    }}>
      비밀번호 찾기
    </button>
  );
  return (
    <>
      {trigger}
      {open && (
        <Modal title="비밀번호 재설정" onClose={()=>{setOpen(false);setSent(false);setEmail("");}}>
          {sent ? (
            <div style={{textAlign:"center",padding:"28px 0"}}>
              <div style={{fontWeight:700,fontSize:16,color:"#111",marginBottom:8}}>이메일을 확인하세요</div>
              <div style={{fontSize:13,color:"#888",lineHeight:1.6}}>{email}으로 재설정 링크를 보냈습니다</div>
            </div>
          ) : (
            <>
              <Inp2 label="가입한 이메일" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="example@gts.com"/>
              <Btn full onClick={handle} disabled={loading}>{loading?"전송 중...":"재설정 링크 보내기"}</Btn>
            </>
          )}
        </Modal>
      )}
    </>
  );
}

function LoginPage() {
  const [email,setEmail]   = useState("");
  const [pw,setPw]         = useState("");
  const [showPw,setShowPw] = useState(false);
  const [remember,setRemember] = useState(false);
  const [loading,setLoading] = useState(false);
  const [err,setErr]       = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOGIN_EMAIL_KEY);
      if (saved) {
        setEmail(saved);
        setRemember(true);
      }
    } catch { /* ignore */ }
  }, []);

  const handle = async (e) => {
    e.preventDefault();
    if (!email.trim()||!pw) { setErr("이메일과 비밀번호를 입력하세요"); return; }
    setLoading(true); setErr("");
    const { error } = await supabase.auth.signInWithPassword({ email:email.trim(), password:pw });
    setLoading(false);
    if (error) {
      setErr(error.message.includes("Invalid login") ? "이메일 또는 비밀번호가 올바르지 않습니다" : error.message);
      return;
    }
    try {
      if (remember) localStorage.setItem(LOGIN_EMAIL_KEY, email.trim());
      else localStorage.removeItem(LOGIN_EMAIL_KEY);
    } catch { /* ignore */ }
  };

  const fieldStyle = {
    width:"100%",
    boxSizing:"border-box",
    background:"#fff",
    border:"1px solid #e2e8f0",
    borderRadius:10,
    padding:"13px 14px 13px 44px",
    fontSize:14,
    color:"#0f172a",
    fontFamily:"inherit",
    outline:"none",
    transition:"border-color 0.15s, box-shadow 0.15s",
  };

  const greenDot = (t) => (
    <>
      {t}
      <span style={{ color: LOGIN_GREEN }}>.</span>
    </>
  );

  return (
    <div className="login-page" style={{
      minHeight:"100vh",
      width:"100%",
      maxWidth:"100%",
      overflowX:"hidden",
      background:"#f3f4f6",
      position:"relative",
      overflow:"hidden",
      fontFamily:"'Noto Sans KR','Inter','Apple SD Gothic Neo',sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800&display=swap');
        .login-page .login-field:focus {
          border-color: ${LOGIN_GREEN};
          box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.12);
        }
        .login-page .login-submit:not(:disabled):hover { filter: brightness(1.05); }
        .login-page .login-pw-toggle:hover { color: #475569; }
        .login-page-layout {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 48px;
          padding: 48px 32px 72px;
          max-width: 1120px;
          margin: 0 auto;
          position: relative;
          z-index: 1;
        }
        .login-brand { flex: 1; min-width: 280px; max-width: 480px; }
        .login-card-wrap { flex: 0 1 420px; width: 100%; }
        @media (max-width: 900px) {
          .login-page-layout {
            flex-direction: column;
            align-items: stretch;
            padding: 32px 20px 64px;
            gap: 32px;
          }
          .login-brand { max-width: none; min-width: 0; text-align: center; }
          .login-brand-tagline { font-size: 36px !important; }
          .login-brand-meta { justify-content: center; }
          .login-brand-head { justify-content: center; }
        }
      `}</style>

      <div style={{
        position:"absolute",
        left:-40,
        bottom:-60,
        opacity:0.05,
        pointerEvents:"none",
        zIndex:0,
      }}>
        <GtsLogo height={320}/>
      </div>

      <div className="login-page-layout">
        <div className="login-brand">
          <div className="login-brand-head" style={{ display:"flex", alignItems:"center", gap:14, marginBottom:36 }}>
            <GtsHexLogo size={44}/>
            <div style={{ textAlign:"left" }}>
              <div style={{ fontSize:22, fontWeight:800, color:LOGIN_GREEN, letterSpacing:"0.04em", fontFamily:"'Inter',sans-serif" }}>GTS</div>
              <div style={{ fontSize:13, color:"#334155", fontWeight:500, marginTop:2, fontFamily:"'Inter',sans-serif" }}>Management Platform</div>
            </div>
          </div>

          <h1 className="login-brand-tagline" style={{
            margin:0,
            fontSize:46,
            fontWeight:600,
            lineHeight:1.18,
            color:"#1e293b",
            letterSpacing:"-0.02em",
            fontFamily:"'Inter','Noto Sans KR',sans-serif",
          }}>
            {greenDot("Simple")}
            <br/>
            {greenDot("Organized")}
            <br/>
            {greenDot("Professional")}
          </h1>

          <div className="login-brand-meta" style={{
            display:"flex",
            alignItems:"center",
            gap:10,
            marginTop:28,
            color:"#64748b",
            fontSize:13,
            fontWeight:500,
          }}>
            <span style={{ width:3, height:18, background:LOGIN_GREEN, borderRadius:99, flexShrink:0 }}/>
            GTS Management Platform
          </div>
        </div>

        <div className="login-card-wrap">
          <div style={{
            background:"#fff",
            borderRadius:16,
            padding:"36px 32px 28px",
            boxShadow:"0 8px 32px rgba(15, 23, 42, 0.08)",
            border:"1px solid rgba(226, 232, 240, 0.9)",
          }}>
            <h2 style={{ margin:"0 0 6px", fontSize:24, fontWeight:800, color:"#0f172a" }}>로그인</h2>
            <p style={{ margin:"0 0 28px", fontSize:13, color:"#64748b", lineHeight:1.5 }}>
              GTS Management Platform에 오신 것을 환영합니다.
            </p>

            <form onSubmit={handle}>
              <div style={{ marginBottom:14, position:"relative" }}>
                <span style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", color:"#94a3b8", display:"flex" }}>
                  <LoginUserIcon/>
                </span>
                <input
                  className="login-field"
                  type="email"
                  value={email}
                  onChange={e=>setEmail(e.target.value)}
                  placeholder="아이디를 입력하세요"
                  autoComplete="email"
                  style={fieldStyle}
                />
              </div>

              <div style={{ marginBottom:16, position:"relative" }}>
                <span style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", color:"#94a3b8", display:"flex" }}>
                  <LoginLockIcon/>
                </span>
                <input
                  className="login-field"
                  type={showPw?"text":"password"}
                  value={pw}
                  onChange={e=>setPw(e.target.value)}
                  placeholder="비밀번호를 입력하세요"
                  autoComplete="current-password"
                  style={{ ...fieldStyle, paddingRight:44 }}
                />
                <button
                  type="button"
                  className="login-pw-toggle"
                  onClick={()=>setShowPw(v=>!v)}
                  aria-label={showPw?"비밀번호 숨기기":"비밀번호 보기"}
                  style={{
                    position:"absolute", right:12, top:"50%", transform:"translateY(-50%)",
                    background:"none", border:"none", cursor:"pointer",
                    color:"#94a3b8", display:"flex", padding:4,
                  }}
                >
                  <LoginEyeIcon open={showPw}/>
                </button>
              </div>

              <div style={{
                display:"flex",
                justifyContent:"space-between",
                alignItems:"center",
                marginBottom:18,
                gap:12,
                flexWrap:"wrap",
              }}>
                <label style={{
                  display:"flex",
                  alignItems:"center",
                  gap:8,
                  fontSize:12,
                  color:"#475569",
                  cursor:"pointer",
                  userSelect:"none",
                }}>
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={e=>setRemember(e.target.checked)}
                    style={{ width:16, height:16, accentColor:LOGIN_GREEN }}
                  />
                  아이디 저장
                </label>
                <PasswordResetLink variant="inline"/>
              </div>

              {err && (
                <div style={{
                  color:"#dc2626",
                  fontSize:13,
                  fontWeight:500,
                  marginBottom:14,
                  lineHeight:1.5,
                  background:"#fef2f2",
                  borderRadius:8,
                  padding:"10px 12px",
                }}>{err}</div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="login-submit"
                style={{
                  width:"100%",
                  padding:"14px 16px",
                  borderRadius:10,
                  border:"none",
                  background:loading?"#86efac":LOGIN_GREEN,
                  color:"#fff",
                  fontSize:15,
                  fontWeight:700,
                  cursor:loading?"not-allowed":"pointer",
                  fontFamily:"inherit",
                  transition:"filter 0.15s",
                }}
              >
                {loading?"로그인 중...":"로그인"}
              </button>
            </form>
          </div>

          <p style={{
            textAlign:"center",
            marginTop:22,
            fontSize:13,
            color:"#64748b",
            lineHeight:1.6,
          }}>
            계정이 없으신가요?{" "}
            <span style={{ color:LOGIN_GREEN, fontWeight:600 }}>관리자에게 문의하세요.</span>
          </p>
        </div>
      </div>

      <div style={{
        position:"absolute",
        left:32,
        bottom:20,
        fontSize:11,
        color:"#94a3b8",
        zIndex:1,
      }}>
        © 2025 GTS. All rights reserved.
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 비밀번호 변경
// ═══════════════════════════════════════════════════════════════════════
function ChangePwModal({ email, onClose, required = false }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [conf, setConf] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);

  const handle = async () => {
    if (!current) { setErr("현재 비밀번호를 입력하세요"); return; }
    if (next.length < 6) { setErr("새 비밀번호는 6자 이상이어야 합니다"); return; }
    if (next !== conf) { setErr("새 비밀번호가 일치하지 않습니다"); return; }
    if (current === next) { setErr("새 비밀번호는 현재 비밀번호와 달라야 합니다"); return; }
    if (!email?.trim()) { setErr("로그인 정보를 확인할 수 없습니다. 다시 로그인해 주세요."); return; }

    setLoading(true);
    setErr("");

    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: current,
    });
    if (verifyError) {
      setLoading(false);
      setErr(
        verifyError.message.includes("Invalid login")
          ? "현재 비밀번호가 올바르지 않습니다"
          : verifyError.message
      );
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.auth.updateUser({
      password: next,
      data: {
        ...(user?.user_metadata || {}),
        must_change_password: false,
      },
    });
    setLoading(false);
    if (error) { setErr(error.message); return; }
    setCurrent("");
    setNext("");
    setConf("");
    setOk(true);
  };

  const finish = () => {
    if (required) window.location.reload();
    else onClose?.();
  };

  return (
    <Modal
      title={required ? "최초 로그인 — 비밀번호 변경" : "비밀번호 변경"}
      onClose={required ? undefined : onClose}
      dismissible={!required}
    >
      {required && !ok ? (
        <div style={{
          background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10,
          padding: "10px 13px", marginBottom: 14, fontSize: 12, color: "#9a3412", fontWeight: 600, lineHeight: 1.5,
        }}>
          보안을 위해 초기 비밀번호를 변경해야 합니다. 변경 전까지 다른 메뉴를 사용할 수 없습니다.
        </div>
      ) : null}
      {ok ? (
        <div style={{ textAlign: "center", padding: "28px 0" }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: DS.textPrimary, marginBottom: 8 }}>변경 완료</div>
          <div style={{ fontSize: 13, color: DS.textMuted, marginBottom: 18, lineHeight: 1.5 }}>
            비밀번호가 변경되었습니다.
          </div>
          <Btn full onClick={finish}>확인</Btn>
        </div>
      ) : (
        <>
          <Inp2
            label="현재 비밀번호"
            type="password"
            value={current}
            onChange={e => setCurrent(e.target.value)}
            autoComplete="current-password"
          />
          <Inp2
            label="새 비밀번호 (6자 이상)"
            type="password"
            value={next}
            onChange={e => setNext(e.target.value)}
            autoComplete="new-password"
          />
          <Inp2
            label="새 비밀번호 확인"
            type="password"
            value={conf}
            onChange={e => setConf(e.target.value)}
            autoComplete="new-password"
          />
          {err && (
            <div style={{
              background: "#fee2e2", color: "#dc2626", borderRadius: 8,
              padding: "10px 13px", fontSize: 12, fontWeight: 600, marginBottom: 12,
            }}>{err}</div>
          )}
          <Btn full onClick={handle} disabled={loading}>
            {loading ? "변경 중..." : "비밀번호 변경"}
          </Btn>
        </>
      )}
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 교구 삭제 — 연결 대여·반납 기록 정리
// ═══════════════════════════════════════════════════════════════════════
async function deleteItemRelatedRecords(itemId) {
  const { data: riRows, error: fetchErr } = await supabase
    .from("rental_items")
    .select("id, request_id")
    .eq("item_id", itemId);
  if (fetchErr) throw new Error(fetchErr.message);

  const riIds = (riRows || []).map(r => r.id);
  const requestIds = [...new Set((riRows || []).map(r => r.request_id).filter(Boolean))];

  if (riIds.length) {
    const { error: retErr } = await supabase
      .from("return_requests")
      .delete()
      .in("rental_item_id", riIds);
    if (retErr) throw new Error(retErr.message);
  }

  const { error: riErr } = await supabase.from("rental_items").delete().eq("item_id", itemId);
  if (riErr) throw new Error(riErr.message);

  for (const reqId of requestIds) {
    const { data: remaining, error: remErr } = await supabase
      .from("rental_items")
      .select("id")
      .eq("request_id", reqId)
      .limit(1);
    if (remErr) throw new Error(remErr.message);
    if (!remaining?.length) {
      const { error: reqErr } = await supabase.from("rental_requests").delete().eq("id", reqId);
      if (reqErr) throw new Error(reqErr.message);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// 사진 업로드
// ═══════════════════════════════════════════════════════════════════════
function PhotoUploader({ itemCode, currentUrl, position, onUploaded, onPositionChange }) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(currentUrl || null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);
  const frameRef = useRef(null);
  const activePosition = position || DEFAULT_PHOTO_POSITION;

  useEffect(() => {
    setPreview(currentUrl || null);
  }, [currentUrl]);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("사진은 5MB 이하만 가능합니다"); return; }
    const reader = new FileReader();
    reader.onload = ev => setPreview(ev.target.result);
    reader.readAsDataURL(file);
    setLoading(true);
    const ext = file.name.split(".").pop();
    const path = `items/${itemCode}_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("item-photos").upload(path, file, { upsert: true });
    if (error) { alert("업로드 실패: " + error.message); setLoading(false); return; }
    const { data } = supabase.storage.from("item-photos").getPublicUrl(path);
    onUploaded(data.publicUrl);
    setLoading(false);
  };

  const applyPositionFromPointer = (clientX, clientY) => {
    const el = frameRef.current;
    if (!el || !onPositionChange) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    onPositionChange(formatPhotoPosition(x, y));
  };

  const onFramePointerDown = (e) => {
    if (!preview || !onPositionChange) return;
    e.preventDefault();
    e.stopPropagation();
    frameRef.current?.setPointerCapture(e.pointerId);
    setDragging(true);
    applyPositionFromPointer(e.clientX, e.clientY);
  };

  const onFramePointerMove = (e) => {
    if (!dragging) return;
    applyPositionFromPointer(e.clientX, e.clientY);
  };

  const onFramePointerUp = (e) => {
    setDragging(false);
    try { frameRef.current?.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  const posLabel = (() => {
    const { x, y } = parsePhotoPosition(activePosition);
    return `${x}% · ${y}%`;
  })();

  return (
    <div style={{ marginBottom: 16 }}>
      <label style={lbl}>교구 사진</label>
      {!preview ? (
        <div
          onClick={() => !loading && fileRef.current?.click()}
          style={{
            width: "100%", height: 160, borderRadius: 14,
            border: `2px dashed ${DS.inputBorder}`,
            background: "#fafafa",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <div style={{ fontSize: 12, color: DS.textMuted, fontWeight: 500 }}>
            {loading ? "업로드 중..." : "사진을 눌러서 추가하세요"}
          </div>
          <div style={{ fontSize: 10, color: "#cbd5e1", marginTop: 3 }}>JPG, PNG (최대 5MB)</div>
        </div>
      ) : (
        <>
          <div
            ref={frameRef}
            onPointerDown={onFramePointerDown}
            onPointerMove={onFramePointerMove}
            onPointerUp={onFramePointerUp}
            onPointerCancel={onFramePointerUp}
            style={{
              width: "100%", height: 160, borderRadius: 14,
              border: `2px solid ${dragging ? DS.primary : DS.inputBorder}`,
              overflow: "hidden", position: "relative",
              cursor: dragging ? "grabbing" : "grab",
              touchAction: "none",
              background: "#e2e8f0",
            }}
          >
            <img
              src={preview}
              alt="교구 사진"
              draggable={false}
              style={{
                width: "100%", height: "100%", objectFit: "cover",
                objectPosition: activePosition,
                pointerEvents: "none", userSelect: "none",
              }}
            />
            <div style={{
              position: "absolute", inset: 0,
              border: dragging ? `2px solid ${DS.primary}` : "2px dashed rgba(255,255,255,0.5)",
              pointerEvents: "none",
            }}/>
          </div>
          {onPositionChange && (
            <div style={{ marginTop: 8, fontSize: 11, color: DS.textSecondary, lineHeight: 1.5 }}>
              <span style={{ fontWeight: 600 }}>드래그</span>하여 보이는 영역을 조절하세요
              <span style={{ fontFamily: "monospace", marginLeft: 8, color: DS.primary, fontWeight: 700 }}>
                {posLabel}
              </span>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              style={{
                padding: "8px 12px", minHeight: 36, borderRadius: 8,
                border: `1px solid ${DS.primary}`, background: DS.primaryLight,
                color: DS.primary, fontSize: 12, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              사진 변경
            </button>
            <button
              type="button"
              onClick={() => {
                setPreview(null);
                onUploaded("");
                onPositionChange?.(DEFAULT_PHOTO_POSITION);
              }}
              style={{
                padding: "8px 12px", minHeight: 36, borderRadius: 8,
                border: "none", background: "transparent",
                color: DS.textMuted, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              사진 제거
            </button>
          </div>
        </>
      )}
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }}/>
    </div>
  );
}

function parseActivityPhotos(source) {
  const v = source?.activity_photos ?? source;
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(Boolean);
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch { return []; }
  }
  return [];
}

function ItemActivityGallery({ photos, title = "활동 사진", compact = false, onPhotoClick }) {
  const list = Array.isArray(photos) ? photos.filter(Boolean) : parseActivityPhotos({ activity_photos: photos });
  if (!list.length) return null;
  const thumb = compact ? 56 : 88;
  return (
    <div style={{ marginTop: compact ? 8 : 0, marginBottom: compact ? 0 : 14 }}>
      {!compact && (
        <div style={{ fontSize: 12, fontWeight: 700, color: DS.textSecondary, marginBottom: 8 }}>{title}</div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {list.map((url, i) => (
          <button
            key={`${url}-${i}`}
            type="button"
            onClick={() => onPhotoClick?.({ src: url, alt: `${title} ${i + 1}` })}
            style={{
              width: thumb, height: thumb, padding: 0, borderRadius: 10,
              border: "1px solid #e2e8f0", overflow: "hidden", background: "#f8fafc",
              cursor: onPhotoClick ? "zoom-in" : "default", flexShrink: 0,
            }}
          >
            <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}/>
          </button>
        ))}
      </div>
    </div>
  );
}

function ActivityPhotosUploader({ itemCode, photos, onChange }) {
  const [loading, setLoading] = useState(false);
  const fileRef = useRef(null);
  const list = parseActivityPhotos({ activity_photos: photos });

  const uploadFiles = async (fileList) => {
    const files = Array.from(fileList || []).filter(f => f.type.startsWith("image/"));
    if (!files.length) return;
    const code = (itemCode || "new").trim() || "new";
    setLoading(true);
    const next = [...list];
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        alert(`${file.name}: 5MB 이하만 업로드 가능합니다`);
        continue;
      }
      const ext = file.name.split(".").pop() || "jpg";
      const path = `items/${code}/activity/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("item-photos").upload(path, file, { upsert: false });
      if (error) {
        alert(`업로드 실패: ${error.message}`);
        continue;
      }
      const { data } = supabase.storage.from("item-photos").getPublicUrl(path);
      if (data?.publicUrl) next.push(data.publicUrl);
    }
    onChange(next);
    setLoading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeAt = (idx) => {
    onChange(list.filter((_, i) => i !== idx));
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <label style={lbl}>활동 사진</label>
      <div
        onClick={() => !loading && fileRef.current?.click()}
        style={{
          width: "100%", minHeight: 72, borderRadius: 12,
          border: `2px dashed ${DS.inputBorder}`, background: "#fafafa",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: loading ? "wait" : "pointer", marginBottom: list.length ? 10 : 0,
        }}
      >
        <span style={{ fontSize: 12, color: DS.textMuted, fontWeight: 500 }}>
          {loading ? "업로드 중..." : "클릭하여 활동 사진 추가 (여러 장 선택 가능)"}
        </span>
      </div>
      {list.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {list.map((url, i) => (
            <div key={`${url}-${i}`} style={{ position: "relative", width: 80, height: 80, flexShrink: 0 }}>
              <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 10, border: "1px solid #e2e8f0" }}/>
              <button
                type="button"
                onClick={() => removeAt(i)}
                aria-label="사진 삭제"
                style={{
                  position: "absolute", top: -6, right: -6, width: 22, height: 22,
                  borderRadius: "50%", border: "none", background: "#dc2626", color: "#fff",
                  fontSize: 12, cursor: "pointer", lineHeight: 1, fontWeight: 700,
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        onChange={e => uploadFiles(e.target.files)}
        style={{ display: "none" }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 교구 추가/편집 폼
// ═══════════════════════════════════════════════════════════════════════
function itemToFormState(item, categoryKeys = [], categoryMap = {}) {
  const normalized = normalizeCategoryKey(item?.category);
  const map = categoryMap || {};
  const keys = categoryKeys || [];
  const defaultCat = (normalized && map[normalized]) ? normalized : (keys[0] || normalized || "");
  return {
    code: item?.code || "",
    name: item?.name || "",
    alias: item?.alias || "",
    category: defaultCat,
    total_quantity: item?.total_quantity ?? 0,
    branch: item?.branch || BRANCHES[0],
    description: item?.description || "",
    usage_description: item?.usage_description || "",
    safety_notes: item?.safety_notes || "",
    youtube_url: item?.youtube_url || "",
    status: item?.status || "available",
    photo_url: item?.photo_url || "",
    photo_position: item?.photo_position || DEFAULT_PHOTO_POSITION,
    activity_photos: parseActivityPhotos(item),
    qr_url: item?.qr_url || "",
  };
}

function ItemForm({item, items, onSave, onClose}) {
  const { categoryMap, categoryKeys } = useGearCategories();
  const isNew = !item?.id;
  const isEdit = Boolean(item?.id);
  const [f, setF] = useState(() => itemToFormState(item, categoryKeys, categoryMap));
  const initialRef = useRef({
    id: item?.id,
    category: itemToFormState(item, categoryKeys, categoryMap).category,
    code: (item?.code || "").trim(),
  });
  const set = (k,v) => setF(p=>({...p,[k]:v}));
  const [saving,setSaving] = useState(false);
  const [autoCode,setAutoCode] = useState(isNew && !item?.code);

  useEffect(() => {
    const next = itemToFormState(item, categoryKeys, categoryMap);
    setF(next);
    setAutoCode(!item?.id && !item?.code);
    initialRef.current = {
      id: item?.id,
      category: next.category,
      code: (item?.code || "").trim(),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id, categoryKeys, categoryMap]);

  const qrItem = useMemo(
    () => ({ id: item?.id, code: f.code.trim() }),
    [item?.id, f.code]
  );

  const applyAutoCode = useCallback((cat) => {
    setF(p => ({
      ...p,
      code: nextItemCode(cat || p.category, items, { excludeId: item?.id }),
    }));
  }, [items, item?.id]);

  useEffect(() => {
    if (!isNew || !autoCode) return;
    applyAutoCode(f.category);
  }, [f.category, isNew, autoCode, applyAutoCode]);

  const { category: initialCategory, code: initialCode } = initialRef.current;
  const categoryChanged = isEdit && f.category !== initialCategory;

  const onCategoryChange = (cat) => {
    const normalized = normalizeCategoryKey(cat);
    if (isEdit) {
      if (normalized === initialCategory) {
        setF(p => ({ ...p, category: normalized, code: initialCode }));
        setAutoCode(false);
        return;
      }
      setF(p => ({
        ...p,
        category: normalized,
        code: nextItemCode(normalized, items, { excludeId: item.id }),
      }));
      setAutoCode(true);
      return;
    }
    set("category", normalized);
    if (autoCode) applyAutoCode(normalized);
  };

  const handleSave = async () => {
    if (!f.code.trim() || !f.name.trim()) {
      alert("교구명과 교구 코드는 필수입니다");
      return;
    }
    if (findItemNameConflict(items, f.name, item?.id)) {
      alert(DUPLICATE_ITEM_NAME_MESSAGE);
      return;
    }
    setSaving(true);
    const payload = {
      ...f,
      code: f.code.trim(),
      name: f.name.trim(),
      alias: (f.alias || "").trim(),
      total_quantity: parseInt(f.total_quantity, 10) || 0,
      activity_photos: parseActivityPhotos({ activity_photos: f.activity_photos }),
      ...(isNew ? { status: "available" } : {}),
    };
    const row = await onSave(payload, item?.id);
    setSaving(false);
    if (!row) return;
    if (isNew) {
      try {
        const uploaded = await createItemQr(row);
        if (uploaded && uploaded !== row.qr_url) {
          await onSave({ ...row, qr_url: uploaded }, row.id);
        }
      } catch (e) {
        console.warn("QR 생성 실패", e);
      }
    }
    onClose();
  };

  const catLabel = getCategoryMeta(f.category, categoryMap).label;

  return (
    <Modal title={item?"교구 편집":"교구 추가"} onClose={onClose}>
      <PhotoUploader
        itemCode={f.code || "new"}
        currentUrl={f.photo_url}
        position={f.photo_position}
        onUploaded={url => set("photo_url", url)}
        onPositionChange={pos => set("photo_position", pos)}
      />

      <div style={{...panelCard,padding:"16px 18px",marginBottom:14}}>
        <div style={{fontSize:12,fontWeight:600,color:DS.textSecondary,marginBottom:10}}>카테고리 · 교구 코드</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 10px"}}>
          <Sel2 label="카테고리 *" value={f.category} onChange={e=>onCategoryChange(e.target.value)}>
            {categoryKeys.map(c => (
              <option key={c} value={c}>{categoryMap[c]?.label || c} ({c})</option>
            ))}
          </Sel2>
          <Inp2
            label="교구 코드 *"
            value={f.code}
            onChange={e=>{ setAutoCode(false); set("code", e.target.value); }}
            placeholder={`${f.category}-001`}
          />
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8,flexWrap:"wrap",gap:8}}>
          <span style={{fontSize:11,color:DS.textMuted}}>
            {catLabel} 기준 · <span style={{fontFamily:"monospace",fontWeight:600}}>{f.category}-###</span> 형식
            {categoryChanged && (
              <span style={{ marginLeft: 6, color: DS.primary, fontWeight: 700 }}>
                · 카테고리 변경으로 코드가 자동 재생성됩니다
              </span>
            )}
          </span>
          {(isNew || categoryChanged) && (
            <button
              type="button"
              onClick={()=>{ setAutoCode(true); applyAutoCode(f.category); }}
              style={{
                border:"none",background:"transparent",color:DS.primary,
                fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
              }}
            >
              코드 자동생성
            </button>
          )}
        </div>
      </div>

      {f.code.trim() && (
        <div style={{...panelCard,padding:"16px 18px",marginBottom:14,textAlign:"center"}}>
          <div style={{fontSize:12,fontWeight:600,color:DS.textSecondary,marginBottom:10}}>QR 코드 미리보기</div>
          <div style={{display:"inline-block",padding:8,background:"#fff",borderRadius:10,border:"1px solid #e8ecee"}}>
            <GearQrDisplay item={qrItem} size={160}/>
          </div>
          <div style={{fontSize:11,color:DS.textMuted,marginTop:8,fontFamily:"monospace"}}>{f.code}</div>
          <div style={{fontSize:10,color:DS.textMuted,marginTop:4}}>
            {item?.id ? "교구 ID 기준 URL" : "저장 후 교구 ID로 QR이 확정됩니다"}
          </div>
        </div>
      )}

      <Inp2 label="교구명 *" value={f.name} onChange={e=>set("name",e.target.value)} placeholder="교구명 입력"/>
      <Inp2
        label="영어 교구명 (검색 별칭)"
        value={f.alias}
        onChange={e=>set("alias",e.target.value)}
        placeholder="예: Balance Board"
      />

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 10px"}}>
        <Sel2 label="보관 지점" value={f.branch} onChange={e=>set("branch",e.target.value)}>
          {BRANCHES.map(b=><option key={b}>{b}</option>)}
        </Sel2>
        <Inp2 label="전체 수량" type="number" min={0} value={f.total_quantity} onChange={e=>set("total_quantity",e.target.value)}/>
      </div>
      {isEdit && (
        <Sel2 label="상태" value={f.status} onChange={e=>set("status",e.target.value)}>
          <option value="available">사용가능 (정상)</option>
          <option value="maintenance">점검중</option>
          <option value="retired">퇴역</option>
        </Sel2>
      )}
      <Txa2 label="설명" value={f.description} onChange={e=>set("description",e.target.value)} placeholder="교구 설명"/>
      <ActivityPhotosUploader
        itemCode={f.code || "new"}
        photos={f.activity_photos}
        onChange={urls => set("activity_photos", urls)}
      />
      <Txa2 label="사용법" value={f.usage_description} onChange={e=>set("usage_description",e.target.value)}/>
      <Txa2 label="안전 주의사항" value={f.safety_notes} onChange={e=>set("safety_notes",e.target.value)}/>
      <Inp2 label="유튜브 URL" value={f.youtube_url} onChange={e=>set("youtube_url",e.target.value)} placeholder="https://youtube.com/watch?v=..."/>
      <div style={{display:"flex",gap:8,marginTop:4}}>
        <Btn full onClick={handleSave} disabled={saving}>{saving?"저장 중...":"저장"}</Btn>
        <Btn full color="#94a3b8" onClick={onClose}>취소</Btn>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 슈퍼관리자 — 계정 관리
// ═══════════════════════════════════════════════════════════════════════
function AccountsPage({me, teachers, setTeachers, ris, reqs, items}) {
  return (
    <TeacherAccountsPage
      me={me}
      teachers={teachers}
      setTeachers={setTeachers}
      ris={ris}
      reqs={reqs}
      items={items}
      fetchTeachers={fetchTeachers}
      supabase={supabase}
      PageShell={PageShell}
      PageHeader={PageHeader}
      PAGE_META={PAGE_META}
      Btn={Btn}
      Modal={Modal}
      DS={DS}
      card={card}
      RoleBadge={RoleBadge}
      DashStatCard={DashStatCard}
      Empty={Empty}
      Inp2={Inp2}
      Sel2={Sel2}
      Fld={Fld}
      inp={inp}
      fmt={fmt}
      isSuperAdmin={isSuperAdmin}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 대시보드 — 리디자인
// ═══════════════════════════════════════════════════════════════════════
function DashGlyph({ name, size = 22 }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
  switch (name) {
    case "pending": return (<svg {...p}><path d="M9 2h6a2 2 0 0 1 2 2v0H7v0a2 2 0 0 1 2-2Z"/><rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 12h6M9 16h4"/></svg>);
    case "overdue": return (<svg {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5M12 16h.01"/></svg>);
    case "return": return (<svg {...p}><path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 5 5v0a5 5 0 0 1-5 5H9"/></svg>);
    case "plus": return (<svg {...p}><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>);
    case "check": return (<svg {...p}><path d="M9 2h6a2 2 0 0 1 2 2v0H7v0a2 2 0 0 1 2-2Z"/><rect x="5" y="4" width="14" height="18" rx="2"/><path d="m9 13 2 2 4-4"/></svg>);
    case "search": return (<svg {...p}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>);
    case "report": return (<svg {...p}><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>);
    default: return null;
  }
}

function DashTaskCard({ icon, label, value, unit, caption, bg, color, onClick }) {
  return (
    <button type="button" onClick={onClick} className="dash-task-card" style={{
      background:"#fff", border:"1px solid #e8ecee", borderRadius:18, padding:24,
      display:"flex", alignItems:"center", gap:16, width:"100%", cursor:"pointer",
      fontFamily:"inherit", textAlign:"left", transition:"transform .2s, box-shadow .2s, border-color .2s",
    }}>
      <div style={{ width:52, height:52, borderRadius:16, background:bg, color, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
        <DashGlyph name={icon} size={24}/>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, color:DS.textSecondary, fontWeight:600, marginBottom:6 }}>{label}</div>
        <div style={{ display:"flex", alignItems:"baseline", gap:4 }}>
          <span style={{ fontSize:32, fontWeight:800, color:"#111827", lineHeight:1, letterSpacing:"-1px" }}>{value}</span>
          <span style={{ fontSize:14, color:DS.textSecondary, fontWeight:700 }}>{unit}</span>
        </div>
        {caption && <div style={{ fontSize:12, color:DS.textMuted, marginTop:6 }}>{caption}</div>}
      </div>
      <span style={{ color:"#cbd5e1", fontSize:20, flexShrink:0 }}>›</span>
    </button>
  );
}

function DashActionButton({ icon, label, desc, bg, color, onClick }) {
  return (
    <button type="button" onClick={onClick} className="dash-action-btn" style={{
      background:"#fff", border:"1px solid #e8ecee", borderRadius:16, padding:"18px 16px",
      display:"flex", flexDirection:"column", alignItems:"flex-start", gap:10, width:"100%",
      cursor:"pointer", fontFamily:"inherit", textAlign:"left",
      transition:"transform .2s, box-shadow .2s, border-color .2s",
    }}>
      <div style={{ width:44, height:44, borderRadius:13, background:bg, color, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <DashGlyph name={icon} size={22}/>
      </div>
      <div>
        <div style={{ fontSize:14, fontWeight:700, color:"#111827" }}>{label}</div>
        <div style={{ fontSize:11, color:DS.textMuted, marginTop:3 }}>{desc}</div>
      </div>
    </button>
  );
}

function DashItemIcon({ item, size = 34 }) {
  const [failed, setFailed] = useState(false);
  const showPhoto = Boolean(item?.photo_url) && !failed;
  return (
    <div style={{ width:size, height:size, borderRadius:10, overflow:"hidden", background:"#f1f5f9", border:"1px solid #e8ecee", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
      {showPhoto ? (
        <img src={item.photo_url} alt={item?.name||""} onError={()=>setFailed(true)} style={itemPhotoStyle(item, { width:"100%", height:"100%" })}/>
      ) : (
        <CategoryIconFallback category={item?.category} size={size}/>
      )}
    </div>
  );
}

function DashStatusBadge({ overdue }) {
  const s = overdue
    ? { bg:"#fee2e2", color:"#dc2626", dot:"#dc2626", label:"연체" }
    : { bg:"#dcfce7", color:"#16a34a", dot:"#22c55e", label:"대여중" };
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:6, background:s.bg, color:s.color, fontSize:12, fontWeight:700, padding:"4px 10px", borderRadius:99 }}>
      <span style={{ width:6, height:6, borderRadius:"50%", background:s.dot }}/>
      {s.label}
    </span>
  );
}

function HoldingsListView({ held, items, reqs, me, onForceReturn, onGoAll }) {
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState(null);

  const rows = useMemo(() => (held || []).map(ri => {
    const item = items.find(i=>i.id===ri.item_id);
    const req = reqs.find(r=>r.id===ri.request_id);
    const d = dday(ri.due_date);
    return {
      ri, item, req, d,
      overdue: d!==null && d<0,
      dueToday: d===0,
      name: item?.name || iname(ri.item_id, items),
      location: req?.dispatch_location || item?.branch || "-",
    };
  }), [held, items, reqs]);

  const totalQty = useMemo(() => rows.reduce((s,r)=>s+r.ri.quantity,0), [rows]);
  const counts = useMemo(() => ({
    all: rows.length,
    overdue: rows.filter(r=>r.overdue).length,
    active: rows.filter(r=>!r.overdue).length,
    today: rows.filter(r=>r.dueToday).length,
  }), [rows]);
  const kinds = useMemo(() => new Set(rows.map(r=>r.ri.item_id)).size, [rows]);

  const filtered = useMemo(() => {
    let r = rows;
    if (tab==="overdue") r = r.filter(x=>x.overdue);
    else if (tab==="active") r = r.filter(x=>!x.overdue);
    else if (tab==="today") r = r.filter(x=>x.dueToday);
    const lq = q.trim().toLowerCase();
    if (lq) r = r.filter(x=>x.name.toLowerCase().includes(lq));
    return [...r].sort((a,b)=>(a.d??9999)-(b.d??9999));
  }, [rows, tab, q]);

  useEffect(() => { setPage(1); }, [tab, q, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page-1)*pageSize, page*pageSize);

  const tabs = [
    { id:"all", label:"전체", n:counts.all },
    { id:"overdue", label:"연체", n:counts.overdue },
    { id:"active", label:"대여중", n:counts.active },
    { id:"today", label:"오늘 반납", n:counts.today },
  ];

  const summary = [
    { label:"보유 교구", value:`${totalQty}개`, bg:"#dcfce7", color:"#16a34a", icon:"pending" },
    { label:"보유 종류", value:`${kinds}종`, bg:"#dbeafe", color:"#2563eb", icon:"report" },
    { label:"연체 교구", value:`${counts.overdue}건`, bg:"#fee2e2", color:"#dc2626", icon:"overdue" },
    { label:"오늘 반납 예정", value:`${counts.today}건`, bg:"#f1f5f9", color:"#64748b", icon:"return" },
  ];

  const col = "2.6fr 1fr 1fr 1fr 1fr 32px";

  return (
    <div style={{ display:"flex", flexDirection:"column", minHeight:0, height:"100%", flex:1, width:"100%", minWidth:0 }}>
      {/* 요약 카드 */}
      <div style={{ padding:"4px 24px 0" }}>
        <div className="teacher-summary-grid" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
          {summary.map(s=>(
            <div key={s.label} style={{ display:"flex", alignItems:"center", gap:12, background:"#fbfcfd", border:"1px solid #eef2f6", borderRadius:14, padding:"12px 14px" }}>
              <div style={{ width:36, height:36, borderRadius:11, background:s.bg, color:s.color, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <DashGlyph name={s.icon} size={18}/>
              </div>
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:11, color:DS.textMuted, fontWeight:600, whiteSpace:"nowrap" }}>{s.label}</div>
                <div style={{ fontSize:20, fontWeight:800, color:"#111827", letterSpacing:"-0.5px", lineHeight:1.2 }}>{s.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 필터 + 검색 */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, padding:"16px 24px 12px", flexWrap:"wrap" }}>
        <div style={{ display:"flex", gap:4, background:"#f1f5f9", borderRadius:12, padding:4 }}>
          {tabs.map(t=>{
            const active = tab===t.id;
            return (
              <button key={t.id} type="button" onClick={()=>setTab(t.id)} style={{
                border:"none", borderRadius:9, padding:"7px 14px", cursor:"pointer", fontFamily:"inherit",
                fontSize:13, fontWeight:700, background:active?"#fff":"transparent",
                color:active?"#111827":DS.textSecondary, boxShadow:active?"0 1px 3px rgba(0,0,0,0.08)":"none",
                transition:"all .15s",
              }}>
                {t.label}{t.id!=="all" && <span style={{ color:active?DS.textSecondary:DS.textMuted, marginLeft:5 }}>({t.n})</span>}
              </button>
            );
          })}
        </div>
        <div style={{ position:"relative", flex:"1 1 200px", maxWidth:280, minWidth:180 }}>
          <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:DS.textMuted, display:"flex" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
          </span>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="교구명 검색" style={{
            width:"100%", boxSizing:"border-box", padding:"9px 12px 9px 34px", borderRadius:10,
            border:"1px solid #e8ecee", fontSize:13, outline:"none", fontFamily:"inherit", background:"#fff", color:DS.textPrimary,
          }}/>
        </div>
      </div>

      {/* 테이블 */}
      <div style={{ flex:1, overflowY:"auto", overflowX:"hidden", minHeight:0, padding:"0 24px", overscrollBehavior:"contain", WebkitOverflowScrolling:"touch" }}>
        <div style={{ display:"grid", gridTemplateColumns:col, gap:12, padding:"10px 12px", fontSize:11, fontWeight:700, color:DS.textMuted, borderBottom:"1px solid #eef2f6", position:"sticky", top:0, background:"#fff", zIndex:1 }}>
          <span>교구명</span>
          <span style={{ textAlign:"right" }}>수량</span>
          <span>보관 위치</span>
          <span>반납 예정일</span>
          <span>상태</span>
          <span/>
        </div>
        {pageRows.length===0 ? (
          <Empty text="해당하는 교구가 없습니다"/>
        ) : pageRows.map(r=>(
          <button key={r.ri.id} type="button" onClick={()=>setSelected(r)} className="teacher-row" style={{
            display:"grid", gridTemplateColumns:col, gap:12, alignItems:"center", width:"100%",
            padding:"12px", minHeight:64, border:"none", borderBottom:"1px solid #f4f6f8", background:"transparent",
            cursor:"pointer", fontFamily:"inherit", textAlign:"left", transition:"background .15s",
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:0 }}>
              <DashItemIcon item={r.item} size={40}/>
              <span style={{ fontSize:14, fontWeight:700, color:"#111827", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.name}</span>
            </div>
            <span style={{ fontSize:13, fontWeight:600, color:DS.textPrimary, textAlign:"right" }}>{r.ri.quantity}개</span>
            <span style={{ fontSize:13, color:DS.textSecondary, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.location}</span>
            <div style={{ minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:700, color:r.overdue?"#dc2626":DS.textSecondary }}>{r.d===null?"-":r.overdue?`D+${Math.abs(r.d)}`:r.d===0?"D-Day":`D-${r.d}`}</div>
              <div style={{ fontSize:11, color:DS.textMuted, marginTop:1 }}>{fmt(r.ri.due_date)}</div>
            </div>
            <span><DashStatusBadge overdue={r.overdue}/></span>
            <span style={{ color:"#cbd5e1", display:"flex", justifyContent:"flex-end" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m9 18 6-6-6-6"/></svg>
            </span>
          </button>
        ))}
      </div>

      {/* 푸터 */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, padding:"14px 24px", borderTop:"1px solid #eef2f6", flexWrap:"wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <button type="button" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} style={{ width:32, height:32, borderRadius:9, border:"1px solid #e8ecee", background:"#fff", cursor:page<=1?"default":"pointer", opacity:page<=1?0.4:1, color:DS.textSecondary, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <span style={{ fontSize:13, color:DS.textSecondary, fontWeight:600, minWidth:44, textAlign:"center" }}>{page} / {totalPages}</span>
          <button type="button" disabled={page>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))} style={{ width:32, height:32, borderRadius:9, border:"1px solid #e8ecee", background:"#fff", cursor:page>=totalPages?"default":"pointer", opacity:page>=totalPages?0.4:1, color:DS.textSecondary, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {onGoAll && <button type="button" onClick={onGoAll} style={{ border:"none", background:"transparent", color:DS.primary, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>대여현황에서 보기 ›</button>}
          <select value={pageSize} onChange={e=>setPageSize(Number(e.target.value))} style={{ padding:"7px 10px", borderRadius:9, border:"1px solid #e8ecee", fontSize:12, fontFamily:"inherit", background:"#fff", color:DS.textSecondary, cursor:"pointer" }}>
            <option value={10}>10개씩 보기</option>
            <option value={20}>20개씩 보기</option>
            <option value={50}>50개씩 보기</option>
          </select>
        </div>
      </div>

      {/* 행 상세 (반납/강제반납/히스토리) */}
      {selected && (() => {
        const { ri, item, req, d, overdue } = selected;
        const info = [
          ["보관 위치", selected.location],
          ["파견지", req?.dispatch_location || "-"],
          ["대여 기간", `${fmt(req?.dispatch_start)} ~ ${fmt(req?.dispatch_end)}`],
          ["반납 예정일", `${fmt(ri.due_date)}${d===null?"":`  ·  ${overdue?`D+${Math.abs(d)}`:d===0?"D-Day":`D-${d}`}`}`],
          ["신청일", fmt(req?.created_at)],
        ];
        return (
          <div onClick={()=>setSelected(null)} style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.35)", zIndex:1300, display:"flex", justifyContent:"flex-end" }}>
            <div onClick={e=>e.stopPropagation()} style={{ width:"min(420px, 92vw)", height:"100%", background:"#fff", boxShadow:"-8px 0 40px rgba(0,0,0,0.2)", display:"flex", flexDirection:"column", overflow:"auto" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"20px 22px 14px" }}>
                <span style={{ fontSize:15, fontWeight:800, color:"#111827" }}>교구 상세</span>
                <button type="button" onClick={()=>setSelected(null)} aria-label="닫기" style={{ width:32, height:32, borderRadius:9, border:"1px solid #e8ecee", background:"#fff", color:DS.textSecondary, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
              </div>
              <div style={{ padding:"0 22px", display:"flex", alignItems:"center", gap:12 }}>
                <DashItemIcon item={item} size={54}/>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:16, fontWeight:800, color:"#111827" }}>{selected.name} <span style={{ color:DS.textSecondary, fontWeight:700 }}>×{ri.quantity}</span></div>
                  <div style={{ marginTop:6 }}><DashStatusBadge overdue={overdue}/></div>
                </div>
              </div>
              <div style={{ padding:"18px 22px 6px" }}>
                {info.map(([k,v])=>(
                  <div key={k} style={{ display:"flex", justifyContent:"space-between", gap:12, padding:"10px 0", borderBottom:"1px solid #f4f6f8", fontSize:13 }}>
                    <span style={{ color:DS.textMuted, fontWeight:600, flexShrink:0 }}>{k}</span>
                    <span style={{ color:DS.textPrimary, fontWeight:600, textAlign:"right" }}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop:"auto", padding:"16px 22px calc(16px + env(safe-area-inset-bottom,0px))", borderTop:"1px solid #eef2f6", display:"flex", flexDirection:"column", gap:10 }}>
                {onForceReturn && isSuperAdmin(me) ? (
                  <ForceReturnButton ri={ri} me={me} itemName={selected.name} onForceReturn={async (r,reason)=>{ const ok=await onForceReturn(r,reason); if(ok!==false) setSelected(null); return ok; }}/>
                ) : (
                  <div style={{ fontSize:12, color:DS.textMuted, textAlign:"center" }}>반납·강제반납은 슈퍼관리자만 처리할 수 있습니다.</div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function TeacherHoldingsModal({ teacher, items, reqs, me, onForceReturn, onClose, onGoAll }) {
  const subLine = useMemo(() => {
    const locs = teacher.held
      .map(ri => reqs.find(r=>r.id===ri.request_id)?.dispatch_location)
      .filter(Boolean);
    return [...new Set(locs)].slice(0,3).join(" · ");
  }, [teacher, reqs]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow || "";
    };
  }, []);

  return (
    <div onClick={onClose} style={{
      position:"fixed", inset:0, background:"rgba(15,23,42,0.5)", backdropFilter:"blur(4px)",
      zIndex:999, display:"flex", alignItems:"center", justifyContent:"center", padding:16,
      overscrollBehavior:"none",
    }}>
      <div onClick={e=>e.stopPropagation()} className="teacher-holdings-modal" style={{
        background:"#fff", borderRadius:20, width:"min(96vw, 1000px)", maxHeight:"90vh",
        display:"flex", flexDirection:"column", boxShadow:"0 24px 60px rgba(0,0,0,0.22)", overflow:"hidden",
        overscrollBehavior:"contain",
      }}>
        {/* 헤더 */}
        <div style={{ display:"flex", alignItems:"flex-start", gap:14, padding:"22px 24px 8px", flexShrink:0 }}>
          <div style={{ width:48, height:48, borderRadius:14, background:DS.primaryLight, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, fontWeight:800, color:DS.primary, flexShrink:0 }}>{teacher.name[0]}</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
              <span style={{ fontSize:19, fontWeight:800, color:"#111827" }}>{teacher.name} 선생님</span>
              <RoleBadge role={teacher.role} isItemAdmin={teacher.is_item_admin}/>
            </div>
            {subLine && <div style={{ fontSize:13, color:DS.textSecondary, marginTop:4 }}>{subLine}</div>}
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" style={{
            width:34, height:34, borderRadius:10, border:"1px solid #e8ecee", background:"#fff",
            color:DS.textSecondary, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div style={{ flex:1, minHeight:0, display:"flex", overflow:"hidden" }}>
          <HoldingsListView held={teacher.held} items={items} reqs={reqs} me={me} onForceReturn={onForceReturn} onGoAll={onGoAll}/>
        </div>
      </div>
    </div>
  );
}

function DashboardPage({me,items,teachers,reqs,ris,rets,reservations,onApprove,onReject,onApproveRet,onDamage,onLoss,onApproveReservation,onRejectReservation,setPage,onForceReturn,adminTodos,onAddTodo,onToggleTodo,onDeleteTodo,onUpdateTodo}) {
  const { categoryMap, categoryKeys } = useGearCategories();
  const admin = isItemAdmin(me);
  const [activePanel,setActivePanel]=useState(null);
  const [rejectId,setRejectId]=useState(null);
  const [reason,setReason]=useState("");
  const [rejectResId,setRejectResId]=useState(null);
  const [resReason,setResReason]=useState("");
  const [teacherDetail,setTeacherDetail]=useState(null);
  const go = (id) => { if (typeof setPage === "function") setPage(id); };

  const itemCount = items.length;
  const availItemCount = items.filter(i => availQty(i, ris, rets) > 0).length;
  const rentedItemCount = new Set(
    ris.filter(r => ["rented", "partial_returned"].includes(r.status)).map(r => r.item_id)
  ).size;
  const pendReqs = reqs.filter(r=>r.status==="pending");
  const pendingN = pendReqs.length;
  const pendReservations = (reservations || []).filter(r => r.status === "pending");
  const pendingResN = pendReservations.length;
  const overdueList = ris.filter(r=>["rented","partial_returned"].includes(r.status)&&dday(r.due_date)!==null&&dday(r.due_date)<0);
  const pendRets = filterReturnPendingLastWeek(rets);
  const retPendN = pendRets.length;
  const dmgPending = rets.filter(r=>r.status==="return_pending"&&["damaged","lost"].includes(r.condition)&&isWithinLastWeek(r.created_at));
  const dmgN = dmgPending.length;
  const dueAlerts = getDueAlerts(ris, reqs, items, teachers);

  const rentedLines = useMemo(() => ris
    .filter(ri=>["rented","partial_returned"].includes(ri.status))
    .map(ri=>{
      const req=reqs.find(r=>r.id===ri.request_id);
      return { ri, req, teacher: req ? tname(req.teacher_id, teachers) : "-" };
    }), [ris, reqs, teachers]);

  const togglePanel = (id) => setActivePanel(p => p === id ? null : id);
  const teacherRows = teachers.map(t=>{
    const held=ris.filter(ri=>["rented","partial_returned"].includes(ri.status)&&reqs.find(r=>r.id===ri.request_id&&r.teacher_id===t.id));
    return {...t,held};
  }).filter(t=>t.held.length>0);

  const catStats = useMemo(() => categoryKeys.map(key => {
    const catItems = items.filter(i => categoryMatchesFilter(i.category, key));
    const total = catItems.reduce((s, i) => s + i.total_quantity, 0);
    const rented = catItems.reduce((s, i) => s + rentedQty(i.id, ris), 0);
    const avail = catItems.reduce((s, i) => s + availQty(i, ris, rets), 0);
    return { key, label: categoryMap[key]?.label || key, color: categoryMap[key]?.color || "#94a3b8", count: catItems.length, total, rented, avail };
  }).filter(c => c.count > 0), [items, ris, rets, categoryKeys, categoryMap]);

  const branchStats = useMemo(() => {
    const branches = [...new Set([...BRANCHES, ...items.map(i => i.branch).filter(Boolean)])];
    return branches.map(br => {
      const brItems = items.filter(i => i.branch === br);
      const total = brItems.reduce((s, i) => s + i.total_quantity, 0);
      const rented = brItems.reduce((s, i) => s + rentedQty(i.id, ris), 0);
      const avail = brItems.reduce((s, i) => s + availQty(i, ris, rets), 0);
      return { br, count: brItems.length, total, rented, avail };
    }).filter(b => b.count > 0);
  }, [items, ris]);

  const todayStr = new Date().toLocaleDateString("ko-KR",{year:"numeric",month:"long",day:"numeric",weekday:"long"});

  const recentPend = useMemo(
    () => [...pendReqs].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)),
    [pendReqs]
  );
  const topOverdue = useMemo(
    () => [...overdueList].sort((a,b)=>(dday(a.due_date)??0)-(dday(b.due_date)??0)).slice(0,5),
    [overdueList]
  );
  const teacherHoldings = useMemo(() => teachers.map(t=>{
    const held = ris.filter(ri=>["rented","partial_returned"].includes(ri.status) && reqs.some(r=>r.id===ri.request_id && r.teacher_id===t.id));
    const totalQty = held.reduce((s,r)=>s+r.quantity,0);
    const overdueCount = held.filter(ri=>{const d=dday(ri.due_date);return d!==null&&d<0;}).length;
    const seen=new Set(); const distinctItems=[];
    held.forEach(ri=>{ if(!seen.has(ri.item_id)){ seen.add(ri.item_id); const it=items.find(i=>i.id===ri.item_id); if(it) distinctItems.push(it); } });
    return { ...t, held, totalQty, overdueCount, distinctItems };
  }).filter(t=>t.held.length>0).sort((a,b)=>b.totalQty-a.totalQty), [teachers, ris, reqs, items]);

  const quickActions = [
    { id:"items-register", label:"교구 등록", desc:"새 교구 추가", bg:"#dcfce7", color:"#16a34a", icon:"plus" },
    { id:"rental-approval", label:"대여 승인", desc:"신청 목록 확인", bg:"#fef9c3", color:"#ca8a04", icon:"check" },
    { id:"returns-approval", label:"반납 처리", desc:"반납 등록하기", bg:"#ede9fe", color:"#7c3aed", icon:"return" },
    { id:"items", label:"교구 검색", desc:"교구 찾아보기", bg:"#dbeafe", color:"#2563eb", icon:"search" },
    { id:"report", label:"리포트", desc:"보고서 확인", bg:"#ccfbf1", color:"#0d9488", icon:"report" },
  ];

  return (
    <PageShell>
      <PageHeader me={me} subtitle={todayStr} alertCount={dueAlerts.length}/>

      {admin && (
        <>
          {/* 오늘 처리해야 할 일 */}
          <div style={{ marginBottom:24 }}>
            <div style={{ fontSize:16, fontWeight:700, color:"#111827", marginBottom:16 }}>오늘 처리해야 할 일</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))", gap:24 }}>
              <DashTaskCard icon="pending" label="승인 대기" value={pendingN} unit="건" caption="신규 대여 신청" bg="#fef9c3" color="#ca8a04" onClick={()=>go("rental-approval")}/>
              <DashTaskCard icon="overdue" label="연체 교구" value={overdueList.length} unit="건" caption="반납이 지연된 교구" bg="#fee2e2" color="#dc2626" onClick={()=>go("overdue")}/>
              <DashTaskCard icon="return" label="반납 신청" value={retPendN} unit="건" caption="반납을 요청한 교구" bg="#ede9fe" color="#7c3aed" onClick={()=>go("returns-approval")}/>
            </div>
          </div>

          {/* 승인 대기 목록 */}
          <PanelSection
            title={`승인 대기 목록 (${pendReqs.length})`}
            action={pendReqs.length>0 ? ()=>go("rental-approval") : undefined}
            actionLabel="전체 보기 ›"
          >
            {recentPend.length===0 ? (
              <Empty text="승인 대기 중인 신청이 없습니다"/>
            ) : recentPend.slice(0,3).map(req=>{
              const t=teachers.find(x=>x.id===req.teacher_id);
              const reqRIs=ris.filter(ri=>ri.request_id===req.id);
              return (
                <div key={req.id} style={{
                  display:"flex", flexWrap:"wrap", alignItems:"center", gap:16,
                  padding:"16px 4px", borderTop:"1px solid #f1f5f9",
                }}>
                  <div style={{ display:"flex", alignItems:"center", gap:12, minWidth:200, flex:"1 1 220px" }}>
                    <div style={{ width:44, height:44, borderRadius:12, background:DS.primaryLight, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, fontWeight:800, color:DS.primary, flexShrink:0 }}>{(t?.name||"?")[0]}</div>
                    <div style={{ minWidth:0 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:2 }}>
                        <span style={{ fontWeight:800, fontSize:15, color:"#111827" }}>{t?.name||"-"}</span>
                        <span style={{ fontSize:11, fontWeight:700, color:"#ca8a04", background:"#fef9c3", padding:"2px 8px", borderRadius:99 }}>대여신청</span>
                      </div>
                      <div style={{ fontSize:12, color:DS.textSecondary }}>{req.dispatch_location||"-"}</div>
                      <div style={{ fontSize:12, color:DS.textMuted, marginTop:3 }}>신청일 {fmt(req.created_at)} · 대여기간 {fmtShort(req.dispatch_start)} ~ {fmtShort(req.dispatch_end)}</div>
                    </div>
                  </div>
                  <div style={{ flex:"1 1 160px", display:"flex", flexWrap:"wrap", gap:6, minWidth:0 }}>
                    {reqRIs.map(ri=>{
                      const it=items.find(i=>i.id===ri.item_id);
                      return (
                        <div key={ri.id} style={{ display:"flex", alignItems:"center", gap:6, background:"#f8fafc", borderRadius:10, padding:"5px 10px 5px 5px", border:"1px solid #eef2f6" }}>
                          <DashItemIcon item={it} size={28}/>
                          <span style={{ fontSize:12, fontWeight:600, color:DS.textPrimary }}>{it?.name||"-"} ×{ri.quantity}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display:"flex", gap:8, flexShrink:0 }}>
                    <Btn sm color={DS.primary} onClick={()=>onApprove(req.id)}>승인</Btn>
                    <Btn sm danger onClick={()=>{setRejectId(req.id);setReason("");}}>거절</Btn>
                  </div>
                </div>
              );
            })}
          </PanelSection>

          {/* 연체 TOP5 + 선생님별 보유현황 */}
          <div className="dash-two-col" style={{ display:"grid", gridTemplateColumns:"minmax(0,1fr) minmax(0,1.2fr)", gap:24, marginBottom:18 }}>
            <PanelSection
              title="연체 교구 TOP 5"
              action={overdueList.length>0 ? ()=>go("overdue") : undefined}
              actionLabel="전체 보기 ›"
              style={{ marginBottom:0 }}
            >
              {topOverdue.length===0 ? (
                <Empty text="연체된 교구가 없습니다"/>
              ) : topOverdue.map(ri=>{
                const req=reqs.find(r=>r.id===ri.request_id);
                const it=items.find(i=>i.id===ri.item_id);
                const dd=ddayTag(ri.due_date);
                return (
                  <div key={ri.id} style={{
                    display:"flex", alignItems:"center", gap:12, padding:"12px 12px",
                    borderRadius:12, background:"rgba(254,226,226,0.35)", marginBottom:8,
                  }}>
                    <DashItemIcon item={it} size={38}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:700, fontSize:14, color:"#b91c1c" }}>{it?.name||iname(ri.item_id,items)} ×{ri.quantity}</div>
                      <div style={{ fontSize:12, color:DS.textSecondary, marginTop:2 }}>{req ? tname(req.teacher_id,teachers) : "-"} · 반납예정 {fmt(ri.due_date)}</div>
                    </div>
                    <span style={{ fontWeight:800, fontSize:13, color:"#dc2626", flexShrink:0 }}>{dd?.text}</span>
                  </div>
                );
              })}
            </PanelSection>

            <PanelSection
              title="선생님별 교구 보유 현황"
              action={teacherHoldings.length>0 ? ()=>go("rental-status") : undefined}
              actionLabel="전체 보기 ›"
              style={{ marginBottom:0 }}
            >
              {teacherHoldings.length===0 ? (
                <Empty text="현재 보유 중인 교구가 없습니다"/>
              ) : teacherHoldings.slice(0,5).map(t=>{
                const rest=Math.max(0, t.totalQty-t.distinctItems.slice(0,3).length);
                return (
                  <button key={t.id} type="button" onClick={()=>setTeacherDetail(t)} className="dash-teacher-card" style={{
                    display:"flex", alignItems:"center", gap:12, width:"100%", textAlign:"left",
                    padding:"12px", borderRadius:12, border:"1px solid transparent", background:"transparent",
                    cursor:"pointer", fontFamily:"inherit", marginBottom:2, transition:"background .2s, border-color .2s",
                  }}>
                    <div style={{ width:40, height:40, borderRadius:12, background:DS.primaryLight, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, fontWeight:800, color:DS.primary, flexShrink:0 }}>{t.name[0]}</div>
                    <div style={{ flex:"1 1 150px", minWidth:0 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <span style={{ fontWeight:800, fontSize:14, color:"#111827" }}>{t.name}</span>
                        <RoleBadge role={t.role} isItemAdmin={t.is_item_admin}/>
                      </div>
                      <div style={{ fontSize:12, color:DS.textSecondary, marginTop:3 }}>
                        보유 교구 <b style={{ color:DS.textPrimary }}>{t.totalQty}개</b>
                        {t.overdueCount>0
                          ? <span style={{ color:"#dc2626", fontWeight:700 }}> · 연체 {t.overdueCount}건</span>
                          : <span style={{ color:"#16a34a" }}> · 연체 없음</span>}
                      </div>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:-6, flexShrink:0 }}>
                      <div style={{ display:"flex" }}>
                        {t.distinctItems.slice(0,3).map((it,idx)=>(
                          <div key={it.id} style={{ marginLeft: idx===0?0:-8 }}><DashItemIcon item={it} size={32}/></div>
                        ))}
                      </div>
                      {rest>0 && <span style={{ fontSize:12, fontWeight:700, color:DS.textSecondary, marginLeft:8 }}>+{rest}</span>}
                    </div>
                  </button>
                );
              })}
            </PanelSection>
          </div>

          {/* 빠른 실행 */}
          <PanelSection title="빠른 실행">
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:16 }}>
              {quickActions.map(a=>(
                <DashActionButton key={a.id} icon={a.icon} label={a.label} desc={a.desc} bg={a.bg} color={a.color} onClick={()=>go(a.id)}/>
              ))}
            </div>
          </PanelSection>

          {/* 할 일 (수동 등록) */}
          {onAddTodo && (
            <AdminTodoSection
              me={me}
              teachers={teachers}
              todos={adminTodos}
              reqs={reqs}
              ris={ris}
              rets={rets}
              setPage={go}
              onAdd={onAddTodo}
              onToggle={onToggleTodo}
              onDelete={onDeleteTodo}
              onUpdate={onUpdateTodo}
              hideAuto
            />
          )}
        </>
      )}

      {rejectId&&(
        <Modal title="거절 사유 입력" onClose={()=>setRejectId(null)}>
          <Txa2 label="거절 사유 *" value={reason} onChange={e=>setReason(e.target.value)} placeholder="거절 이유를 입력하세요"/>
          <Btn full danger onClick={()=>{
            if(!reason.trim())return alert("거절 사유를 입력하세요");
            onReject(rejectId,reason);
            setRejectId(null);
          }}>거절 처리</Btn>
        </Modal>
      )}

      {rejectResId&&(
        <Modal title="예약 거절 사유" onClose={()=>setRejectResId(null)}>
          <Txa2 label="거절 사유 *" value={resReason} onChange={e=>setResReason(e.target.value)} placeholder="거절 이유를 입력하세요"/>
          <Btn full danger onClick={()=>{
            if(!resReason.trim())return alert("거절 사유를 입력하세요");
            onRejectReservation(rejectResId,resReason);
            setRejectResId(null);
          }}>거절 처리</Btn>
        </Modal>
      )}

      {teacherDetail && (
        <TeacherHoldingsModal
          teacher={teacherDetail}
          items={items}
          reqs={reqs}
          me={me}
          onForceReturn={onForceReturn}
          onClose={()=>setTeacherDetail(null)}
          onGoAll={()=>{ setTeacherDetail(null); go("rental-status"); }}
        />
      )}

      {!admin&&(()=>{
        const mine=reqs.filter(r=>r.teacher_id===me.id&&["pending","approved","partial"].includes(r.status));
        return(
          <PanelSection title="내 대여 현황">
            {!mine.length?<Empty text="현재 대여 중인 교구가 없어요"/>:mine.map(req=>{
              const reqRIs=ris.filter(ri=>ri.request_id===req.id);
              return(
                <div key={req.id} style={{...card,borderLeft:`3px solid ${SC[req.status]?.c||"#e2e8f0"}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                    <div style={{fontWeight:800,fontSize:14,color:DS.textPrimary}}>{req.dispatch_location}</div>
                    <Badge s={req.status}/>
                  </div>
                  <div style={{fontSize:11,color:DS.textSecondary,marginBottom:8}}>{fmt(req.dispatch_start)} ~ {fmt(req.dispatch_end)}</div>
                  {reqRIs.map(ri=>{const dd=ddayTag(ri.due_date);return(
                    <div key={ri.id} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"5px 0",borderTop:"1px solid #f8fafc",color:DS.textSecondary}}>
                      <span>{iname(ri.item_id,items)} ×{ri.quantity}</span>
                      <div style={{display:"flex",gap:5,alignItems:"center"}}>
                        {dd&&<span style={{color:dd.color,fontWeight:dd.urgent?800:500,fontSize:11}}>{dd.text}</span>}
                        <Badge s={ri.status}/>
                      </div>
                    </div>
                  );})}
                </div>
              );
            })}
          </PanelSection>
        );
      })()}
    </PageShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 교구 목록 — 리디자인
// ═══════════════════════════════════════════════════════════════════════
function ItemsPage({items,setItems,ris,rets,reqs,teachers,me,cart,setCart,reservations,onDetail,onSaveItem,onDeleteItem,onSubmitReservation,onCancelReservation,openAddOnMount=false,setPage}) {
  const { categoryMap, categoryKeys } = useGearCategories();
  const [q,setQ]=useState("");const[catF,setCatF]=useState("ALL");const[brF,setBrF]=useState("ALL");
  const[avOnly,setAvOnly]=useState(false);const[sortBy,setSortBy]=useState("code");
  const[editItem,setEditItem]=useState(null);const[addOpen,setAddOpen]=useState(false);
  const[reserveItem,setReserveItem]=useState(null);
  const [activityLightbox, setActivityLightbox] = useState(null);

  useEffect(() => {
    if (openAddOnMount && canManage(me)) setAddOpen(true);
  }, [openAddOnMount, me]);
  const cats = categoryKeys;
  const list=useMemo(()=>{
    let r=items;
    if(catF!=="ALL")r=r.filter(i=>categoryMatchesFilter(i.category,catF));
    if(brF!=="ALL")r=r.filter(i=>i.branch===brF);
    if(avOnly)r=r.filter(i=>availQty(i,ris,rets)>0);
    if(q.trim()){const lq=q.trim().toLowerCase();r=r.filter(i=>i.name.toLowerCase().includes(lq)||i.code.toLowerCase().includes(lq)||(i.alias||"").toLowerCase().includes(lq));}
    if(sortBy==="name")r=[...r].sort((a,b)=>a.name.localeCompare(b.name));
    else if(sortBy==="avail")r=[...r].sort((a,b)=>availQty(b,ris,rets)-availQty(a,ris,rets));
    else r=[...r].sort((a,b)=>a.code.localeCompare(b.code));
    return r;
  },[items,catF,brF,avOnly,q,sortBy,ris,rets]);
  const inCart=id=>cart.some(c=>c.item_id===id);
  const toggle=item=>{if(inCart(item.id)){setCart(p=>p.filter(c=>c.item_id!==item.id));return;}if(availQty(item,ris,rets)===0)return;setCart(p=>[...p,{item_id:item.id,quantity:1,due_date:""}]);};
  const availCount=useMemo(()=>items.reduce((s,i)=>s+availQty(i,ris,rets),0),[items,ris,rets]);

  const handleDelete = async (item) => {
    if (!canEditItems(me) || !onDeleteItem) return;
    const ok = await onDeleteItem(item);
    if (ok && editItem?.id === item.id) setEditItem(null);
  };

  const scheduleByItem = useMemo(() => {
    const map = new Map();
    items.forEach(item => {
      const lines = buildItemScheduleLines(item.id, { ris, rets, reqs, reservations, teachers });
      if (lines.length) map.set(item.id, lines);
    });
    return map;
  }, [items, ris, rets, reqs, reservations, teachers]);

  const pendingRes = itemId => getTeacherPendingReservation(reservations, me.id, itemId);

  return(
    <PageShell>
      <PageHeader
        me={me}
        subtitle={PAGE_META.items.sub}
        actions={canManage(me) ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {openAddOnMount && setPage ? (
              <Btn sm ghost onClick={() => setPage("gear-categories")}>카테고리 관리</Btn>
            ) : null}
            <Btn sm onClick={()=>setAddOpen(true)}>교구 추가</Btn>
          </div>
        ) : null}
      />

      <div style={{
        display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",
        gap:14,marginBottom:24,
      }}>
        <DashStatCard label="전체 품목" value={items.length} iconMark="품목" iconBg={DS.primaryLight} iconColor={DS.primary}/>
        <DashStatCard label="검색 결과" value={list.length} iconMark="검색" iconBg="#dbeafe" iconColor="#2563eb"/>
        <DashStatCard label="대여 가능 수량" value={availCount} iconMark="가능" iconBg="#dcfce7" iconColor="#16a34a"/>
        {cart.length>0&&(
          <DashStatCard label="장바구니" value={cart.length} iconMark="장바구니" iconBg="#ede9fe" iconColor="#7c3aed"/>
        )}
      </div>

      <PanelSection title="교구 검색">
      <div style={{marginBottom:12}}>
        <input value={q} onChange={e=>setQ(e.target.value)}
          placeholder="교구명·코드·별칭 검색..."
          style={{...inp,background:"#f8fafc",border:"1px solid #e8ecee",borderRadius:12,padding:"12px 14px"}}/>
      </div>

      <div style={{display:"flex",gap:4,overflowX:"auto",marginBottom:12,paddingBottom:2}}>
        <button onClick={()=>setCatF("ALL")} style={{
          padding:"10px 14px",border:"none",borderBottom:catF==="ALL"?`2px solid ${DS.primary}`:"2px solid transparent",
          background:"transparent",whiteSpace:"nowrap",
          color:catF==="ALL"?DS.primary:DS.textSecondary,
          fontWeight:catF==="ALL"?700:500,fontSize:12,cursor:"pointer",flexShrink:0,
          marginBottom:-1,
        }}>전체</button>
        {cats.map(c=>{const m=categoryMap[c]||{label:c,color:"#94a3b8"};return(
          <button key={c} onClick={()=>setCatF(c)} style={{
            padding:"10px 14px",border:"none",borderBottom:catF===c?`2px solid ${DS.primary}`:"2px solid transparent",
            background:"transparent",whiteSpace:"nowrap",
            color:catF===c?DS.primary:DS.textSecondary,
            fontWeight:catF===c?700:500,fontSize:12,cursor:"pointer",flexShrink:0,
            marginBottom:-1,
          }}>{m.label}</button>
        );})}
      </div>

      <div style={{display:"flex",gap:6,marginBottom:10}}>
        <select value={brF} onChange={e=>setBrF(e.target.value)} style={{...inp,flex:1,fontSize:12,padding:"9px 11px"}}>
          <option value="ALL">전체 지점</option>
          {BRANCHES.map(b=><option key={b}>{b}</option>)}
        </select>
        <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{...inp,flex:1,fontSize:12,padding:"9px 11px"}}>
          <option value="code">코드순</option>
          <option value="name">이름순</option>
          <option value="avail">가능순</option>
        </select>
        <button onClick={()=>setAvOnly(v=>!v)} style={{
          padding:"9px 13px",borderRadius:8,
          border:`1px solid ${avOnly?DS.primary:"#e2e8f0"}`,
          background:avOnly?DS.primaryLight:"#fff",
          color:avOnly?DS.primary:"#94a3b8",
          fontWeight:700,fontSize:11,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,
          transition:"all 0.15s",
        }}>대여가능</button>
      </div>
      </PanelSection>

      <div style={{fontSize:13,color:DS.textSecondary,marginBottom:12,fontWeight:600}}>{list.length}개 교구</div>

      <InfList all={list} renderItem={item=>{
        const rented=rentedQty(item.id,ris,rets),pending=pendingQty(item.id,ris),avail=availQty(item,ris,rets),added=inCart(item.id);
        const myRes=pendingRes(item.id);
        const scheduleLines=scheduleByItem.get(item.id);
        return(
          <div key={item.id} style={{
            ...card,
            border:added?`1px solid ${DS.primary}`:"1px solid #e8ecee",
            transition:"all 0.15s",
          }}>
            <div style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:10}}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0, alignItems: "center" }}>
                <GearItemThumbnail item={item} size={80}/>
                {(item.last_return_location || item.last_return_photo_url) && (
                  <div style={{ display: "flex", alignItems: "center", gap: 5, maxWidth: 80 }}>
                    {item.last_return_photo_url ? (
                      <img
                        src={item.last_return_photo_url}
                        alt="최근 반납"
                        style={{
                          width: 28, height: 28, borderRadius: 6, objectFit: "cover",
                          border: "1px solid #99f6e4", flexShrink: 0,
                        }}
                      />
                    ) : null}
                    {item.last_return_location ? (
                      <span style={{
                        fontSize: 9, fontWeight: 700, color: "#0f766e", lineHeight: 1.25,
                        wordBreak: "keep-all",
                      }}>
                        반납 {item.last_return_location}
                      </span>
                    ) : (
                      <span style={{ fontSize: 9, fontWeight: 700, color: "#0f766e" }}>반납 사진</span>
                    )}
                  </div>
                )}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:800,fontSize:14,color:DS.textPrimary}}>
                      {item.name}
                      {item.alias&&<span style={{fontSize:11,color:DS.textMuted,marginLeft:5}}>({item.alias})</span>}
                    </div>
                    <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center",marginTop:4}}>
                      <CatTag cat={item.category}/>
                      <span style={{fontFamily:"monospace",fontSize:10,color:DS.textMuted,background:"#f8fafc",padding:"1px 6px",borderRadius:5}}>{item.code}</span>
                      <span style={{fontSize:10,color:DS.textSecondary,background:"#f8fafc",padding:"1px 7px",borderRadius:99,border:"1px solid #e2e8f0"}}>{item.branch}</span>
                    </div>
                  </div>
                  {canEditItems(me) && (
                    <div style={{ display: "flex", gap: 6, marginLeft: 8, flexShrink: 0, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={e=>{ e.stopPropagation(); setEditItem({ ...item }); }}
                          style={{
                            background: DS.primaryLight,
                            border: `1px solid ${DS.primary}`,
                            borderRadius: 8,
                            minHeight: 36,
                            padding: "8px 12px",
                            cursor: "pointer",
                            fontSize: 12,
                            color: DS.primary,
                            fontWeight: 700,
                            fontFamily: "inherit",
                          }}
                        >
                          편집
                        </button>
                        <button
                          type="button"
                          onClick={e=>{
                            e.stopPropagation();
                            handleDelete(item);
                          }}
                          style={{
                            background: "#fee2e2",
                            border: "1px solid #fecaca",
                            borderRadius: 8,
                            minHeight: 36,
                            padding: "8px 12px",
                            cursor: "pointer",
                            fontSize: 12,
                            color: "#dc2626",
                            fontWeight: 700,
                            fontFamily: "inherit",
                          }}
                        >
                          삭제
                        </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 수량 표시 */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:10}}>
              {[["전체",item.total_quantity,"#334155","#f1f5f9"],["대여중",rented,"#7c3aed","#ede9fe"],["신청중",pending,"#d97706","#fef3c7"],["가능",avail,avail>0?"#16a34a":"#dc2626",avail>0?"#dcfce7":"#fee2e2"]].map(([l,v,c,bg])=>(
                <div key={l} style={{background:bg,borderRadius:10,padding:"8px 4px",textAlign:"center"}}>
                  <div style={{fontSize:18,fontWeight:900,color:c}}>{v}</div>
                  <div style={{fontSize:10,color:c,fontWeight:700,opacity:0.7,marginTop:1}}>{l}</div>
                </div>
              ))}
            </div>

            <ItemScheduleLines lines={scheduleLines}/>

            <ItemActivityGallery
              photos={item.activity_photos}
              compact
              onPhotoClick={setActivityLightbox}
            />

            <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
              <Btn sm ghost color={DS.textSecondary} onClick={()=>onDetail(item)}>상세보기</Btn>
              <Btn sm
                color={added?"#dc2626":avail>0?DS.primary:"#cbd5e1"}
                disabled={!added&&avail===0}
                onClick={()=>toggle(item)}>
                {added?"빼기":avail>0?"담기":"불가"}
              </Btn>
              {!canManage(me) && (
                myRes ? (
                  <Btn
                    sm
                    ghost
                    color="#dc2626"
                    onClick={() => {
                      if (!confirm("예약을 취소하시겠습니까?")) return;
                      onCancelReservation?.(myRes.id);
                    }}
                  >
                    예약취소
                  </Btn>
                ) : (
                  <Btn sm ghost color="#0d9488" onClick={() => setReserveItem(item)}>예약하기</Btn>
                )
              )}
            </div>
          </div>
        );
      }}/>
      {(addOpen||editItem)&&(
        <ItemForm
          key={editItem?.id || "new-item"}
          item={editItem}
          items={items}
          onSave={onSaveItem}
          onClose={()=>{ setAddOpen(false); setEditItem(null); }}
        />
      )}

      {reserveItem && (
        <ReservationModal
          item={reserveItem}
          onClose={() => setReserveItem(null)}
          onSubmit={(payload) => {
            onSubmitReservation?.({ ...payload, item_id: reserveItem.id });
            setReserveItem(null);
          }}
        />
      )}

      {activityLightbox && (
        <ImageLightbox
          src={activityLightbox.src}
          alt={activityLightbox.alt}
          onClose={() => setActivityLightbox(null)}
        />
      )}
    </PageShell>
  );
}

function hasLastReturnInfo(item) {
  return Boolean(item?.last_return_location || item?.last_return_photo_url || item?.last_return_at);
}

/** 최근 반납 위치 카드 (상세·둘러보기 모달 공용) */
function LastReturnLocationCard({ item, teachers, style }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  if (!hasLastReturnInfo(item)) return null;
  const photoUrl = item.last_return_photo_url || null;
  return (
    <>
      <div style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: "12px 14px",
        borderRadius: 12,
        border: "1px solid #99f6e4",
        background: "#f0fdfa",
        ...style,
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#0f766e", marginBottom: 4 }}>
            최근 반납 위치
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, color: DS.textPrimary }}>
            {item.last_return_location || "위치 미기록"}
          </div>
          <div style={{ fontSize: 12, color: DS.textSecondary, marginTop: 4, lineHeight: 1.5 }}>
            {item.last_return_at ? fmtdt(item.last_return_at) : "일시 없음"}
            {" · "}
            반납자 {item.last_returned_by ? tname(item.last_returned_by, teachers) : "-"}
          </div>
        </div>

        {photoUrl ? (
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            aria-label="반납 위치 사진 크게 보기"
            title="클릭하면 크게 보기"
            style={{
              display: "block",
              width: "100%",
              margin: 0,
              padding: 0,
              border: "1px solid #99f6e4",
              borderRadius: 12,
              background: "#fff",
              cursor: "zoom-in",
              overflow: "hidden",
              fontFamily: "inherit",
            }}
          >
            <img
              src={photoUrl}
              alt="최근 반납 위치 사진"
              style={{
                display: "block",
                width: "100%",
                maxHeight: 360,
                height: "auto",
                objectFit: "contain",
                objectPosition: "center",
                background: "#ecfeff",
              }}
            />
          </button>
        ) : (
          <div style={{
            width: "100%",
            minHeight: 96,
            borderRadius: 12,
            background: "#ccfbf1",
            border: "1px dashed #99f6e4",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontWeight: 700,
            color: "#0f766e",
          }}>
            반납 사진 없음
          </div>
        )}
      </div>
      {lightboxOpen && photoUrl && (
        <ImageLightbox
          src={photoUrl}
          alt="최근 반납 위치 사진"
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  );
}

function ItemsBrowsePage({ me, items, ris, rets, reqs, cart, setCart, reservations, teachers, onDetail, onOpenCart, onSubmitReservation, onCancelReservation, onSaveItem }) {
  const { categoryMap, categoryKeys } = useGearCategories();
  const [q, setQ] = useState("");
  const [catF, setCatF] = useState("ALL");
  const [brF, setBrF] = useState("ALL");
  const [availF, setAvailF] = useState("ALL");
  const [lightbox, setLightbox] = useState(null);
  const [reserveItem, setReserveItem] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [returnLocItem, setReturnLocItem] = useState(null);

  const list = useMemo(() => {
    let r = [...items];
    if (catF !== "ALL") r = r.filter(i => categoryMatchesFilter(i.category, catF));
    if (brF !== "ALL") r = r.filter(i => i.branch === brF);
    if (availF === "available") r = r.filter(i => availQty(i, ris, rets) > 0);
    else if (availF === "unavailable") r = r.filter(i => availQty(i, ris, rets) === 0);
    if (q.trim()) {
      const lq = q.trim().toLowerCase();
      r = r.filter(i => {
        const catMeta = getCategoryMeta(i.category, categoryMap);
        return (
          i.name.toLowerCase().includes(lq) ||
          (i.alias || "").toLowerCase().includes(lq) ||
          catMeta.label.toLowerCase().includes(lq) ||
          normalizeCategoryKey(i.category).toLowerCase().includes(lq)
        );
      });
    }
    if (availF === "newest") {
      return r.sort((a, b) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return tb - ta;
      });
    }
    return r.sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }, [items, catF, brF, availF, q, ris, rets, categoryMap]);

  const inCart = id => cart.some(c => c.item_id === id);
  const pendingRes = itemId => getTeacherPendingReservation(reservations, me.id, itemId);

  const scheduleByItem = useMemo(() => {
    const map = new Map();
    items.forEach(item => {
      const lines = buildItemScheduleLines(item.id, { ris, rets, reqs, reservations, teachers });
      if (lines.length) map.set(item.id, lines);
    });
    return map;
  }, [items, ris, rets, reqs, reservations, teachers]);

  const handleRent = (item) => {
    if (availQty(item, ris, rets) === 0) return;
    if (inCart(item.id)) {
      setCart(p => p.filter(c => c.item_id !== item.id));
      return;
    }
    setCart(p => [...p, { item_id: item.id, quantity: 1, due_date: "" }]);
  };

  const availFilterBtn = (key, label) => {
    const active = availF === key;
    return (
      <button
        key={key}
        type="button"
        onClick={() => setAvailF(key)}
        style={{
          padding: "9px 14px",
          borderRadius: 8,
          border: `1px solid ${active ? DS.primary : "#e2e8f0"}`,
          background: active ? DS.primaryLight : "#fff",
          color: active ? DS.primary : DS.textSecondary,
          fontWeight: active ? 700 : 500,
          fontSize: 12,
          cursor: "pointer",
          whiteSpace: "nowrap",
          flexShrink: 0,
          fontFamily: "inherit",
        }}
      >
        {label}
      </button>
    );
  };

  const emptyText = (() => {
    if (!items.length) return "등록된 교구가 없습니다";
    if (q.trim()) return `"${q.trim()}" 검색 결과가 없습니다`;
    if (catF !== "ALL" || brF !== "ALL" || (availF !== "ALL" && availF !== "newest")) {
      return "해당 조건의 교구가 없습니다";
    }
    return "등록된 교구가 없습니다";
  })();

  return (
    <PageShell>
      <PageHeader
        me={me}
        subtitle={PAGE_META["items-browse"].sub}
        actions={<CartHeaderButton count={cart.length} onClick={() => onOpenCart?.()}/>}
      />

      <div style={{ marginBottom: 12 }}>
        <input
          type="search"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="교구명·별명·카테고리 검색..."
          style={{
            ...inp,
            width: "100%",
            fontSize: 13,
            padding: "12px 14px",
            borderRadius: 12,
            background: "#f8fafc",
          }}
        />
      </div>

      <div style={{ display: "flex", gap: 4, overflowX: "auto", marginBottom: 12, paddingBottom: 2 }}>
        <button
          type="button"
          onClick={() => setCatF("ALL")}
          style={{
            padding: "10px 14px",
            border: "none",
            borderBottom: catF === "ALL" ? `2px solid ${DS.primary}` : "2px solid transparent",
            background: "transparent",
            whiteSpace: "nowrap",
            color: catF === "ALL" ? DS.primary : DS.textSecondary,
            fontWeight: catF === "ALL" ? 700 : 500,
            fontSize: 12,
            cursor: "pointer",
            flexShrink: 0,
            marginBottom: -1,
            fontFamily: "inherit",
          }}
        >
          전체
        </button>
        {categoryKeys.map(c => {
          const m = categoryMap[c] || { label: c, color: "#94a3b8" };
          return (
            <button
              key={c}
              type="button"
              onClick={() => setCatF(c)}
              style={{
                padding: "10px 14px",
                border: "none",
                borderBottom: catF === c ? `2px solid ${DS.primary}` : "2px solid transparent",
                background: "transparent",
                whiteSpace: "nowrap",
                color: catF === c ? DS.primary : DS.textSecondary,
                fontWeight: catF === c ? 700 : 500,
                fontSize: 12,
                cursor: "pointer",
                flexShrink: 0,
                marginBottom: -1,
                fontFamily: "inherit",
              }}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      <div style={{ marginBottom: 12 }}>
        <select
          value={brF}
          onChange={e => setBrF(e.target.value)}
          style={{ ...inp, width: "100%", maxWidth: 280, fontSize: 13, padding: "10px 12px" }}
        >
          <option value="ALL">전체 지점</option>
          {BRANCHES.map(b => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {availFilterBtn("ALL", "전체")}
        {availFilterBtn("available", "대여가능")}
        {availFilterBtn("unavailable", "대여불가")}
        {availFilterBtn("newest", "최신 등록순")}
      </div>

      <div style={{ fontSize: 13, color: DS.textSecondary, marginBottom: 14, fontWeight: 600 }}>
        {list.length}개 교구
      </div>

      {list.length === 0 ? (
        <PanelSection title="교구 목록">
          <Empty text={emptyText}/>
        </PanelSection>
      ) : (
        <div className="gts-items-browse-grid">
          {list.map(item => {
            const avail = availQty(item, ris, rets);
            const added = inCart(item.id);
            const myRes = pendingRes(item.id);
            const scheduleLines = scheduleByItem.get(item.id);
            const hasPhoto = Boolean(item.photo_url);
            const isNewItem = isWithinLastWeek(item.created_at);
            const activityPhotos = parseActivityPhotos(item);
            return (
              <div
                key={item.id}
                style={{
                  ...panelCard,
                  marginBottom: 0,
                  padding: 0,
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() => {
                    if (hasPhoto) setLightbox({ src: item.photo_url, alt: item.name });
                  }}
                  disabled={!hasPhoto}
                  aria-label={hasPhoto ? `${item.name} 사진 크게 보기` : `${item.name} 사진 없음`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "100%",
                    height: 200,
                    padding: 12,
                    border: "none",
                    borderBottom: "1px solid #e8ecee",
                    background: "#f8fafc",
                    cursor: hasPhoto ? "zoom-in" : "default",
                    fontFamily: "inherit",
                    overflow: "hidden",
                  }}
                >
                  {hasPhoto ? (
                    <img
                      src={item.photo_url}
                      alt={item.name}
                      style={{
                        maxWidth: "100%",
                        maxHeight: "100%",
                        width: "auto",
                        height: "auto",
                        objectFit: "contain",
                        objectPosition: "center center",
                        pointerEvents: "none",
                      }}
                    />
                  ) : (
                    <CategoryIconFallback category={item.category} size={120}/>
                  )}
                </button>
                {isNewItem && (
                  <span style={{
                    position: "absolute",
                    top: 10,
                    left: 10,
                    background: DS.primary,
                    color: "#fff",
                    fontSize: 10,
                    fontWeight: 800,
                    padding: "3px 8px",
                    borderRadius: 6,
                    letterSpacing: "0.04em",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                  }}>
                    NEW
                  </span>
                )}
                {item.last_return_location && (
                  <span style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    background: "rgba(15,118,110,0.92)",
                    color: "#fff",
                    fontSize: 10,
                    fontWeight: 800,
                    padding: "3px 8px",
                    borderRadius: 6,
                    maxWidth: "70%",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
                  }}>
                    최근 반납: {item.last_return_location}
                  </span>
                )}
                </div>

                <div style={{ padding: "14px 16px", flex: 1, display: "flex", flexDirection: "column" }}>
                  <button
                    type="button"
                    onClick={() => onDetail?.(item)}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      margin: 0,
                      textAlign: "left",
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: 15, color: DS.textPrimary, lineHeight: 1.35 }}>
                        {item.name}
                      </div>
                    {item.alias ? (
                      <div style={{ fontSize: 11, color: DS.textMuted, marginTop: 3, lineHeight: 1.3 }}>
                        {item.alias}
                      </div>
                    ) : null}
                  </button>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
                    <CatTag cat={item.category}/>
                    {canEditItems(me) ? (
                      <button
                        type="button"
                        onClick={() => setEditItem({ ...item })}
                        style={{
                          marginLeft: "auto",
                          background: DS.primaryLight,
                          border: `1px solid ${DS.primary}`,
                          borderRadius: 8,
                          padding: "5px 10px",
                          cursor: "pointer",
                          fontSize: 11,
                          color: DS.primary,
                          fontWeight: 700,
                          fontFamily: "inherit",
                        }}
                      >
                        편집
                      </button>
                    ) : null}
                    {activityPhotos.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setLightbox({
                          images: activityPhotos,
                          alt: `${item.name} 활동 사진`,
                          index: 0,
                        })}
                        title={`활동 사진 ${activityPhotos.length}장`}
                        aria-label={`활동 사진 ${activityPhotos.length}장 보기`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 26,
                          height: 26,
                          padding: 0,
                          borderRadius: 6,
                          border: "1px solid #e2e8f0",
                          background: "#fff",
                          color: DS.textSecondary,
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        <PersonStanding size={14} strokeWidth={2} />
                      </button>
                    )}
                    {hasLastReturnInfo(item) && (
                      <button
                        type="button"
                        onClick={() => setReturnLocItem(item)}
                        title="반납 위치 찾기"
                        aria-label={`${item.name} 반납 위치 찾기`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 26,
                          height: 26,
                          padding: 0,
                          borderRadius: 6,
                          border: "1px solid #99f6e4",
                          background: "#fff",
                          color: "#0f766e",
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        <MapPin size={14} strokeWidth={2} />
                      </button>
                    )}
                  </div>
                  <div style={{
                    marginTop: 10,
                    fontSize: 13,
                    fontWeight: 700,
                    color: avail > 0 ? "#16a34a" : "#dc2626",
                  }}>
                    대여 가능 {avail}개
                  </div>
                  <ItemScheduleLines lines={scheduleLines}/>
                  <div style={{ marginTop: "auto", paddingTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                    <Btn
                      full
                      color={avail > 0 ? (added ? "#64748b" : DS.primary) : "#cbd5e1"}
                      disabled={avail === 0}
                      onClick={() => handleRent(item)}
                    >
                      {avail === 0 ? "대여 불가" : added ? "담김 · 빼기" : "장바구니 담기"}
                    </Btn>
                    {myRes ? (
                      <Btn
                        full
                        ghost
                        color="#dc2626"
                        onClick={() => {
                          if (!confirm("예약을 취소하시겠습니까?")) return;
                          onCancelReservation?.(myRes.id);
                        }}
                      >
                        예약취소
                      </Btn>
                    ) : (
                      <Btn
                        full
                        ghost
                        color="#0d9488"
                        onClick={() => setReserveItem(item)}
                      >
                        예약하기
                      </Btn>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {lightbox && (
        <ImageLightbox
          src={lightbox.src}
          images={lightbox.images}
          index={lightbox.index}
          alt={lightbox.alt}
          onClose={() => setLightbox(null)}
        />
      )}

      {returnLocItem && (
        <Modal title="반납 위치 찾기" onClose={() => setReturnLocItem(null)} center>
          <div style={{ fontSize: 13, fontWeight: 700, color: DS.textPrimary, marginBottom: 12 }}>
            {returnLocItem.name}
          </div>
          <LastReturnLocationCard item={returnLocItem} teachers={teachers} />
        </Modal>
      )}

      {reserveItem && (
        <ReservationModal
          item={reserveItem}
          onClose={() => setReserveItem(null)}
          onSubmit={(payload) => {
            onSubmitReservation?.({ ...payload, item_id: reserveItem.id });
            setReserveItem(null);
          }}
        />
      )}

      {editItem && onSaveItem && (
        <ItemForm
          key={editItem.id}
          item={editItem}
          items={items}
          onSave={onSaveItem}
          onClose={() => setEditItem(null)}
        />
      )}
    </PageShell>
  );
}

function ImageLightbox({ src, alt, images, index: initialIndex = 0, onClose }) {
  const list = useMemo(() => {
    if (images?.length) return images.filter(Boolean);
    if (src) return [src];
    return [];
  }, [images, src]);

  const [index, setIndex] = useState(() => (
    list.length ? Math.min(Math.max(initialIndex, 0), list.length - 1) : 0
  ));

  useEffect(() => {
    if (!list.length) return;
    setIndex(Math.min(Math.max(initialIndex, 0), list.length - 1));
  }, [initialIndex, list]);

  const goPrev = useCallback(() => {
    setIndex(i => (i - 1 + list.length) % list.length);
  }, [list.length]);

  const goNext = useCallback(() => {
    setIndex(i => (i + 1) % list.length);
  }, [list.length]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (list.length > 1 && e.key === "ArrowLeft") goPrev();
      if (list.length > 1 && e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, list.length, goPrev, goNext]);

  if (!list.length) return null;

  const currentSrc = list[index];
  const currentAlt = alt ? (list.length > 1 ? `${alt} ${index + 1}` : alt) : "";
  const hasMultiple = list.length > 1;
  const navBtnStyle = {
    position: "fixed",
    top: "50%",
    transform: "translateY(-50%)",
    zIndex: 1102,
    width: 44,
    height: 44,
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.25)",
    background: "rgba(255,255,255,0.12)",
    color: "#fff",
    cursor: "pointer",
    fontFamily: "inherit",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="사진 원본 보기"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1100,
        background: "rgba(15, 23, 42, 0.88)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="닫기"
        style={{
          position: "fixed",
          top: 16,
          right: 16,
          zIndex: 1102,
          width: 44,
          height: 44,
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.25)",
          background: "rgba(255,255,255,0.12)",
          color: "#fff",
          fontSize: 20,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        ✕
      </button>
      {hasMultiple && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            aria-label="이전 사진"
            style={{ ...navBtnStyle, left: 16 }}
          >
            <ChevronLeft size={24} />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            aria-label="다음 사진"
            style={{ ...navBtnStyle, right: 16 }}
          >
            <ChevronRight size={24} />
          </button>
          <div style={{
            position: "fixed",
            bottom: 20,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1102,
            color: "rgba(255,255,255,0.85)",
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: "0.04em",
          }}>
            {index + 1} / {list.length}
          </div>
        </>
      )}
      <img
        key={currentSrc}
        src={currentSrc}
        alt={currentAlt}
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: "min(100%, 1200px)",
          maxHeight: "calc(100vh - 48px)",
          width: "auto",
          height: "auto",
          objectFit: "contain",
          borderRadius: 8,
          boxShadow: "0 16px 48px rgba(0,0,0,0.45)",
        }}
      />
    </div>
  );
}

function ItemIdeasSection({ itemId, me }) {
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [liking, setLiking] = useState(null);

  const load = useCallback(async () => {
    if (!itemId) return;
    setLoading(true);
    try {
      const rows = await fetchItemIdeas(supabase, itemId, me?.id);
      setIdeas(rows);
    } catch (e) {
      console.error(e);
      setIdeas([]);
    } finally {
      setLoading(false);
    }
  }, [itemId, me?.id]);

  useEffect(() => { load(); }, [load]);

  const onLike = async (idea) => {
    if (!me?.id || liking) return;
    setLiking(idea.id);
    try {
      await toggleItemIdeaLike(supabase, idea.id, me.id, idea.liked_by_me);
      await load();
    } catch (e) {
      alert("좋아요 처리 오류: " + e.message);
    } finally {
      setLiking(null);
    }
  };

  return (
    <PanelSection title="선생님들의 활용 아이디어">
      {loading ? (
        <Spinner text="아이디어 불러오는 중..."/>
      ) : ideas.length === 0 ? (
        <Empty text="아직 공유된 활용 아이디어가 없습니다"/>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {ideas.map(idea => (
            <div
              key={idea.id}
              style={{
                ...card,
                marginBottom: 0,
                padding: "14px 16px",
              }}
            >
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 10,
                marginBottom: 8,
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: DS.textPrimary }}>
                    {idea.teacher_name}
                  </div>
                  <div style={{ fontSize: 11, color: DS.textMuted, marginTop: 2 }}>
                    {fmt(idea.created_at)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onLike(idea)}
                  disabled={!me?.id || liking === idea.id}
                  title={idea.liked_by_me ? "좋아요 취소" : "좋아요"}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: `1px solid ${idea.liked_by_me ? DS.primary : "#e2e8f0"}`,
                    background: idea.liked_by_me ? DS.primaryLight : "#fff",
                    color: idea.liked_by_me ? DS.primary : DS.textSecondary,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: me?.id ? "pointer" : "default",
                    fontFamily: "inherit",
                    flexShrink: 0,
                  }}
                >
                  👍 {idea.like_count || 0}
                </button>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.75, color: DS.textPrimary, whiteSpace: "pre-wrap" }}>
                {idea.content}
              </div>
            </div>
          ))}
        </div>
      )}
    </PanelSection>
  );
}

function ItemDetailPage({item,ris,rets,reqs,teachers,cart,setCart,onBack,backLabel="보유 자산으로",me,onForceReturn}) {
  const [photoLightbox, setPhotoLightbox] = useState(false);
  const [activityLightbox, setActivityLightbox] = useState(null);
  const activityPhotos = useMemo(() => parseActivityPhotos(item), [item]);
  const admin = canManage(me);
  const avail=availQty(item,ris,rets),added=cart.some(c=>c.item_id===item.id);
  const currR=ris.filter(ri=>["rented","partial_returned"].includes(ri.status)&&ri.item_id===item.id);
  const history=useMemo(()=>buildItemRentalHistory(item.id,ris,reqs,teachers,rets),[item.id,ris,reqs,teachers,rets]);
  const ytId=(url)=>{if(!url)return null;const m=url.match(/(?:v=|embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);return m?m[1]:null;};
  const vid=ytId(item.youtube_url);
  return(
    <PageShell>
      <button onClick={onBack} style={{
        background:"#fff",border:"1px solid #e8ecee",borderRadius:10,
        color:DS.primary,fontWeight:600,fontSize:12,cursor:"pointer",
        padding:"8px 14px",marginBottom:20,fontFamily:"inherit",
      }}>← {backLabel}</button>

      <PageHeader me={me} subtitle={PAGE_META["item-detail"].sub}/>

      <PanelSection>
        {item.photo_url && (
          <>
            <button
              type="button"
              onClick={() => setPhotoLightbox(true)}
              aria-label="사진 원본 크기로 보기"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                height: 300,
                marginBottom: 14,
                padding: 12,
                borderRadius: 14,
                border: "1px solid #e2e8f0",
                background: "#f8fafc",
                cursor: "zoom-in",
                fontFamily: "inherit",
                overflow: "hidden",
              }}
            >
              <img
                src={item.photo_url}
                alt={item.name}
                style={{
                  maxWidth: "100%",
                  maxHeight: "100%",
                  width: "auto",
                  height: "auto",
                  objectFit: "contain",
                  objectPosition: "center center",
                  pointerEvents: "none",
                }}
              />
            </button>
            {photoLightbox && (
              <ImageLightbox
                src={item.photo_url}
                alt={item.name}
                onClose={() => setPhotoLightbox(false)}
              />
            )}
          </>
        )}
        <LastReturnLocationCard item={item} teachers={teachers} style={{ marginBottom: 14 }} />
        <div style={{display:"flex",gap:12,marginBottom:14}}>
          {!item.photo_url&&(
            <div style={{width:56,height:56,borderRadius:12,background:"#f8fafc",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:DS.textMuted,flexShrink:0,border:"1px solid #e2e8f0"}}>
              {item.code?.slice(0,4)||"GTS"}
            </div>
          )}
          <div>
            <div style={{fontSize:18,fontWeight:900,color:DS.textPrimary}}>{item.name}</div>
            {item.alias&&<div style={{fontSize:12,color:DS.textMuted,marginTop:2}}>({item.alias})</div>}
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:5}}>
              <CatTag cat={item.category}/>
              <span style={{fontFamily:"monospace",fontSize:10,color:DS.textMuted,background:"#f8fafc",padding:"2px 7px",borderRadius:5}}>{item.code}</span>
              <span style={{fontSize:10,background:"#f8fafc",color:DS.textSecondary,padding:"2px 8px",borderRadius:99,border:"1px solid #e2e8f0"}}>{item.branch}</span>
            </div>
          </div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7,marginBottom:14}}>
          {[["전체",item.total_quantity,"#334155","#f1f5f9"],["대여중",rentedQty(item.id,ris,rets),"#7c3aed","#ede9fe"],["신청중",pendingQty(item.id,ris),"#d97706","#fef3c7"],["가능",avail,avail>0?"#16a34a":"#dc2626",avail>0?"#dcfce7":"#fee2e2"]].map(([l,v,c,bg])=>(
            <div key={l} style={{background:bg,borderRadius:12,padding:"10px 4px",textAlign:"center"}}>
              <div style={{fontSize:20,fontWeight:900,color:c}}>{v}</div>
              <div style={{fontSize:10,color:c,fontWeight:700,opacity:0.7,marginTop:1}}>{l}</div>
            </div>
          ))}
        </div>

        <Btn full
          color={added?"#dc2626":avail>0?DS.primary:"#cbd5e1"}
          disabled={!added&&avail===0}
          onClick={()=>{if(added)setCart(p=>p.filter(c=>c.item_id!==item.id));else setCart(p=>[...p,{item_id:item.id,quantity:1,due_date:""}]);}}>
          {added?"장바구니에서 빼기":avail>0?"장바구니에 담기":"대여 불가"}
        </Btn>

        <div style={{...panelCard,padding:18,marginTop:14,textAlign:"center"}}>
          <div style={{fontSize:12,fontWeight:700,color:DS.textSecondary,marginBottom:12}}>교구 QR 코드</div>
          <div style={{display:"inline-block",padding:10,background:"#fff",borderRadius:12,border:"1px solid #e8ecee"}}>
            <GearQrDisplay item={item} size={140}/>
          </div>
          <div style={{fontSize:10,color:DS.textMuted,marginTop:10,wordBreak:"break-all",lineHeight:1.5}}>
            {itemQrPayload(item)}
          </div>
        </div>
      </PanelSection>

      {item.description&&(
        <div style={card}>
          <div style={{fontSize:12,fontWeight:700,color:DS.textSecondary,marginBottom:7}}>설명</div>
          <div style={{fontSize:13,lineHeight:1.8,color:DS.textPrimary}}>{item.description}</div>
        </div>
      )}
      {activityPhotos.length > 0 && (
        <div style={card}>
          <ItemActivityGallery
            photos={activityPhotos}
            onPhotoClick={setActivityLightbox}
          />
        </div>
      )}
      {activityLightbox && (
        <ImageLightbox
          src={activityLightbox.src}
          alt={activityLightbox.alt}
          onClose={() => setActivityLightbox(null)}
        />
      )}
      {item.usage_description&&(
        <div style={card}>
          <div style={{fontSize:12,fontWeight:700,color:DS.textSecondary,marginBottom:7}}>사용 방법</div>
          <div style={{fontSize:13,lineHeight:1.8,color:DS.textPrimary}}>{item.usage_description}</div>
        </div>
      )}
      {item.safety_notes&&(
        <div style={{...card,borderLeft:"3px solid #f59e0b"}}>
          <div style={{fontSize:12,fontWeight:700,color:"#d97706",marginBottom:7}}>안전 주의사항</div>
          <div style={{fontSize:13,lineHeight:1.8,color:DS.textPrimary}}>{item.safety_notes}</div>
        </div>
      )}
      {vid&&(
        <div style={card}>
          <div style={{fontSize:12,fontWeight:700,color:DS.textSecondary,marginBottom:9}}>사용법 영상</div>
          <div style={{borderRadius:12,overflow:"hidden"}}>
            <iframe width="100%" height="195" src={`https://www.youtube.com/embed/${vid}`} frameBorder="0" allowFullScreen style={{display:"block"}}/>
          </div>
        </div>
      )}
      <ItemIdeasSection itemId={item.id} me={me}/>
      {currR.length > 0 && (
        <PanelSection title={`현재 대여 중 (${currR.length}건)`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {currR.map(ri => {
              const req = reqs.find(r => r.id === ri.request_id);
              const dd = ddayTag(ri.due_date);
              const teacherName = req ? tname(req.teacher_id, teachers) : "-";
              return (
                <div
                  key={ri.id}
                  style={{
                    ...card,
                    marginBottom: 0,
                    borderLeft: `3px solid ${DS.primary}`,
                    padding: "14px 16px",
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: 15, color: DS.textPrimary, marginBottom: 10 }}>
                    {teacherName}
                  </div>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: "10px 16px",
                    fontSize: 12,
                  }}>
                    <div>
                      <div style={{ color: DS.textMuted, marginBottom: 3 }}>파견지</div>
                      <div style={{ fontWeight: 600, color: DS.textPrimary }}>{req?.dispatch_location || "-"}</div>
                    </div>
                    <div>
                      <div style={{ color: DS.textMuted, marginBottom: 3 }}>수량</div>
                      <div style={{ fontWeight: 700, color: DS.textPrimary }}>{ri.quantity}개</div>
                    </div>
                    <div>
                      <div style={{ color: DS.textMuted, marginBottom: 3 }}>파견 기간</div>
                      <div style={{ fontWeight: 600, color: DS.textSecondary, lineHeight: 1.45 }}>
                        {req?.dispatch_start || req?.dispatch_end
                          ? `${fmt(req.dispatch_start)} ~ ${fmt(req.dispatch_end)}`
                          : "-"}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: DS.textMuted, marginBottom: 3 }}>반납예정</div>
                      <div style={{ fontWeight: 700, color: dd?.color || DS.textPrimary }}>
                        {ri.due_date ? fmt(ri.due_date) : "-"}
                        {dd?.text ? ` · ${dd.text}` : ""}
                      </div>
                    </div>
                  </div>
                  {onForceReturn && (
                    <div style={{ marginTop: 12 }}>
                      <ForceReturnButton ri={ri} me={me} itemName={item?.name} onForceReturn={onForceReturn}/>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </PanelSection>
      )}

      <PanelSection title={`대여 히스토리 (${history.length}건)`}>
        {history.length===0 ? <Empty text="대여 기록이 없습니다"/> : (
          <div style={{overflowX:"auto"}}>
            <div style={{
              display:"grid",gridTemplateColumns:"minmax(72px,1fr) minmax(56px,0.8fr) minmax(80px,1fr) minmax(48px,0.5fr) minmax(72px,0.8fr) minmax(64px,0.7fr)",
              gap:8,padding:"8px 0",borderBottom:"1px solid #e2e8f0",fontSize:10,fontWeight:700,color:DS.textMuted,
            }}>
              <span>대여자</span><span>파견지</span><span>기간</span><span>수량</span><span>반납예정</span><span>상태</span>
            </div>
            {history.map(h=>{
              const dd=ddayTag(h.due_date);
              return(
                <div key={h.id} style={{
                  display:"grid",gridTemplateColumns:"minmax(72px,1fr) minmax(56px,0.8fr) minmax(80px,1fr) minmax(48px,0.5fr) minmax(72px,0.8fr) minmax(64px,0.7fr)",
                  gap:8,padding:"10px 0",borderTop:"1px solid #f8fafc",fontSize:11,alignItems:"center",
                }}>
                  <span style={{fontWeight:600,color:DS.textPrimary}}>{h.teacherName}</span>
                  <span style={{color:DS.textSecondary}}>{h.location}</span>
                  <span style={{color:DS.textMuted,fontSize:10}}>{h.start?`${fmt(h.start)}~`:""}{h.end?fmt(h.end):"-"}</span>
                  <span style={{fontWeight:700}}>{h.quantity}개</span>
                  <span style={{color:dd?.color,fontWeight:dd?.urgent?700:500}}>{h.due_date?fmt(h.due_date):"-"}</span>
                  {h.forceReturn ? (
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#dc2626", lineHeight: 1.4 }}>
                      {FORCE_RETURN_MEMO}
                      {h.forceReturnBy && (
                        <span style={{ display: "block", color: DS.textMuted, fontWeight: 600, marginTop: 2 }}>
                          {h.forceReturnBy} · {fmt(h.forceReturnAt)}
                        </span>
                      )}
                    </span>
                  ) : (
                    <Badge s={h.status}/>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </PanelSection>
    </PageShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 대여 현황 (선생님별) — 대시보드 스타일
// ═══════════════════════════════════════════════════════════════════════
function buildTeacherSummaries(teachers, reqs, ris, items, rets) {
  return teachers
    .map(teacher => {
      const lines = ris
        .map(ri => {
          const req = reqs.find(r => r.id === ri.request_id && r.teacher_id === teacher.id);
          if (!req) return null;
          const d = ri.due_date ? dday(ri.due_date) : null;
          const isCurrent = ["rented", "partial_returned"].includes(ri.status);
          const isOverdue = isCurrent && d !== null && d < 0;
          const isReturned = ri.status === "returned";
          const forceRet = (rets || [])
            .filter(r => r.rental_item_id === ri.id && r.status === "return_approved" && (r.memo || "").includes("강제 반납"))
            .sort((a, b) => new Date(b.approved_at || 0) - new Date(a.approved_at || 0))[0];
          return {
            ri, req,
            item: items.find(i => i.id === ri.item_id),
            d, isCurrent, isOverdue, isReturned,
            sortAt: ri.approved_at || ri.created_at || req.created_at || "",
            forceReturn: forceRet || null,
            forceReturnBy: forceRet ? tname(forceRet.approved_by, teachers) : null,
            forceReturnAt: forceRet?.approved_at || null,
          };
        })
        .filter(Boolean);

      const current = lines.filter(l => l.isCurrent);
      const overdue = current.filter(l => l.isOverdue);
      const returned = lines.filter(l => l.isReturned);

      return {
        teacher,
        lines,
        current,
        overdue,
        itemCount: current.length,
        totalQty: current.reduce((s, l) => s + l.ri.quantity, 0),
        hasOverdue: overdue.length > 0,
        hasCurrent: current.length > 0,
        returnedCount: returned.length,
      };
    });
}

function MiniBadge({label,bg,color}) {
  return (
    <span style={{
      display:"inline-block",padding:"3px 10px",borderRadius:99,
      fontSize:10,fontWeight:700,background:bg,color,
    }}>{label}</span>
  );
}

function ForceReturnModal({ itemLabel, onClose, onConfirm }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const text = reason.trim();
    if (!text) return alert("강제반납 사유를 입력하세요");
    if (!confirm("강제 반납 처리하시겠습니까?\n선생님 확인 없이 즉시 반납됩니다.")) return;
    setBusy(true);
    try {
      const ok = await onConfirm(text);
      if (ok) onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1100,
      background: "rgba(15,23,42,0.55)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }} onClick={onClose}>
      <div style={{
        background: "#fff", borderRadius: 16, width: "100%", maxWidth: 480,
        padding: "24px 20px", boxShadow: "0 24px 48px rgba(0,0,0,0.18)",
      }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 17, fontWeight: 800, color: DS.textPrimary, marginBottom: 8 }}>강제반납</div>
        {itemLabel && (
          <div style={{ fontSize: 13, color: DS.textSecondary, marginBottom: 16 }}>{itemLabel}</div>
        )}
        <Txa2
          label="강제반납 사유 *"
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="반납 사유를 입력하세요 (필수)"
        />
        <div style={{ display: "flex", gap: 8 }}>
          <Btn full ghost onClick={onClose} disabled={busy}>취소</Btn>
          <Btn full danger onClick={submit} disabled={busy}>강제반납 처리</Btn>
        </div>
      </div>
    </div>
  );
}

function ForceReturnButton({ ri, me, onForceReturn, itemName, onClick }) {
  const [open, setOpen] = useState(false);
  if (!isSuperAdmin(me) || !onForceReturn || !ri?.id) return null;

  return (
    <>
      <Btn
        sm
        danger
        onClick={(e) => {
          e.stopPropagation();
          onClick?.(e);
          setOpen(true);
        }}
      >
        강제반납
      </Btn>
      {open && (
        <ForceReturnModal
          itemLabel={itemName ? `${itemName} · ${ri.quantity}개` : undefined}
          onClose={() => setOpen(false)}
          onConfirm={reason => onForceReturn(ri, reason)}
        />
      )}
    </>
  );
}

function RentalApprovalPage({me,reqs,ris,items,teachers,onApprove,onReject}) {
  const [rejectId,setRejectId]=useState(null);
  const [reason,setReason]=useState("");
  const pendReqs=reqs.filter(r=>r.status==="pending");

  const approvedRows = useMemo(() => reqs
    .filter(r => ["approved", "partial", "completed"].includes(r.status))
    .map(req => {
      const reqRIs = ris.filter(ri => ri.request_id === req.id && !["pending", "rejected", "cancelled"].includes(ri.status));
      const approverId = req.approved_by || reqRIs.find(ri => ri.approved_by)?.approved_by;
      const approvedAt = req.approved_at
        || reqRIs.map(ri => ri.approved_at).filter(Boolean).sort((a, b) => new Date(b) - new Date(a))[0];
      return {
        req,
        reqRIs,
        teacherName: tname(req.teacher_id, teachers),
        rentDate: req.dispatch_start,
        approverName: approverId ? tname(approverId, teachers) : "-",
        approvedAt,
      };
    })
    .filter(row => row.reqRIs.length > 0 || row.req.approved_by)
    .sort((a, b) => new Date(b.approvedAt || b.req.created_at) - new Date(a.approvedAt || a.req.created_at)),
  [reqs, ris, teachers]);

  const approvalTableHead = {
    display: "grid",
    gap: 8,
    padding: "8px 0",
    borderBottom: "1px solid #e2e8f0",
    fontSize: 10,
    fontWeight: 700,
    color: DS.textMuted,
    gridTemplateColumns: "minmax(72px, 0.9fr) minmax(72px, 0.8fr) minmax(72px, 0.9fr) minmax(108px, 1.1fr) minmax(120px, 1.6fr) minmax(56px, 0.6fr)",
  };
  const approvalTableRow = {
    display: "grid",
    gap: 8,
    padding: "12px 0",
    borderTop: "1px solid #f8fafc",
    fontSize: 12,
    alignItems: "start",
    gridTemplateColumns: "minmax(72px, 0.9fr) minmax(72px, 0.8fr) minmax(72px, 0.9fr) minmax(108px, 1.1fr) minmax(120px, 1.6fr) minmax(56px, 0.6fr)",
  };

  return (
    <PageShell>
      <PageHeader me={me} subtitle={PAGE_META["rental-approval"].sub} alertCount={pendReqs.length}/>

      <div style={{
        display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",
        gap:14,marginBottom:24,
      }}>
        <DashStatCard label="승인 대기" value={pendReqs.length} iconMark="대기" iconBg="#fef3c7" iconColor="#d97706"/>
        <DashStatCard label="승인 완료" value={approvedRows.length} iconMark="완료" iconBg="#dcfce7" iconColor="#16a34a"/>
      </div>

      {pendReqs.length===0 ? (
        <PanelSection title="대여 승인 대기">
          <Empty text="승인 대기 중인 대여 신청이 없습니다"/>
        </PanelSection>
      ) : pendReqs.map(req=>{
        const t=teachers.find(x=>x.id===req.teacher_id);
        const reqRIs=ris.filter(ri=>ri.request_id===req.id);
        return(
          <PanelSection key={req.id} title={`${t?.name||"선생님"} · ${req.dispatch_location}`}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
              <div style={{fontSize:12,color:DS.textSecondary,lineHeight:1.7}}>
                <div><strong style={{color:DS.textPrimary}}>대여자</strong> {t?.name||"-"}</div>
                <div><strong style={{color:DS.textPrimary}}>대여기간</strong> {fmt(req.dispatch_start)} ~ {fmt(req.dispatch_end)}</div>
                {req.memo&&<div style={{marginTop:4,color:DS.textMuted}}>메모: {req.memo}</div>}
                <div style={{marginTop:4}}>신청일: {fmt(req.created_at)}</div>
              </div>
              <Badge s="pending"/>
            </div>
            <div style={{marginBottom:12}}>
              {reqRIs.map(ri=>(
                <div key={ri.id} style={{
                  fontSize:13,padding:"8px 0",borderTop:"1px solid #f1f5f9",
                  display:"flex",justifyContent:"space-between",color:DS.textPrimary,
                }}>
                  <span style={{fontWeight:600}}>{iname(ri.item_id,items)}</span>
                  <span style={{color:DS.textSecondary}}>×{ri.quantity}개 · 반납예정 {ri.due_date?fmt(ri.due_date):"-"}</span>
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <Btn sm color={DS.primary} onClick={()=>onApprove(req.id)}>승인</Btn>
              <Btn sm danger onClick={()=>{setRejectId(req.id);setReason("");}}>거절</Btn>
            </div>
          </PanelSection>
        );
      })}

      <PanelSection title={`대여 승인 내역 (${approvedRows.length})`}>
        {approvedRows.length === 0 ? (
          <Empty text="승인된 대여 내역이 없습니다"/>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <div style={{ ...approvalTableHead, minWidth: 640 }}>
              <span>대여자</span>
              <span>대여일</span>
              <span>승인자</span>
              <span>승인일시</span>
              <span>교구</span>
              <span>상태</span>
            </div>
            {approvedRows.map(({ req, reqRIs, teacherName, rentDate, approverName, approvedAt }) => {
              const itemSummary = reqRIs.map(ri => `${iname(ri.item_id, items)} ×${ri.quantity}`).join(", ");
              const statusKey = req.status === "completed" ? "completed" : req.status === "partial" ? "partial" : "approved";
              return (
                <div key={req.id} style={{ ...approvalTableRow, minWidth: 640 }}>
                  <span style={{ fontWeight: 700, color: DS.textPrimary }}>{teacherName}</span>
                  <span style={{ color: DS.textSecondary }}>{fmt(rentDate)}</span>
                  <span style={{ fontWeight: 600, color: DS.textPrimary }}>{approverName}</span>
                  <span style={{ color: DS.textSecondary, lineHeight: 1.5 }}>{fmtdt(approvedAt)}</span>
                  <span style={{ color: DS.textSecondary, lineHeight: 1.5 }}>{itemSummary || "-"}</span>
                  <span><Badge s={statusKey}/></span>
                </div>
              );
            })}
          </div>
        )}
      </PanelSection>

      {rejectId&&(
        <Modal title="거절 사유 입력" onClose={()=>setRejectId(null)}>
          <Txa2 label="거절 사유 *" value={reason} onChange={e=>setReason(e.target.value)} placeholder="거절 이유를 입력하세요 (선생님에게 표시됩니다)"/>
          <Btn full danger onClick={()=>{
            if(!reason.trim())return alert("거절 사유를 입력하세요");
            onReject(rejectId,reason);
            setRejectId(null);
          }}>거절 처리</Btn>
        </Modal>
      )}
    </PageShell>
  );
}

function ReservationApprovalPage({ me, reservations, items, teachers, onApprove, onReject }) {
  const [rejectId, setRejectId] = useState(null);
  const [reason, setReason] = useState("");
  const pendRes = (reservations || []).filter(r => r.status === "pending");

  return (
    <PageShell>
      <PageHeader me={me} subtitle={PAGE_META["reservation-approval"].sub} alertCount={pendRes.length}/>

      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
        gap: 14, marginBottom: 24,
      }}>
        <DashStatCard label="예약 대기" value={pendRes.length} iconMark="예약" iconBg="#ccfbf1" iconColor="#0d9488"/>
      </div>

      {pendRes.length === 0 ? (
        <PanelSection title="예약 승인 대기">
          <Empty text="승인 대기 중인 예약이 없습니다"/>
        </PanelSection>
      ) : pendRes.map(res => {
        const t = teachers.find(x => x.id === res.teacher_id);
        const item = items.find(i => i.id === res.item_id);
        return (
          <PanelSection key={res.id} title={`${t?.name || "선생님"} · ${item?.name || "-"}`}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: DS.textSecondary, lineHeight: 1.7 }}>
                <div>사용 장소: {res.location}</div>
                <div>예약 기간: {fmt(res.start_date)} ~ {fmt(res.end_date)}</div>
                <div>수량: {res.quantity}개</div>
                <div style={{ marginTop: 4 }}>신청일: {fmt(res.created_at)}</div>
              </div>
              <ReservationBadge res={res}/>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Btn sm color={DS.primary} onClick={() => onApprove(res.id)}>승인</Btn>
              <Btn sm danger onClick={() => { setRejectId(res.id); setReason(""); }}>거절</Btn>
            </div>
          </PanelSection>
        );
      })}

      {rejectId && (
        <Modal title="예약 거절 사유" onClose={() => setRejectId(null)}>
          <Txa2 label="거절 사유 *" value={reason} onChange={e => setReason(e.target.value)} placeholder="거절 이유를 입력하세요"/>
          <Btn full danger onClick={() => {
            if (!reason.trim()) return alert("거절 사유를 입력하세요");
            onReject(rejectId, reason);
            setRejectId(null);
          }}>거절 처리</Btn>
        </Modal>
      )}
    </PageShell>
  );
}

function MyReservationsPage({ me, reservations, items, ris, rets, onCancel }) {
  const currentYmd = useTodayYmd();
  const mine = useMemo(
    () => (reservations || [])
      .filter(r => r.teacher_id === me.id)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [reservations, me.id]
  );
  const rows = useMemo(
    () => mine.map(res => ({
      res,
      status: reservationLifecycleStatus(res, ris, rets, currentYmd),
    })),
    [mine, ris, rets, currentYmd],
  );
  const groups = [
    {
      key: "reserved",
      title: "예약 중인 교구",
      empty: "예약 중인 교구가 없습니다",
      rows: rows.filter(row => ["pending", "reserved"].includes(row.status)),
    },
    {
      key: "rented",
      title: "대여 중인 교구",
      empty: "현재 대여 중인 교구가 없습니다",
      rows: rows.filter(row => ["rented", "return_pending"].includes(row.status)),
    },
    {
      key: "done",
      title: "완료된 예약",
      empty: "완료된 예약이 없습니다",
      rows: rows.filter(row => ["returned", "rejected", "cancelled"].includes(row.status)),
    },
  ];

  return (
    <PageShell>
      <PageHeader me={me} subtitle={PAGE_META["my-reservations"].sub}/>

      {mine.length === 0 ? (
        <PanelSection title="내 예약">
          <Empty text="예약 내역이 없습니다"/>
        </PanelSection>
      ) : groups.map(group => (
        <PanelSection key={group.key} title={`${group.title} (${group.rows.length})`}>
          {group.rows.length === 0 ? (
            <Empty text={group.empty}/>
          ) : group.rows.map(({ res, status }) => {
            const item = items.find(i => i.id === res.item_id);
            return (
              <div key={res.id} style={{ ...card, borderLeft: `3px solid ${RSC[status]?.c || "#e2e8f0"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
                  <div style={{ fontSize: 13, color: DS.textSecondary, lineHeight: 1.7 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: DS.textPrimary, marginBottom: 5 }}>
                      {item?.name || "교구"}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 6 }}>
                      <CatTag cat={item?.category}/>
                      <span style={{ fontFamily: "monospace", fontSize: 10, color: DS.textMuted }}>{item?.code}</span>
                    </div>
                    <div>사용 장소: {res.location}</div>
                    <div>예약 기간: {fmt(res.start_date)} ~ {fmt(res.end_date)}</div>
                    <div>수량: {res.quantity}개</div>
                    <div>신청일: {fmt(res.created_at)}</div>
                    {res.rejection_reason && (
                      <div style={{ marginTop: 6, color: "#dc2626", fontWeight: 600 }}>거절 사유: {res.rejection_reason}</div>
                    )}
                  </div>
                  <ReservationBadge res={res} status={status}/>
                </div>
                {res.status === "pending" && (
                  <Btn sm ghost color="#dc2626" onClick={() => {
                    if (!confirm("예약을 취소하시겠습니까?")) return;
                    onCancel(res.id);
                  }}>예약 취소</Btn>
                )}
              </div>
            );
          })}
        </PanelSection>
      ))}
    </PageShell>
  );
}

function ReturnsApprovalPage({me,rets,ris,items,teachers,onApproveRet,onDamage,onLoss}) {
  const pendRets = filterReturnPendingLastWeek(rets);

  const approvedRows = useMemo(() => (rets || [])
    .filter(r => ["return_approved", "damage_confirmed", "loss_confirmed"].includes(r.status))
    .map(ret => {
      const ri = ris.find(r => r.id === ret.rental_item_id);
      return {
        ret,
        teacherName: tname(ret.teacher_id, teachers),
        returnDate: ret.created_at,
        approverName: ret.approved_by ? tname(ret.approved_by, teachers) : "-",
        approvedAt: ret.approved_at,
        itemLabel: ri
          ? `${iname(ri.item_id, items)} ×${ret.quantity}`
          : `교구 ×${ret.quantity}`,
      };
    })
    .sort((a, b) => new Date(b.approvedAt || b.returnDate) - new Date(a.approvedAt || a.returnDate)),
  [rets, ris, items, teachers]);

  const historyTableHead = {
    display: "grid",
    gap: 8,
    padding: "8px 0",
    borderBottom: "1px solid #e2e8f0",
    fontSize: 10,
    fontWeight: 700,
    color: DS.textMuted,
    gridTemplateColumns: "minmax(72px, 0.9fr) minmax(72px, 0.8fr) minmax(72px, 0.9fr) minmax(108px, 1.1fr) minmax(120px, 1.6fr) minmax(72px, 0.7fr)",
  };
  const historyTableRow = {
    display: "grid",
    gap: 8,
    padding: "12px 0",
    borderTop: "1px solid #f8fafc",
    fontSize: 12,
    alignItems: "start",
    gridTemplateColumns: "minmax(72px, 0.9fr) minmax(72px, 0.8fr) minmax(72px, 0.9fr) minmax(108px, 1.1fr) minmax(120px, 1.6fr) minmax(72px, 0.7fr)",
  };

  return (
    <PageShell>
      <PageHeader me={me} subtitle={`${PAGE_META["returns-approval"].sub} (최근 7일)`} alertCount={pendRets.length}/>

      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
        gap: 14, marginBottom: 24,
      }}>
        <DashStatCard label="승인 대기" value={pendRets.length} iconMark="대기" iconBg="#fef9c3" iconColor="#ca8a04"/>
        <DashStatCard label="승인 완료" value={approvedRows.length} iconMark="완료" iconBg="#dcfce7" iconColor="#16a34a"/>
      </div>

      {pendRets.length === 0 ? (
        <PanelSection title="반납 승인 대기">
          <Empty text="승인 대기 중인 반납 신청이 없습니다"/>
        </PanelSection>
      ) : pendRets.map(ret => {
        const ri = ris.find(r => r.id === ret.rental_item_id);
        return (
          <PanelSection key={ret.id} title={iname(ri?.item_id, items)}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
              <div style={{fontSize:13,color:DS.textSecondary,lineHeight:1.7}}>
                <div>반납자: {tname(ret.teacher_id, teachers)}</div>
                <div>수량: {ret.quantity}개 · <Badge s={ret.status}/></div>
                {ret.memo && <div style={{marginTop:4,color:DS.textMuted}}>{ret.memo}</div>}
              </div>
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <Btn sm color={DS.primary} onClick={() => onApproveRet(ret.id)}>승인</Btn>
              {ret.condition === "damaged" && <Btn sm danger onClick={() => onDamage(ret.id)}>파손확인</Btn>}
              {ret.condition === "lost" && <Btn sm color="#be185d" onClick={() => onLoss(ret.id)}>분실확인</Btn>}
            </div>
          </PanelSection>
        );
      })}

      <PanelSection title={`반납 승인 내역 (${approvedRows.length}건)`}>
        {approvedRows.length === 0 ? (
          <Empty text="승인된 반납 내역이 없습니다"/>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <div style={{ ...historyTableHead, minWidth: 680 }}>
              <span>반납자</span>
              <span>반납일</span>
              <span>승인자</span>
              <span>승인일시</span>
              <span>교구</span>
              <span>상태</span>
            </div>
            {approvedRows.map(({ ret, teacherName, returnDate, approverName, approvedAt, itemLabel }) => (
              <div key={ret.id} style={{ ...historyTableRow, minWidth: 680 }}>
                <span style={{ fontWeight: 700, color: DS.textPrimary }}>{teacherName}</span>
                <span style={{ color: DS.textSecondary }}>{fmt(returnDate)}</span>
                <span style={{ fontWeight: 600, color: DS.textPrimary }}>{approverName}</span>
                <span style={{ color: DS.textSecondary, lineHeight: 1.5 }}>{fmtdt(approvedAt)}</span>
                <span style={{ color: DS.textSecondary, lineHeight: 1.5 }}>{itemLabel}</span>
                <span><Badge s={ret.status}/></span>
              </div>
            ))}
          </div>
        )}
      </PanelSection>
    </PageShell>
  );
}

function InstitutionsPage({me,items,ris}) {
  const branches = useMemo(() => {
    const list = [...new Set([...BRANCHES, ...items.map(i => i.branch).filter(Boolean)])];
    return list.map(br => {
      const brItems = items.filter(i => i.branch === br);
      const total = brItems.reduce((s, i) => s + i.total_quantity, 0);
      const rented = brItems.reduce((s, i) => s + rentedQty(i.id, ris), 0);
      return { br, count: brItems.length, total, rented, avail: total - rented };
    });
  }, [items, ris]);

  return (
    <PageShell>
      <PageHeader me={me} subtitle={PAGE_META.institutions.sub}/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:14}}>
        {branches.map(b => (
          <div key={b.br} style={panelCard}>
            <div style={{fontSize:16,fontWeight:700,color:"#111827",marginBottom:10}}>{b.br}</div>
            <div style={{fontSize:12,color:DS.textSecondary,lineHeight:1.8}}>
              <div>교구 {b.count}종 · 전체 {b.total}개</div>
              <div>대여 {b.rented} · 가능 {b.avail}</div>
            </div>
          </div>
        ))}
      </div>
    </PageShell>
  );
}

function ReportPage({ me, items, ris, rets, reqs, teachers }) {
  const monthOptions = useMemo(() => buildRecentMonthOptions(12), []);
  const [monthKey, setMonthKey] = useState(() => monthOptions[0]?.key || "");

  const report = useMemo(
    () => computeMonthlyReport(monthKey, { ris, rets, reqs, items, teachers }),
    [monthKey, ris, rets, reqs, items, teachers]
  );

  const selectedLabel = monthOptions.find(m => m.key === monthKey)?.label || "";

  const tableHead = {
    display: "grid",
    gap: 8,
    padding: "8px 0",
    borderBottom: "1px solid #e2e8f0",
    fontSize: 10,
    fontWeight: 700,
    color: DS.textMuted,
  };
  const tableRow = {
    display: "grid",
    gap: 8,
    padding: "10px 0",
    borderTop: "1px solid #f8fafc",
    fontSize: 12,
    alignItems: "center",
  };

  return (
    <PageShell>
      <PageHeader me={me} subtitle={PAGE_META.report.sub}/>

      <div style={{ ...panelCard, marginBottom: 20, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, background: DS.primaryLight,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <LucideBarChart2 size={22}/>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 12, color: DS.textMuted, fontWeight: 600, marginBottom: 6 }}>조회 월</div>
          <select
            value={monthKey}
            onChange={e => setMonthKey(e.target.value)}
            style={{ ...inp, maxWidth: 280, margin: 0 }}
          >
            {monthOptions.map(m => (
              <option key={m.key} value={m.key}>{m.label}</option>
            ))}
          </select>
        </div>
        <div style={{ fontSize: 13, color: DS.textSecondary, fontWeight: 600 }}>
          {selectedLabel} 기준
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 24 }}>
        <DashStatCard label="전체 대여 건수" value={report.totalRentals} iconMark="대여" iconBg={DS.primaryLight} iconColor={DS.primary}/>
        <DashStatCard
          label="반납 완료 · 반납률"
          value={`${report.returnedCount}건 · ${report.returnRate}%`}
          iconMark="반납"
          iconBg="#dcfce7"
          iconColor="#16a34a"
        />
        <DashStatCard label="파손 건수" value={report.damageCount} iconMark="파손" iconBg="#fee2e2" iconColor="#dc2626"/>
        <DashStatCard label="분실 건수" value={report.lossCount} iconMark="분실" iconBg="#fce7f3" iconColor="#be185d"/>
      </div>

      <PanelSection title={`강사별 대여 현황 (${report.teacherStats.length}명)`}>
        {report.teacherStats.length === 0 ? (
          <Empty text="해당 월 대여 기록이 없습니다"/>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <div style={{ ...tableHead, gridTemplateColumns: "minmax(88px,1.2fr) repeat(4, minmax(56px, 0.7fr))" }}>
              <span>강사명</span><span>대여건수</span><span>반납완료</span><span>미반납</span><span>파손</span>
            </div>
            {report.teacherStats.map(t => (
              <div key={t.teacherId} style={{ ...tableRow, gridTemplateColumns: "minmax(88px,1.2fr) repeat(4, minmax(56px, 0.7fr))" }}>
                <span style={{ fontWeight: 700, color: DS.textPrimary }}>{t.name}</span>
                <span style={{ fontWeight: 700 }}>{t.rentals}</span>
                <span style={{ fontWeight: 700, color: "#16a34a" }}>{t.returned}</span>
                <span style={{ fontWeight: 700, color: t.unreturned > 0 ? "#ea580c" : DS.textSecondary }}>{t.unreturned}</span>
                <span style={{ fontWeight: 700, color: t.damage > 0 ? "#dc2626" : DS.textSecondary }}>{t.damage}</span>
              </div>
            ))}
          </div>
        )}
      </PanelSection>

      <PanelSection title="교구별 사용 빈도 TOP 10">
        {report.topItems.length === 0 ? (
          <Empty text="해당 월 대여된 교구가 없습니다"/>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <div style={{ ...tableHead, gridTemplateColumns: "minmax(120px,1.5fr) minmax(64px,0.7fr) minmax(80px,0.8fr)" }}>
              <span>교구명</span><span>대여횟수</span><span>현재상태</span>
            </div>
            {report.topItems.map((row, i) => (
              <div key={row.itemId} style={{ ...tableRow, gridTemplateColumns: "minmax(120px,1.5fr) minmax(64px,0.7fr) minmax(80px,0.8fr)" }}>
                <span style={{ fontWeight: 700, color: DS.textPrimary }}>
                  <span style={{ color: DS.textMuted, marginRight: 6, fontWeight: 600 }}>{i + 1}.</span>
                  {row.name}
                </span>
                <span style={{ fontWeight: 800, color: DS.primary }}>{row.rentalCount}</span>
                <span style={{
                  display: "inline-block",
                  padding: "3px 10px",
                  borderRadius: 99,
                  fontSize: 11,
                  fontWeight: 700,
                  background: row.statusKey === "rented" ? "#ede9fe" : row.statusKey === "available" ? "#dcfce7" : "#f1f5f9",
                  color: row.statusKey === "rented" ? "#7c3aed" : row.statusKey === "available" ? "#16a34a" : "#64748b",
                }}>{row.statusLabel}</span>
              </div>
            ))}
          </div>
        )}
      </PanelSection>

      <PanelSection title={`파손·분실 상세 내역 (${report.incidents.length}건)`}>
        {report.incidents.length === 0 ? (
          <Empty text="해당 월 파손·분실 내역이 없습니다"/>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <div style={{ ...tableHead, gridTemplateColumns: "minmax(100px,1.2fr) minmax(72px,1fr) minmax(80px,0.8fr) minmax(72px,0.8fr)" }}>
              <span>교구명</span><span>강사명</span><span>날짜</span><span>상태</span>
            </div>
            {report.incidents.map(inc => (
              <div key={inc.id} style={{ ...tableRow, gridTemplateColumns: "minmax(100px,1.2fr) minmax(72px,1fr) minmax(80px,0.8fr) minmax(72px,0.8fr)" }}>
                <span style={{ fontWeight: 700, color: DS.textPrimary }}>{inc.itemName}</span>
                <span style={{ color: DS.textSecondary }}>{inc.teacherName}</span>
                <span style={{ color: DS.textMuted, fontSize: 11 }}>{fmt(inc.date)}</span>
                <span style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, color: CC[inc.condition]?.c,
                  }}>{CC[inc.condition]?.l}</span>
                  <Badge s={inc.status}/>
                </span>
              </div>
            ))}
          </div>
        )}
      </PanelSection>
    </PageShell>
  );
}

function StatsPage({me,items,ris,reqs,teachers}) {
  const totalQty = items.reduce((s, i) => s + i.total_quantity, 0);
  const rentedNow = ris.filter(r => ["rented", "partial_returned"].includes(r.status)).reduce((s, r) => s + r.quantity, 0);
  const monthBars = useMemo(() => buildMonthlyRentalCounts(ris), [ris]);
  const maxMonth = Math.max(1, ...monthBars.map(m => m.count));
  const teacherCount = teachers.filter(t => t.role !== "superadmin").length;

  return (
    <PageShell>
      <PageHeader me={me} subtitle={PAGE_META.stats.sub}/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:14,marginBottom:24}}>
        <DashStatCard label="전체 수량" value={totalQty} iconMark="수량" iconBg={DS.primaryLight} iconColor={DS.primary}/>
        <DashStatCard label="대여 중" value={rentedNow} iconMark="대여" iconBg="#dbeafe" iconColor="#2563eb"/>
        <DashStatCard label="교구 종류" value={items.length} iconMark="종류" iconBg="#f1f5f9" iconColor="#64748b"/>
        <DashStatCard label="선생님" value={teacherCount} iconMark="인원" iconBg="#ede9fe" iconColor="#7c3aed"/>
      </div>
      <PanelSection title="월별 대여 수량">
        <div style={{display:"flex",alignItems:"flex-end",gap:8,height:120}}>
          {monthBars.map(m => (
            <div key={m.key} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
              <div style={{
                width:"100%",maxWidth:36,
                height:`${Math.max(8,(m.count/maxMonth)*96)}px`,
                background:`linear-gradient(180deg, ${DS.primary} 0%, #86efac 100%)`,
                borderRadius:"6px 6px 2px 2px",minHeight:8,
              }}/>
              <span style={{fontSize:10,color:DS.textMuted}}>{m.label}</span>
            </div>
          ))}
        </div>
      </PanelSection>
    </PageShell>
  );
}

function NoticeImportanceBadge({ importance, noticeType }) {
  if (noticeType === "event") {
    return (
      <span style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 99,
        fontSize: 10,
        fontWeight: 700,
        background: "#fce7f3",
        color: "#be185d",
      }}>
        행사
      </span>
    );
  }
  const key = normalizeNoticeImportance(importance);
  const cfg = NOTICE_IMPORTANCE[key];
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 99,
      fontSize: 10,
      fontWeight: 700,
      background: cfg.bg,
      color: cfg.color,
    }}>
      {cfg.label}
    </span>
  );
}

function NoticeAudienceField({ audience, setAudience, institutions = [], teachers = [] }) {
  const type = audience?.audience_type || "all";
  const selectedIds = new Set(audience?.audience_teacher_ids || []);
  const teacherRows = useMemo(() => selectableNoticeTeachers(teachers), [teachers]);
  const selectedCount = selectedIds.size;
  const hint = NOTICE_AUDIENCE_OPTIONS.find(o => o.value === type)?.hint;

  const setType = (nextType) => {
    setAudience((prev) => ({
      ...prev,
      audience_type: nextType,
      institution_id: nextType === "institution_teachers" ? (prev.institution_id || "") : "",
      audience_teacher_ids: nextType === "specific" ? (prev.audience_teacher_ids || []) : [],
    }));
  };

  const toggleTeacher = (id) => {
    setAudience((prev) => {
      const cur = new Set(prev.audience_teacher_ids || []);
      if (cur.has(id)) cur.delete(id);
      else cur.add(id);
      return { ...prev, audience_teacher_ids: [...cur] };
    });
  };

  return (
    <div className="sch-field notice-audience-field" style={{ marginBottom: 12 }}>
      <span>수신 대상 *</span>
      <div className="notice-audience-radios" role="radiogroup" aria-label="수신 대상">
        {NOTICE_AUDIENCE_OPTIONS.map((opt) => (
          <label key={opt.value} className={`notice-audience-radio${type === opt.value ? " is-active" : ""}`}>
            <input
              type="radio"
              name="notice-audience"
              value={opt.value}
              checked={type === opt.value}
              onChange={() => setType(opt.value)}
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
      {hint ? <p className="sch-muted" style={{ margin: "4px 0 0" }}>{hint}</p> : null}

      {type === "institution_teachers" ? (
        <select
          className="sch-select"
          required
          value={audience?.institution_id || ""}
          onChange={(e) => setAudience((prev) => ({ ...prev, institution_id: e.target.value }))}
          style={{ marginTop: 8 }}
        >
          <option value="">기관 선택</option>
          {institutions.map((inst) => (
            <option key={inst.id} value={inst.id}>{inst.name}</option>
          ))}
        </select>
      ) : null}

      {type === "specific" ? (
        <div className="notice-audience-teachers" style={{ marginTop: 8 }}>
          <div className="notice-audience-teachers__count">
            {selectedCount}명 선택됨
          </div>
          <div className="notice-audience-teachers__list">
            {teacherRows.length === 0 ? (
              <p className="sch-muted" style={{ margin: 0 }}>선택 가능한 선생님이 없습니다.</p>
            ) : teacherRows.map((t) => (
              <label key={t.id} className="notice-audience-teachers__item">
                <input
                  type="checkbox"
                  checked={selectedIds.has(t.id)}
                  onChange={() => toggleTeacher(t.id)}
                />
                <span>{t.name || "이름 없음"}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NoticeFormFields({
  title, setTitle,
  body, setBody,
  kind, setKind,
  eventForm, setEventForm,
  audience, setAudience,
  institutions = [],
  teachers = [],
}) {
  return (
    <>
      <div className="notice-form-kind">
        <label style={lbl}>공지 유형 *</label>
        <select
          className="notice-form-kind__select"
          value={kind}
          onChange={e => setKind(e.target.value)}
        >
          {NOTICE_KIND_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {kind === "event" ? (
        <div className="notice-event-fields">
          <div className="notice-event-fields__title">행사 일정</div>
          <p className="notice-event-fields__hint" style={{ marginTop: 0 }}>
            스케줄 → 행사일정과 동일한 입력 항목입니다. (캘린더 반영 기관)
          </p>
          <EventScheduleFields
            form={eventForm}
            setForm={setEventForm}
            institutions={institutions}
            allowGlobal
            useSearchSelect
          />
          <Txa2
            label="상세 내용 (선택)"
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="목록·상세에 추가로 표시할 내용"
          />
        </div>
      ) : (
        <>
          <Inp2 label="제목 *" value={title} onChange={e => setTitle(e.target.value)} placeholder="공지 제목"/>
          <Txa2 label="내용" value={body} onChange={e => setBody(e.target.value)} placeholder="공지 내용을 입력하세요"/>
        </>
      )}

      <NoticeAudienceField
        audience={audience}
        setAudience={setAudience}
        institutions={institutions}
        teachers={teachers}
      />
    </>
  );
}

function NoticeReadReceiptSection({ notice, teachers = [], readStats, onResendUnread }) {
  const [tab, setTab] = useState("unread");
  const [sending, setSending] = useState(false);
  const stats = readStats || { recipientIds: [], readIds: new Set(), readCount: 0, totalCount: 0 };
  const { read, unread } = useMemo(
    () => splitReadUnreadTeachers(teachers, stats.recipientIds, stats.readIds),
    [teachers, stats.recipientIds, stats.readIds],
  );
  const list = tab === "read" ? read : unread;

  const handleResend = async () => {
    if (!unread.length) return alert("안 읽은 선생님이 없습니다.");
    if (!confirm(`안 읽은 선생님 ${unread.length}명에게 다시 알림을 보낼까요?`)) return;
    setSending(true);
    try {
      await onResendUnread?.(notice, unread.map((t) => t.id));
      alert("알림을 다시 보냈습니다.");
    } catch (err) {
      alert(err?.message || "알림 발송에 실패했습니다.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="notice-read-receipt">
      <div className="notice-read-receipt__summary">
        읽음 {stats.readCount}명 / 전체 {stats.totalCount}명
      </div>
      <div className="notice-read-receipt__tabs">
        <button
          type="button"
          className={`notice-read-receipt__tab${tab === "unread" ? " is-active" : ""}`}
          onClick={() => setTab("unread")}
        >
          안 읽음 ({unread.length})
        </button>
        <button
          type="button"
          className={`notice-read-receipt__tab${tab === "read" ? " is-active" : ""}`}
          onClick={() => setTab("read")}
        >
          읽음 ({read.length})
        </button>
      </div>
      <ul className="notice-read-receipt__list">
        {list.length === 0 ? (
          <li className="notice-read-receipt__empty">
            {tab === "unread" ? "안 읽은 선생님이 없습니다." : "읽은 선생님이 없습니다."}
          </li>
        ) : list.map((t) => (
          <li key={t.id}>{t.name || "이름 없음"}</li>
        ))}
      </ul>
      {unread.length > 0 ? (
        <Btn full onClick={handleResend} disabled={sending} style={{ marginTop: 10 }}>
          {sending ? "알림 보내는 중..." : "안 읽은 선생님에게 다시 알림 보내기"}
        </Btn>
      ) : null}
    </div>
  );
}

function NoticeDetailModal({
  notice,
  onClose,
  canManage,
  onEdit,
  onDelete,
  me = null,
  teachers = [],
  readStats = null,
  onMarkedRead,
  onResendUnread,
}) {
  const shouldAutoRead = Boolean(notice?.id && me?.id)
    && (isGearTeacher(me) || me?.role === "teacher");

  useEffect(() => {
    if (!shouldAutoRead || !notice?.id) return;
    let cancelled = false;
    (async () => {
      const ok = await markNoticeAsRead(supabase, notice.id, me.id);
      if (!cancelled && ok) onMarkedRead?.(notice.id);
    })();
    return () => { cancelled = true; };
  }, [notice?.id, me?.id, shouldAutoRead]);

  if (!notice) return null;
  const isImportant = normalizeNoticeImportance(notice.importance) === "important";
  const eventSummary = formatEventSummary(notice);
  const scopeText = audienceLabel(notice, notice.institutions?.name);
  const scopeTone = audienceBadgeTone(notice);

  return (
    <Modal title={notice.title} onClose={onClose} center closeLabel="×">
      <div className="notice-detail-meta">
        <div className="notice-detail-meta__row">
          <span className="notice-detail-meta__label">중요도</span>
          <NoticeImportanceBadge importance={notice.importance} noticeType={notice.notice_type}/>
        </div>
        <div className="notice-detail-meta__row">
          <span className="notice-detail-meta__label">수신 대상</span>
          <span className="notice-detail-meta__value">
            <span className={`admin-notice-badge admin-notice-badge--${scopeTone}`}>{scopeText}</span>
          </span>
        </div>
        <div className="notice-detail-meta__row">
          <span className="notice-detail-meta__label">작성자</span>
          <span className="notice-detail-meta__value">{notice.author_name || "—"}</span>
        </div>
        <div className="notice-detail-meta__row">
          <span className="notice-detail-meta__label">등록일</span>
          <span className="notice-detail-meta__value">
            {fmt(notice.created_at)}
            {notice.updated_at && notice.updated_at !== notice.created_at
              ? ` · 수정 ${fmt(notice.updated_at)}`
              : ""}
          </span>
        </div>
      </div>
      {eventSummary ? (
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "#be185d", fontWeight: 600 }}>
          📅 {eventSummary}
        </p>
      ) : null}
      <div
        className="notice-detail-body"
        style={{ color: isImportant ? "#991b1b" : DS.textSecondary }}
      >
        {notice.body?.trim() ? notice.body : "내용이 없습니다."}
      </div>

      {canManage ? (
        <NoticeReadReceiptSection
          notice={notice}
          teachers={teachers}
          readStats={readStats}
          onResendUnread={onResendUnread}
        />
      ) : null}

      {canManage && (
        <div style={{ display: "flex", gap: 8, marginTop: 20, flexWrap: "wrap" }}>
          <Btn onClick={() => { onClose(); onEdit(notice); }}>수정</Btn>
          <Btn danger onClick={() => {
            if (confirm("이 공지를 삭제할까요?")) {
              onDelete(notice.id);
              onClose();
            }
          }}>삭제</Btn>
        </div>
      )}
    </Modal>
  );
}

function noticeToEventForm(notice) {
  return {
    ...EMPTY_EVENT_FORM,
    scope: notice?.institution_id ? "institution" : "global",
    institution_id: notice?.institution_id || "",
    start_date: notice?.event_date || "",
    end_date: notice?.event_end_date && notice?.event_end_date !== notice?.event_date
      ? notice.event_end_date
      : "",
    exception_type: notice?.exception_type || "event",
    note: notice?.title || "",
  };
}

function NoticeEditModal({ notice, onClose, onSave, institutions = [], teachers = [] }) {
  const [title, setTitle] = useState(notice?.title || "");
  const [body, setBody] = useState(notice?.body || "");
  const [kind, setKind] = useState(noticeToKind(notice));
  const [eventForm, setEventForm] = useState(() => noticeToEventForm(notice));
  const [audience, setAudience] = useState(() => noticeToAudience(notice));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(notice?.title || "");
    setBody(notice?.body || "");
    setKind(noticeToKind(notice));
    setEventForm(noticeToEventForm(notice));
    setAudience(noticeToAudience(notice));
  }, [notice]);

  const submit = async () => {
    if (kind === "event") {
      if (!eventForm.start_date) return alert("시작일을 입력하세요");
      if (!eventForm.note.trim()) return alert("메모를 입력하세요");
      if (eventForm.end_date && eventForm.end_date < eventForm.start_date) {
        return alert("종료일은 시작일 이후여야 합니다.");
      }
      if (eventForm.scope === "institution" && !eventForm.institution_id) {
        return alert("캘린더 반영 기관을 선택하세요.");
      }
    } else if (!title.trim()) {
      return alert("제목을 입력하세요");
    }
    const audienceErr = validateNoticeAudience(audience);
    if (audienceErr) return alert(audienceErr);
    setSaving(true);
    const fields = kindToNoticeFields(kind, eventForm, audience);
    const resolvedTitle = kind === "event" ? eventForm.note.trim() : title.trim();
    const ok = await onSave({
      id: notice.id,
      title: resolvedTitle,
      body: body.trim(),
      ...fields,
    });
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Modal title="공지 수정" onClose={onClose} center>
      <NoticeFormFields
        title={title}
        setTitle={setTitle}
        body={body}
        setBody={setBody}
        kind={kind}
        setKind={setKind}
        eventForm={eventForm}
        setEventForm={setEventForm}
        audience={audience}
        setAudience={setAudience}
        institutions={institutions}
        teachers={teachers}
      />
      <Btn full onClick={submit} disabled={saving}>{saving ? "저장 중..." : "저장"}</Btn>
    </Modal>
  );
}

function AdminTodoRow({ todo, who, period, onToggle, onDelete, onUpdate, onItemComplete, readOnly = false, forceExpanded = false }) {
  const [expanded, setExpanded] = useState(forceExpanded);
  const [subText, setSubText] = useState("");

  const checklist = Array.isArray(todo.checklist) ? todo.checklist : [];
  const total = checklist.length;
  const doneN = checklist.filter(c => c.done).length;
  const pct = total ? Math.round((doneN / total) * 100) : 0;

  const done = todo.is_completed;
  const priority = todo.priority === "urgent" ? "urgent" : todo.priority === "important" ? "important" : "normal";
  const dd = todo.due_date ? ddayTag(todo.due_date) : null;
  const expired = !done && todo.due_date && dday(todo.due_date) < 0;

  const commit = (next) => onUpdate && onUpdate(todo.id, { checklist: next });
  const toggleChild = (cid, val) => {
    commit(checklist.map(c => c.id === cid ? { ...c, done: val } : c));
    if (val) {
      const it = checklist.find(c => c.id === cid);
      if (it && !it.done) onItemComplete && onItemComplete(it.text);
    }
  };
  const deleteChild = (cid) => commit(checklist.filter(c => c.id !== cid));
  const addChild = () => {
    const txt = subText.trim();
    if (!txt) return;
    const item = { id: (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`), text: txt, done: false };
    commit([...checklist, item]);
    setSubText("");
  };

  const delBtnStyle = {
    width:28, height:28, borderRadius:8, border:"1px solid #e8ecee", background:"#fff",
    color:DS.textMuted, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
  };

  return (
    <div style={{
      border:"1px solid #eef2f6", borderLeft:`4px solid ${done?DS.primary:(expired?"#dc2626":"#cbd5e1")}`,
      borderRadius:12, background:"#fff", overflow:"hidden",
    }}>
      <div className="admin-todo-row" style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px", transition:"background .15s" }}>
        <input type="checkbox" checked={done} disabled={readOnly} onChange={e=>!readOnly && onToggle(todo.id, e.target.checked)} style={{ width:18, height:18, cursor:readOnly?"default":"pointer", accentColor:DS.primary, flexShrink:0 }}/>
        <button type="button" onClick={()=>setExpanded(v=>!v)} style={{ flex:1, minWidth:0, textAlign:"left", background:"transparent", border:"none", cursor:"pointer", fontFamily:"inherit", padding:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, opacity:done?0.5:1 }}>
            {priority==="urgent" && <span style={{ fontSize:11, fontWeight:800, color:"#fff", background:"#dc2626", borderRadius:99, padding:"2px 8px", flexShrink:0 }}>긴급</span>}
            {priority==="important" && <span style={{ fontSize:11, fontWeight:800, color:"#fff", background:"#ea580c", borderRadius:99, padding:"2px 8px", flexShrink:0 }}>중요</span>}
            <span style={{ fontSize:14, fontWeight:600, color:"#111827", textDecoration:done?"line-through":"none", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", minWidth:0 }}>{todo.content}</span>
            {total>0 && <span style={{ fontSize:12, fontWeight:800, color:pct===100?DS.primary:DS.textSecondary, flexShrink:0 }}>{doneN}/{total}</span>}
          </div>
          <div style={{ fontSize:12, color:DS.textMuted, marginTop:2 }}>
            담당: {who || "전체"}{period && <span style={{ marginLeft:8, color:DS.textSecondary, fontWeight:600 }}>· {period}</span>}
          </div>
          {total>0 && (
            <div style={{ height:5, background:"#eef2f6", borderRadius:99, overflow:"hidden", marginTop:8 }}>
              <div style={{ width:`${pct}%`, height:"100%", background:DS.primary, borderRadius:99, transition:"width .3s ease" }}/>
            </div>
          )}
        </button>
        {!done && (expired
          ? <span style={{ fontSize:11, fontWeight:800, color:"#dc2626", background:"#fef2f2", border:"1px solid #fecaca", borderRadius:99, padding:"2px 9px", flexShrink:0 }}>만료</span>
          : dd && <span style={{ fontSize:12, fontWeight:800, color:dd.color, flexShrink:0 }}>{dd.text}</span>)}
        <button type="button" onClick={()=>setExpanded(v=>!v)} aria-label={expanded?"접기":"펼치기"} style={delBtnStyle}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ transform:expanded?"rotate(90deg)":"rotate(0deg)", transition:"transform .2s ease" }}><path d="M9 6l6 6-6 6"/></svg>
        </button>
        {!readOnly && (
          <button type="button" onClick={()=>onDelete(todo.id)} aria-label="삭제" style={delBtnStyle}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        )}
      </div>

      {expanded && (
        <div className="admin-todo-sub" style={{ padding:"2px 16px 12px 46px", display:"flex", flexDirection:"column", gap:6 }}>
          {checklist.length===0 && readOnly && (
            <div style={{ fontSize:12, color:DS.textMuted, padding:"2px 0" }}>하위 항목이 없습니다</div>
          )}
          {checklist.map(ci => (
            <div key={ci.id} style={{ display:"flex", alignItems:"center", gap:10 }}>
              <input type="checkbox" checked={!!ci.done} disabled={readOnly} onChange={e=>!readOnly && toggleChild(ci.id, e.target.checked)} style={{ width:16, height:16, cursor:readOnly?"default":"pointer", accentColor:DS.primary, flexShrink:0 }}/>
              <span style={{ flex:1, minWidth:0, fontSize:13, color:"#374151", textDecoration:ci.done?"line-through":"none", opacity:ci.done?0.5:1 }}>{ci.text}</span>
              {!readOnly && (
                <button type="button" onClick={()=>deleteChild(ci.id)} aria-label="하위 항목 삭제" style={{ width:24, height:24, borderRadius:7, border:"none", background:"transparent", color:DS.textMuted, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
              )}
            </div>
          ))}
          {!readOnly && (
            <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:2 }}>
              <input
                value={subText}
                onChange={e=>setSubText(e.target.value)}
                onKeyDown={e=>{ if(e.key==="Enter") addChild(); }}
                placeholder="+ 하위 항목 추가..."
                style={{ flex:1, minWidth:0, padding:"7px 10px", borderRadius:8, border:"1px solid #e8ecee", fontSize:13, outline:"none", fontFamily:"inherit", background:"#fff", color:DS.textPrimary }}
              />
              <Btn sm onClick={addChild} disabled={!subText.trim()}>추가</Btn>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AdminTodoSection({ me, teachers, todos, reqs, ris, rets, setPage, onAdd, onToggle, onDelete, onUpdate, hideAuto = false, readOnly = false }) {
  const canEditTodo = isSuperAdmin(me);
  const [content, setContent] = useState("");
  const [assignee, setAssignee] = useState("all");
  const [priority, setPriority] = useState("normal");
  const [start, setStart] = useState("");
  const [due, setDue] = useState("");
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("all"); // all | active | done
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [composing, setComposing] = useState(false);
  const [editingTodo, setEditingTodo] = useState(null);
  const [draftItems, setDraftItems] = useState([]);
  const [subDraft, setSubDraft] = useState("");
  const [visibleCount, setVisibleCount] = useState(6);
  const [menuId, setMenuId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const modalOpen = composing || Boolean(editingTodo);

  const overdueN = useMemo(() => (ris || []).filter(r => ["rented","partial_returned"].includes(r.status) && dday(r.due_date)!==null && dday(r.due_date)<0).length, [ris]);
  const pendingN = useMemo(() => (reqs || []).filter(r => r.status==="pending").length, [reqs]);
  const retN = useMemo(() => filterReturnPendingLastWeek(rets || []).length, [rets]);

  const autoItems = hideAuto ? [] : [
    overdueN>0 && { key:"overdue", label:`연체 교구 ${overdueN}건`, sub:"반납이 지연된 교구를 확인하세요", color:"#dc2626", bg:"#fef2f2", page:"overdue" },
    pendingN>0 && { key:"pending", label:`대여 승인 대기 ${pendingN}건`, sub:"신규 대여 신청을 처리하세요", color:"#ca8a04", bg:"#fffbeb", page:"rental-approval" },
    retN>0 && { key:"returns", label:`반납 신청 ${retN}건`, sub:"반납 요청을 확인하세요", color:"#7c3aed", bg:"#faf5ff", page:"returns-approval" },
  ].filter(Boolean);

  const visibleTodos = useMemo(() => {
    const now = Date.now();
    return (todos || []).filter(t => {
      if (t.is_completed && t.completed_at) {
        return now - new Date(t.completed_at).getTime() < 24*3600*1000;
      }
      return true;
    });
  }, [todos]);

  const assigneeOptions = useMemo(
    () => (teachers || []).filter(t => isItemAdmin(t) || t.role==="admin"),
    [teachers]
  );
  const assigneeName = (id) => (teachers || []).find(t => t.id===id)?.name || null;

  const resetModalForm = () => {
    setContent("");
    setStart("");
    setDue("");
    setAssignee("all");
    setPriority("normal");
    setDraftItems([]);
    setSubDraft("");
    setComposing(false);
    setEditingTodo(null);
  };

  const openCompose = () => {
    setEditingTodo(null);
    setContent("");
    setStart("");
    setDue("");
    setAssignee("all");
    setPriority("normal");
    setDraftItems([]);
    setSubDraft("");
    setComposing(true);
  };

  const openEdit = (todo) => {
    if (!canEditTodo || !todo) return;
    setComposing(false);
    setMenuId(null);
    setEditingTodo(todo);
    setContent(todo.content || "");
    setAssignee(todo.assignee_id || "all");
    setPriority(
      todo.priority === "urgent" ? "urgent"
        : todo.priority === "important" ? "important"
          : "normal",
    );
    setStart(todo.start_date ? String(todo.start_date).slice(0, 10) : "");
    setDue(todo.due_date ? String(todo.due_date).slice(0, 10) : "");
    setDraftItems(
      (Array.isArray(todo.checklist) ? todo.checklist : []).map((it) => ({
        id: it.id || (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`),
        text: it.text || "",
        done: !!it.done,
      })),
    );
    setSubDraft("");
  };

  const addDraftItem = () => {
    const txt = subDraft.trim();
    if (!txt) return;
    setDraftItems(prev => [...prev, {
      id: (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`),
      text: txt,
      done: false,
    }]);
    setSubDraft("");
  };
  const removeDraftItem = (id) => setDraftItems(prev => prev.filter(it => it.id !== id));
  const updateDraftItemText = (id, text) => {
    setDraftItems(prev => prev.map(it => (it.id === id ? { ...it, text } : it)));
  };
  const toggleDraftItemDone = (id, done) => {
    setDraftItems(prev => prev.map(it => (it.id === id ? { ...it, done } : it)));
  };

  const submit = async () => {
    const c = content.trim();
    if (!c) return;
    if (start && due && due < start) { alert("종료일이 시작일보다 빠릅니다."); return; }
    const checklist = draftItems
      .map(it => ({ id: it.id, text: String(it.text || "").trim(), done: !!it.done }))
      .filter(it => it.text);
    setSaving(true);
    try {
      if (editingTodo) {
        if (!canEditTodo) {
          alert("슈퍼관리자만 수정할 수 있습니다.");
          return;
        }
        await onUpdate?.(editingTodo.id, {
          content: c,
          assignee_id: assignee === "all" ? null : assignee,
          priority: priority === "urgent" ? "urgent" : priority === "important" ? "important" : "normal",
          start_date: toKstDateOnly(start),
          due_date: toKstDateOnly(due),
          checklist,
        });
      } else {
        await onAdd({
          content: c,
          assignee_id: assignee === "all" ? null : assignee,
          priority: priority === "urgent" ? "urgent" : priority === "important" ? "important" : "normal",
          start_date: toKstDateOnly(start),
          due_date: toKstDateOnly(due),
          checklist: checklist.map(it => ({ ...it, done: false })),
        });
      }
      resetModalForm();
    } finally { setSaving(false); }
  };

  const notifyItemComplete = (text) => {
    void sendPushEvent(supabase, "task_item_completed", { actor_name: me?.name || "관리자", item_text: text });
  };

  const priRank = { urgent: 0, important: 1, normal: 2, low: 3 };
  const sortedTodos = useMemo(() => [...visibleTodos].sort((a, b) => {
    if (!!a.is_completed !== !!b.is_completed) return a.is_completed ? 1 : -1;
    return (priRank[a.priority] ?? 1) - (priRank[b.priority] ?? 1);
  }), [visibleTodos]);

  const openTodos = sortedTodos.filter(t => !t.is_completed);
  const doneTodos = sortedTodos.filter(t => t.is_completed);
  const allCount = autoItems.length + sortedTodos.length;
  const activeCount = autoItems.length + openTodos.length;
  const doneCount = doneTodos.length;

  const filteredTodos = useMemo(() => {
    let list = tab === "active" ? openTodos : tab === "done" ? doneTodos : sortedTodos;
    if (filterAssignee !== "all") {
      list = list.filter(t => filterAssignee === "unassigned" ? !t.assignee_id : t.assignee_id === filterAssignee);
    }
    return list;
  }, [tab, openTodos, doneTodos, sortedTodos, filterAssignee]);

  const shownTodos = filteredTodos.slice(0, visibleCount);
  const hasMore = filteredTodos.length > visibleCount;

  useEffect(() => {
    if (!modalOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev || ""; };
  }, [modalOpen]);

  const inputStyle = {
    padding:"10px 12px", borderRadius:10, border:"1px solid #e8ecee",
    fontSize:13, outline:"none", fontFamily:"inherit", background:"#fff", color:DS.textPrimary, boxSizing:"border-box",
  };
  const fieldLabel = { fontSize:12, fontWeight:700, color:DS.textSecondary, marginBottom:6, display:"block" };

  const priMeta = (p) => {
    if (p === "urgent") return { label: "긴급", cls: "is-urgent" };
    if (p === "important") return { label: "중요", cls: "is-important" };
    if (p === "low") return { label: "낮음", cls: "is-low" };
    return { label: "일반", cls: "is-normal" };
  };

  return (
    <div className="admin-todo-table-card">
      <div className="admin-todo-table-card__head">
        <div className="admin-todo-table-card__title-row">
          <span className="admin-todo-table-card__icon" aria-hidden>✓</span>
          <h2 className="admin-todo-table-card__title">할 일</h2>
          {allCount > 0 && <span className="admin-todo-table-card__count">{allCount}</span>}
        </div>
        <div className="admin-todo-table-card__toolbar">
          <div className="admin-todo-tabs">
            {[
              { id: "all", label: "전체", n: allCount, tone: "green" },
              { id: "active", label: "진행 중", n: activeCount, tone: "blue" },
              { id: "done", label: "완료", n: doneCount, tone: "gray" },
            ].map(t => (
              <button key={t.id} type="button" className={`admin-todo-tab admin-todo-tab--${t.tone}${tab===t.id?" is-active":""}`} onClick={() => { setTab(t.id); setVisibleCount(6); }}>
                {t.label} <span>{t.n}</span>
              </button>
            ))}
          </div>
          <div className="admin-todo-table-card__right">
            <select value={filterAssignee} onChange={e => { setFilterAssignee(e.target.value); setVisibleCount(6); }} className="admin-todo-assignee-filter">
              <option value="all">전체 담당자</option>
              <option value="unassigned">담당: 전체</option>
              {assigneeOptions.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            {!readOnly && (
              <button type="button" className="admin-todo-add-btn" onClick={openCompose}>+ 할 일 추가</button>
            )}
          </div>
        </div>
      </div>

      {tab !== "done" && autoItems.length > 0 && filterAssignee === "all" && (
        <div className="admin-todo-auto-list">
          {autoItems.map(a => (
            <button key={a.key} type="button" onClick={() => setPage(a.page)} className="admin-todo-auto-row" style={{ borderLeftColor: a.color, background: a.bg }}>
              <div>
                <div className="admin-todo-auto-row__title">{a.label}</div>
                <div className="admin-todo-auto-row__sub">{a.sub}</div>
              </div>
              <span>›</span>
            </button>
          ))}
        </div>
      )}

      {shownTodos.length === 0 && (tab === "done" || autoItems.length === 0 || filterAssignee !== "all") ? (
        <div className="admin-todo-table-empty">
          {tab === "done" ? "완료된 항목이 없습니다" : "처리할 업무가 없습니다 ✅"}
        </div>
      ) : shownTodos.length > 0 ? (
        <div className="admin-todo-table-wrap">
          <div className="admin-todo-table-head">
            <span>우선순위</span>
            <span>할 일 제목</span>
            <span>상세</span>
            <span aria-hidden/>
          </div>
          {shownTodos.map(t => {
            const who = t.assignee_id ? assigneeName(t.assignee_id) : "전체";
            const checklist = Array.isArray(t.checklist) ? t.checklist : [];
            const doneN = checklist.filter(c => c.done).length;
            const pri = priMeta(t.priority);
            const overdue = !t.is_completed && t.due_date && dday(t.due_date) < 0;
            const expanded = expandedId === t.id;
            return (
              <div key={t.id} className="admin-todo-table-block">
                <div className={`admin-todo-table-row${t.is_completed ? " is-done" : ""}`}>
                  <span className={`admin-todo-pri ${pri.cls}`}><i/><span>{pri.label}</span></span>
                  <button type="button" className="admin-todo-table-row__title" onClick={() => setExpandedId(expanded ? null : t.id)}>
                    <span>{t.content}</span>
                    {checklist.length > 0 && (
                      <span className="admin-todo-check-count">📄 {doneN}/{checklist.length}</span>
                    )}
                  </button>
                  <div className="admin-todo-table-row__metas">
                    <span className="admin-todo-assignee">
                      <span className="admin-todo-avatar" style={{ background: assigneeAvatarColor(who) }}>{(who || "?")[0]}</span>
                      {who}
                    </span>
                    <span className={`admin-todo-due${overdue ? " is-overdue" : ""}`}>
                      {t.due_date ? fmtDateWeekday(t.due_date) : "-"}
                    </span>
                    <span className={`admin-todo-status ${t.is_completed ? "is-done" : "is-active"}`}>
                      {t.is_completed ? "완료" : "진행 중"}
                    </span>
                    <span className="admin-todo-created">{fmtDateWeekday(t.created_at)}</span>
                  </div>
                  <div className="admin-todo-more-wrap">
                    {canEditTodo && (
                      <button
                        type="button"
                        className="admin-todo-edit-btn"
                        aria-label="수정"
                        title="수정"
                        onClick={(e) => { e.stopPropagation(); openEdit(t); }}
                      >
                        ✏️
                      </button>
                    )}
                    <button type="button" className="admin-todo-more-btn" aria-label="더보기" onClick={(e) => { e.stopPropagation(); setMenuId(menuId === t.id ? null : t.id); }}>⋮</button>
                    {menuId === t.id && (
                      <div className="admin-todo-menu">
                        {!readOnly && (
                          <button type="button" onClick={() => { onToggle(t.id, !t.is_completed); setMenuId(null); }}>
                            {t.is_completed ? "진행 중으로" : "완료 처리"}
                          </button>
                        )}
                        <button type="button" onClick={() => { setExpandedId(t.id); setMenuId(null); }}>하위 항목</button>
                        {canEditTodo && (
                          <button type="button" onClick={() => openEdit(t)}>수정</button>
                        )}
                        {!readOnly && (
                          <button type="button" className="is-danger" onClick={() => { onDelete(t.id); setMenuId(null); }}>삭제</button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {expanded && (
                  <div className="admin-todo-table-expand">
                    <AdminTodoRow
                      todo={t}
                      who={who}
                      period={null}
                      onToggle={onToggle}
                      onDelete={onDelete}
                      onUpdate={onUpdate}
                      onItemComplete={notifyItemComplete}
                      readOnly={readOnly}
                      forceExpanded
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : null}

      {hasMore && (
        <button type="button" className="admin-todo-more-footer" onClick={() => setVisibleCount(c => c + 6)}>
          더보기 ∨
        </button>
      )}

      {((!readOnly && composing) || (canEditTodo && editingTodo)) && (
        <div className="admin-todo-modal-backdrop" onClick={resetModalForm}>
          <div className="admin-todo-modal-card" onClick={e => e.stopPropagation()}>
            <div className="admin-todo-modal-card__head">
              <div className="admin-todo-modal-card__title">{editingTodo ? "할 일 수정" : "할 일 추가"}</div>
              <button type="button" className="admin-todo-modal-card__close" onClick={resetModalForm}>닫기</button>
            </div>
            <label style={fieldLabel}>할 일 제목</label>
            <input
              value={content}
              onChange={e=>setContent(e.target.value)}
              placeholder="할 일 제목 입력..."
              style={{ ...inputStyle, width:"100%", marginBottom:12 }}
              autoFocus
            />
            <div className="admin-todo-add-controls" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
              <div>
                <label style={fieldLabel}>우선순위</label>
                <select value={priority} onChange={e=>setPriority(e.target.value)} style={{ ...inputStyle, cursor:"pointer", width:"100%", minHeight:44 }}>
                  <option value="urgent">긴급</option>
                  <option value="important">중요</option>
                  <option value="normal">일반</option>
                </select>
              </div>
              <div>
                <label style={fieldLabel}>담당자</label>
                <select value={assignee} onChange={e=>setAssignee(e.target.value)} style={{ ...inputStyle, cursor:"pointer", width:"100%", minHeight:44 }}>
                  <option value="all">담당: 전체</option>
                  {assigneeOptions.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label style={fieldLabel}>시작일</label>
                <input type="date" value={start} max={due || undefined} onChange={e=>setStart(e.target.value)} style={{ ...inputStyle, cursor:"pointer", width:"100%", minHeight:44 }}/>
              </div>
              <div>
                <label style={fieldLabel}>종료일</label>
                <input type="date" value={due} min={start || undefined} onChange={e=>setDue(e.target.value)} style={{ ...inputStyle, cursor:"pointer", width:"100%", minHeight:44 }}/>
              </div>
            </div>
            <div style={fieldLabel}>하위 체크리스트 <span style={{ fontWeight:600, color:DS.textMuted }}>(선택)</span></div>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
              <input
                value={subDraft}
                onChange={e=>setSubDraft(e.target.value)}
                onKeyDown={e=>{ if(e.key==="Enter"){ e.preventDefault(); addDraftItem(); } }}
                placeholder="+ 항목 추가..."
                style={{ ...inputStyle, flex:1, minWidth:0 }}
              />
              <Btn sm onClick={addDraftItem} disabled={!subDraft.trim()}>+</Btn>
            </div>
            {draftItems.map(it => (
              <div key={it.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"4px 2px" }}>
                <input
                  type="checkbox"
                  checked={!!it.done}
                  disabled={!editingTodo}
                  onChange={e => editingTodo && toggleDraftItemDone(it.id, e.target.checked)}
                  style={{ width:16, height:16, flexShrink:0, cursor: editingTodo ? "pointer" : "default" }}
                />
                {editingTodo ? (
                  <input
                    value={it.text}
                    onChange={e => updateDraftItemText(it.id, e.target.value)}
                    style={{ ...inputStyle, flex:1, minWidth:0, padding:"6px 8px", minHeight:0 }}
                  />
                ) : (
                  <span style={{ flex:1, fontSize:13 }}>{it.text}</span>
                )}
                <button type="button" onClick={()=>removeDraftItem(it.id)} aria-label="삭제" style={{ border:"none", background:"transparent", cursor:"pointer", color:DS.textMuted }}>×</button>
              </div>
            ))}
            <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop:14 }}>
              <Btn ghost onClick={resetModalForm} disabled={saving}>취소</Btn>
              <Btn onClick={submit} disabled={saving || !content.trim()}>{saving ? "저장 중..." : "저장"}</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NoticesPage({ me, notices, onAdd, onUpdate, onDelete, items, reqs, ris, rets, setPage, onItemClick, teachers, adminTodos, onAddTodo, onToggleTodo, onDeleteTodo, onUpdateTodo, initialNoticeId, onNoticeDeepLinkConsumed }) {
  const canManage = isGearPlatformAdmin(me) || isItemAdmin(me);
  const showUnreadStyles = isGearTeacher(me) || (!canManage && me?.role === "teacher");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState("normal");
  const [eventForm, setEventForm] = useState({ ...EMPTY_EVENT_FORM });
  const [audience, setAudience] = useState({ ...EMPTY_NOTICE_AUDIENCE });
  const [institutions, setInstitutions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [editNotice, setEditNotice] = useState(null);
  const [viewNotice, setViewNotice] = useState(null);
  const [feedItems, setFeedItems] = useState([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedTick, setFeedTick] = useState(0);
  const [readNoticeIds, setReadNoticeIds] = useState(() => new Set());
  const [readStatsByNoticeId, setReadStatsByNoticeId] = useState(() => new Map());
  const [readsTick, setReadsTick] = useState(0);
  const deepLinkOpenedRef = useRef(null);

  const resetComposeForm = useCallback(() => {
    setTitle("");
    setBody("");
    setKind("normal");
    setEventForm({ ...EMPTY_EVENT_FORM });
    setAudience({ ...EMPTY_NOTICE_AUDIENCE });
  }, []);

  const refreshFeed = useCallback(() => {
    setFeedTick(t => t + 1);
  }, []);

  const refreshReads = useCallback(() => {
    setReadsTick(t => t + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchInstitutions({ activeOnly: false })
      .then((rows) => { if (!cancelled) setInstitutions(rows || []); })
      .catch(() => { if (!cancelled) setInstitutions([]); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setFeedLoading(true);
    loadUnifiedNoticeFeed(fetchNotices)
      .then((items) => {
        if (!cancelled) setFeedItems(items || []);
      })
      .finally(() => {
        if (!cancelled) setFeedLoading(false);
      });
    return () => { cancelled = true; };
  }, [notices, feedTick]);

  useEffect(() => {
    let cancelled = false;
    const noticeRows = (feedItems || [])
      .filter((i) => i.source === "notice" && i.raw?.id)
      .map((i) => i.raw);
    const noticeIds = noticeRows.map((n) => n.id);
    if (!noticeIds.length) {
      setReadNoticeIds(new Set());
      setReadStatsByNoticeId(new Map());
      return;
    }

    (async () => {
      if (showUnreadStyles && me?.id) {
        const mine = await fetchMyNoticeReadIds(supabase, me.id, noticeIds);
        if (!cancelled) setReadNoticeIds(mine);
      }

      if (canManage) {
        const institutionIds = noticeRows
          .filter((n) => (n.audience_type || (n.institution_id ? "institution_teachers" : "all")) === "institution_teachers")
          .map((n) => n.institution_id)
          .filter(Boolean);
        const [reads, institutionMap] = await Promise.all([
          fetchNoticeReads(supabase, noticeIds),
          fetchInstitutionTeacherIdMap(supabase, institutionIds),
        ]);
        if (cancelled) return;
        setReadStatsByNoticeId(
          buildNoticeReadStats(noticeRows, teachers, reads, institutionMap),
        );
      }
    })();

    return () => { cancelled = true; };
  }, [feedItems, teachers, canManage, showUnreadStyles, me?.id, readsTick]);

  const noticeUnreadCount = useMemo(() => {
    if (!showUnreadStyles) return 0;
    return (feedItems || []).filter(
      (i) => i.source === "notice" && i.raw?.id && !readNoticeIds.has(i.raw.id),
    ).length;
  }, [feedItems, readNoticeIds, showUnreadStyles]);

  const handleMarkedRead = useCallback((noticeId) => {
    if (!noticeId) return;
    setReadNoticeIds((prev) => {
      const next = new Set(prev);
      next.add(noticeId);
      return next;
    });
    refreshReads();
  }, [refreshReads]);

  const handleResendUnread = useCallback(async (notice, teacherIds) => {
    await sendPushEvent(supabase, "notice_posted", {
      title: notice?.title || "공지사항",
      notice_id: notice?.id,
      audience_type: "specific",
      audience_teacher_ids: teacherIds || [],
    });
  }, []);

  useEffect(() => {
    if (!initialNoticeId || feedLoading) return;
    if (deepLinkOpenedRef.current === String(initialNoticeId)) return;
    let cancelled = false;

    const fromFeed = (feedItems || []).find(
      (i) => i.source === "notice" && i.raw?.id != null && String(i.raw.id) === String(initialNoticeId),
    );
    const fromList = (notices || []).find((n) => n?.id != null && String(n.id) === String(initialNoticeId));
    const target = fromFeed?.raw || fromList || null;

    const open = (notice) => {
      if (cancelled || !notice) return;
      deepLinkOpenedRef.current = String(initialNoticeId);
      setViewNotice(notice);
      onNoticeDeepLinkConsumed?.();
    };

    if (target) {
      open(target);
      return () => { cancelled = true; };
    }

    (async () => {
      const { data, error } = await supabase
        .from("notices")
        .select("*, institutions(id, name)")
        .eq("id", initialNoticeId)
        .maybeSingle();
      if (!cancelled && !error && data) open(data);
    })();

    return () => { cancelled = true; };
  }, [initialNoticeId, feedItems, feedLoading, notices, onNoticeDeepLinkConsumed]);

  const handleAdd = async () => {
    if (kind === "event") {
      if (!eventForm.start_date) return alert("시작일을 입력하세요");
      if (!eventForm.note.trim()) return alert("메모를 입력하세요");
      if (eventForm.end_date && eventForm.end_date < eventForm.start_date) {
        return alert("종료일은 시작일 이후여야 합니다.");
      }
      if (eventForm.scope === "institution" && !eventForm.institution_id) {
        return alert("캘린더 반영 기관을 선택하세요.");
      }
    } else if (!title.trim()) {
      return alert("제목을 입력하세요");
    }
    const audienceErr = validateNoticeAudience(audience);
    if (audienceErr) return alert(audienceErr);
    setSaving(true);
    try {
      const fields = kindToNoticeFields(kind, eventForm, audience);
      const resolvedTitle = kind === "event" ? eventForm.note.trim() : title.trim();
      await onAdd({ title: resolvedTitle, body: body.trim(), ...fields });
      resetComposeForm();
      setComposeOpen(false);
    } catch (err) {
      alert(err?.message || "등록에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const currentRentals = useMemo(
    () => buildCurrentRentals(me, reqs || [], ris || [], items || [], rets || []),
    [me, reqs, ris, items, rets],
  );
  const alertCount = canManage ? 0 : buildDueReturns(currentRentals).length;

  return (
    <PageShell>
      <PageHeader
        me={me}
        subtitle={canManage ? PAGE_META.notices.sub : "대여·반납과 예약 현황을 한눈에 확인하세요."}
        alertCount={alertCount}
      />

      <div className="notices-hub-top notices-hub-top--unified">
        <UnifiedNoticesFeed
          items={feedItems}
          loading={feedLoading}
          variant="table"
          onSelectNotice={setViewNotice}
          canManage={canManage}
          onEditNotice={setEditNotice}
          onDeleteNotice={onDelete}
          onExceptionMutated={refreshFeed}
          onCompose={canManage ? () => setComposeOpen(true) : undefined}
          showUnreadStyles={showUnreadStyles}
          readNoticeIds={readNoticeIds}
          unreadCount={noticeUnreadCount}
          readStatsByNoticeId={canManage ? readStatsByNoticeId : null}
        />
      </div>

      {canManage && composeOpen ? (
        <Modal title="공지 작성" onClose={() => setComposeOpen(false)} center>
          <NoticeFormFields
            title={title}
            setTitle={setTitle}
            body={body}
            setBody={setBody}
            kind={kind}
            setKind={setKind}
            eventForm={eventForm}
            setEventForm={setEventForm}
            audience={audience}
            setAudience={setAudience}
            institutions={institutions}
            teachers={teachers}
          />
          <Btn full onClick={handleAdd} disabled={saving}>{saving ? "등록 중..." : "공지 등록"}</Btn>
        </Modal>
      ) : null}

      {canManage && (
        <AdminTodoSection
          me={me}
          teachers={teachers}
          todos={adminTodos}
          reqs={reqs}
          ris={ris}
          rets={rets}
          setPage={setPage}
          onAdd={onAddTodo}
          onToggle={onToggleTodo}
          onDelete={onDeleteTodo}
          onUpdate={onUpdateTodo}
        />
      )}

      {canPersonalGearRental(me) && items && (
        <TeacherGearStatusSection
          me={me}
          items={items}
          reqs={reqs}
          ris={ris}
          rets={rets}
          setPage={setPage}
          onItemClick={onItemClick}
        />
      )}

      {viewNotice && (
        <NoticeDetailModal
          notice={viewNotice}
          onClose={() => setViewNotice(null)}
          canManage={canManage}
          onEdit={setEditNotice}
          onDelete={onDelete}
          me={me}
          teachers={teachers}
          readStats={canManage ? readStatsByNoticeId.get(viewNotice.id) : null}
          onMarkedRead={handleMarkedRead}
          onResendUnread={handleResendUnread}
        />
      )}

      {editNotice && (
        <NoticeEditModal
          notice={editNotice}
          institutions={institutions}
          teachers={teachers}
          onClose={() => setEditNotice(null)}
          onSave={onUpdate}
        />
      )}
    </PageShell>
  );
}

function SettingsPage({me,onChangePw,onLogout,onDataExport}) {
  return (
    <PageShell>
      <PageHeader me={me} subtitle={PAGE_META.settings.sub}/>
      <PanelSection title="계정">
        <div style={{fontSize:14,fontWeight:600,color:DS.textPrimary,marginBottom:4}}>{me.name}</div>
        <div style={{marginBottom:16}}><RoleBadge role={me.role} isItemAdmin={me.is_item_admin}/></div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <Btn onClick={onChangePw}>비밀번호 변경</Btn>
          <Btn danger onClick={onLogout}>로그아웃</Btn>
        </div>
      </PanelSection>
      {onDataExport ? (
        <PanelSection title="데이터 내보내기">
          <p style={{ fontSize: 13, color: DS.textSecondary, margin: "0 0 14px", lineHeight: 1.6 }}>
            교구 현황, 대여 내역, 선생님 급여/정산 데이터를 Excel 파일로 다운로드할 수 있습니다.
          </p>
          <Btn onClick={onDataExport}>데이터 내보내기 페이지 열기</Btn>
        </PanelSection>
      ) : null}
    </PageShell>
  );
}

function RentalManageHubPage({me,setPage}) {
  const cards = [
    ...(canPersonalGearRental(me) ? [{
      id: "rental-return",
      label: "내 대여·반납",
      desc: "내가 대여한 교구 반납 신청",
      color: "#7c3aed",
    }] : []),
    { id: "rental-status", label: "대여현황", desc: "선생님별 대여 현황", color: DS.primary },
    { id: "rental-approval", label: "대여승인", desc: "선생님 대여 신청 승인", color: "#d97706" },
    { id: "returns-approval", label: "반납승인", desc: "반납 신청 승인", color: "#2563eb" },
    { id: "reservation-approval", label: "예약승인", desc: "예약 신청 승인", color: "#0d9488" },
    { id: "overdue", label: "연체관리", desc: "연체 건 조회", color: "#dc2626" },
  ];
  return (
    <PageShell>
      <PageHeader me={me} subtitle={PAGE_META["rental-manage"].sub}/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14}}>
        {cards.map(c => (
          <button key={c.id} type="button" onClick={() => setPage(c.id)} style={{
            ...panelCard,textAlign:"left",cursor:"pointer",fontFamily:"inherit",
            borderLeft:`4px solid ${c.color}`,
          }}>
            <div style={{fontSize:16,fontWeight:700,color:"#111827",marginBottom:6}}>{c.label}</div>
            <div style={{fontSize:12,color:DS.textSecondary}}>{c.desc}</div>
          </button>
        ))}
      </div>
    </PageShell>
  );
}

function MyRentalStatusPage({ me, reqs, ris, items, rets, onReturnItem, onReturnItems, onCancelRequest, onEditRequest, embedded = false }) {
  const currentYmd = useTodayYmd();
  const holdings = useMemo(
    () => buildTeacherHoldingsByItem(me, reqs, ris, items, rets),
    [me, reqs, ris, items, rets, currentYmd]
  );
  const [selectedItemIds, setSelectedItemIds] = useState(() => new Set());
  const pendingReqs = useMemo(
    () => reqs.filter(r => r.teacher_id === me.id && r.status === "pending")
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [reqs, me.id]
  );
  const totalHeld = holdings.reduce((s, h) => s + h.totalHeld, 0);
  const totalPending = holdings.reduce((s, h) => s + h.totalPendingReturn, 0);

  const toggleHold = (itemId) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const startMultiReturn = () => {
    const selected = holdings.filter(h => selectedItemIds.has(h.item_id) && h.totalReturnable > 0);
    if (!selected.length) return alert("반납할 교구를 선택하세요");
    onReturnItems?.(selected);
  };

  const renderPendingActions = (req) => (
    <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
      <Btn sm onClick={() => onEditRequest?.(req)}>신청 수정</Btn>
      <Btn sm ghost danger onClick={() => onCancelRequest?.(req.id)}>신청 취소</Btn>
    </div>
  );

  const body = (
    <>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: 12,
        marginBottom: 20,
      }}>
        <DashStatCard label="승인 대기" value={pendingReqs.length} iconMark="대기" iconBg="#fef3c7" iconColor="#d97706"/>
        <DashStatCard label="대여 교구 종류" value={holdings.length} iconMark="종류" iconBg={RETURN_THEME.light} iconColor={RETURN_THEME.primary}/>
        <DashStatCard label="보유 수량" value={totalHeld} iconMark="수량" iconBg={RETURN_THEME.light} iconColor={RETURN_THEME.primary}/>
        <DashStatCard label="반납 승인 대기" value={totalPending} iconMark="반납" iconBg={RETURN_THEME.light} iconColor={RETURN_THEME.primary}/>
      </div>

      {pendingReqs.length > 0 && (
        <PanelSection title={`승인 대기 중인 신청 (${pendingReqs.length}건)`}>
          {pendingReqs.map(req => {
            const reqRIs = ris.filter(ri => ri.request_id === req.id);
            return (
              <div key={req.id} style={{ ...card, borderLeft: "3px solid #d97706", marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: DS.textPrimary }}>{req.dispatch_location}</div>
                    <div style={{ fontSize: 11, color: DS.textSecondary, marginTop: 2 }}>
                      {fmt(req.dispatch_start)} ~ {fmt(req.dispatch_end)}
                    </div>
                    {req.memo && <div style={{ fontSize: 11, color: DS.textMuted, marginTop: 1 }}>{req.memo}</div>}
                  </div>
                  <Badge s="pending"/>
                </div>
                {reqRIs.map(ri => (
                  <div key={ri.id} style={{ fontSize: 12, padding: "6px 0", borderTop: "1px solid #f8fafc", color: DS.textSecondary }}>
                    {iname(ri.item_id, items)} ×{ri.quantity}개
                    {ri.due_date && <span style={{ marginLeft: 8, color: DS.textMuted }}>반납예정 {fmt(ri.due_date)}</span>}
                  </div>
                ))}
                {renderPendingActions(req)}
              </div>
            );
          })}
        </PanelSection>
      )}

      {holdings.length === 0 ? (
        <PanelSection title="대여 중인 교구">
          <Empty text="현재 대여 중인 교구가 없습니다"/>
        </PanelSection>
      ) : (
        <PanelSection
          title={`대여 중인 교구 (${holdings.length})`}
          action={selectedItemIds.size > 0 ? startMultiReturn : undefined}
          actionLabel={selectedItemIds.size > 0 ? `선택 ${selectedItemIds.size}건 반납 ›` : undefined}
        >
          <div className="gts-rental-cards-grid">
          {holdings.map(group => {
            const item = group.item;
            const pendingRets = (rets || []).filter(
              r => r.status === "return_pending" && group.lines.some(l => l.ri.id === r.rental_item_id)
            );
            const checked = selectedItemIds.has(group.item_id);
            return (
              <div key={group.item_id} className="gts-rental-holding-card">
                <div className="gts-rental-holding-card__top">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={group.totalReturnable <= 0}
                    onChange={() => toggleHold(group.item_id)}
                    style={{ marginTop: 14 }}
                    aria-label={`${item?.name || "교구"} 선택`}
                  />
                  {item?.photo_url ? (
                    <div style={{ width: 48, height: 48, borderRadius: 10, overflow: "hidden", flexShrink: 0 }}>
                      <GearItemImg item={item} style={{ width: 48, height: 48 }}/>
                    </div>
                  ) : (
                    <div style={{
                      width: 48, height: 48, borderRadius: 10, background: "#f8fafc",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 10, fontWeight: 700, color: DS.textMuted, border: "1px solid #e2e8f0",
                      flexShrink: 0,
                    }}>
                      {item?.code?.slice(0, 4) || "—"}
                    </div>
                  )}
                  <div className="gts-rental-holding-card__meta">
                    <div style={{ fontWeight: 800, fontSize: 14, color: DS.textPrimary, lineHeight: 1.35 }}>
                      {item?.name || "-"}
                    </div>
                    <div style={{ fontFamily: "monospace", fontSize: 11, color: DS.textMuted, marginTop: 2 }}>
                      {item?.code}
                    </div>
                    {item?.last_return_location && (
                      <div style={{ fontSize: 11, color: "#0f766e", marginTop: 4, fontWeight: 600 }}>
                        최근 반납: {item.last_return_location}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8, alignItems: "center" }}>
                      <span style={{
                        fontSize: 12, fontWeight: 800, color: RETURN_THEME.text,
                        background: RETURN_THEME.light, padding: "3px 8px", borderRadius: 8,
                      }}>
                        대여 중 {group.totalHeld}개
                      </span>
                      {group.totalPendingReturn > 0 && (
                        <Badge s="return_pending" tone="return"/>
                      )}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: DS.textSecondary, lineHeight: 1.55 }}>
                  {group.lines.map(line => {
                    const dd = ddayTag(line.due_date);
                    return (
                      <div key={line.ri.id}>
                        · {line.req?.dispatch_location || "파견지"} — 보유 {line.held}개
                        {line.pendingRet > 0 && (
                          <span style={{ color: RETURN_THEME.text, fontWeight: 600 }}> (반납 대기 {line.pendingRet}개)</span>
                        )}
                        {dd && <span style={{ color: dd.color, marginLeft: 6 }}>{dd.text}</span>}
                      </div>
                    );
                  })}
                </div>
                {pendingRets.length > 0 && (
                  <div>
                    {pendingRets.map(ret => (
                      <div key={ret.id} style={{ fontSize: 11, color: DS.textMuted, marginTop: 2 }}>
                        └ 반납 요청 {ret.quantity}개 · <Badge s={ret.status} tone="return"/>
                      </div>
                    ))}
                  </div>
                )}
                <div className="gts-rental-holding-card__actions">
                  <Btn
                    sm
                    color={RETURN_THEME.primary}
                    disabled={group.totalReturnable <= 0}
                    onClick={() => onReturnItem(group)}
                  >
                    {group.totalReturnable > 0 ? "반납 신청" : "반납 승인 대기"}
                  </Btn>
                </div>
              </div>
            );
          })}
          </div>
        </PanelSection>
      )}
    </>
  );

  if (embedded) return body;
  return (
    <PageShell>
      <PageHeader me={me} subtitle={PAGE_META["my-rental-status"].sub}/>
      {body}
    </PageShell>
  );
}

function TeacherRentalReturnPage({
  me, reqs, ris, items, rets, teachers, onReturnItem, onReturnItems, onCancelRequest, onUpdateRequest, initialTab = "rent",
}) {
  const [tab, setTab] = useState(initialTab);
  const [editReq, setEditReq] = useState(null);
  const currentYmd = useTodayYmd();
  useEffect(() => { setTab(initialTab); }, [initialTab]);

  const pendingReturn = useMemo(() => {
    const holdings = buildTeacherHoldingsByItem(me, reqs, ris, items, rets);
    return holdings.reduce((s, h) => s + h.totalPendingReturn, 0);
  }, [me, reqs, ris, items, rets, currentYmd]);

  const editReqRIs = editReq ? ris.filter(ri => ri.request_id === editReq.id) : [];

  return (
    <PageShell>
      <PageHeader me={me} subtitle={PAGE_META["rental-return"].sub}/>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[["rent", "대여 신청"], ["return", pendingReturn > 0 ? `반납 신청 (${pendingReturn})` : "반납 신청"]].map(([v, l]) => {
          const activeColor = v === "return" ? RETURN_THEME.primary : DS.primary;
          const inactiveBackground = v === "return" ? RETURN_THEME.light : DS.primaryLight;
          const inactiveText = v === "return" ? RETURN_THEME.hover : DS.primary;
          return (
          <button
            key={v}
            type="button"
            onClick={() => setTab(v)}
            className={`gear-rental-tab${tab === v ? " is-active" : ""}${v === "return" ? " gear-rental-tab--return" : " gear-rental-tab--rent"}`}
            style={{
              flex: 1,
              padding: "12px 0",
              borderRadius: 12,
              border: "none",
              background: tab === v ? activeColor : inactiveBackground,
              color: tab === v ? "#fff" : inactiveText,
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              boxShadow: tab === v ? `0 4px 16px ${activeColor}33` : "none",
              transition: "all 0.2s",
              fontFamily: "inherit",
            }}
          >
            {l}
          </button>
          );
        })}
      </div>
      {tab === "rent" ? (
        <RentalsPage
          me={me}
          reqs={reqs}
          ris={ris}
          items={items}
          teachers={teachers}
          rets={rets}
          embedded
          onCancelRequest={onCancelRequest}
          onEditRequest={setEditReq}
        />
      ) : (
        <MyRentalStatusPage
          me={me}
          reqs={reqs}
          ris={ris}
          items={items}
          rets={rets}
          onReturnItem={onReturnItem}
          onReturnItems={onReturnItems}
          onCancelRequest={onCancelRequest}
          onEditRequest={setEditReq}
          embedded
        />
      )}
      {editReq && (
        <EditRentalRequestModal
          req={editReq}
          reqRIs={editReqRIs}
          items={items}
          ris={ris}
          rets={rets}
          onSubmit={async (payload) => {
            const ok = await onUpdateRequest(editReq.id, payload);
            if (ok) setEditReq(null);
          }}
          onClose={() => setEditReq(null)}
        />
      )}
    </PageShell>
  );
}

function QrPrintCard({ item, qrSize = 120, showCategory = false }) {
  return (
    <div className="gts-qr-print-card">
      <div className="gts-qr-print-qr">
        <GearQrDisplay item={item} size={qrSize}/>
      </div>
      <div className="gts-qr-print-meta">
        <div className="gts-qr-print-photo">
          {item.photo_url ? (
            <img src={item.photo_url} alt={item.name} style={itemPhotoStyle(item)}/>
          ) : (
            <span className="gts-qr-print-photo-fallback">{item.code?.slice(0, 4) || "GTS"}</span>
          )}
        </div>
        <div className="gts-qr-print-name">{item.name}</div>
        <div className="gts-qr-print-code">{item.code}</div>
        {showCategory && (
          <div style={{ marginTop: 4 }}>
            <CatTag cat={item.category}/>
          </div>
        )}
      </div>
    </div>
  );
}

function QrScreenCard({ item, qrSize = 128 }) {
  return (
    <div className="gts-qr-screen-card" style={{
      ...panelCard,
      marginBottom: 0,
      padding: "16px 14px",
      textAlign: "center",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
    }}>
      <div style={{
        display: "inline-flex",
        padding: 8,
        background: "#fff",
        border: "1px solid #e8ecee",
        borderRadius: 10,
        marginBottom: 12,
      }}>
        <GearQrDisplay item={item} size={qrSize}/>
      </div>
      <div className="gts-qr-print-name">{item.name}</div>
      <div className="gts-qr-print-code" style={{ marginBottom: 8 }}>{item.code}</div>
      <CatTag cat={item.category}/>
    </div>
  );
}

function QrScanPage({ me, items, onFound }) {
  const videoRef = useRef(null);
  const handledRef = useRef(false);
  const [manual, setManual] = useState("");
  const [cameraErr, setCameraErr] = useState("");
  const [cameraReady, setCameraReady] = useState(false);

  const resolveScan = useCallback((text) => {
    if (handledRef.current) return;
    const scan = parseQrScanText(text);
    const item = findItemByScan(items, scan);
    if (!item) {
      alert("등록되지 않은 교구입니다.");
      return;
    }
    handledRef.current = true;
    onFound(item);
  }, [items, onFound]);

  useEffect(() => {
    handledRef.current = false;
    let stream = null;
    let raf = 0;
    let detector = null;
    let cancelled = false;

    const start = async () => {
      if (typeof window === "undefined" || !window.isSecureContext) {
        setCameraErr("카메라 스캔은 HTTPS 또는 localhost 환경에서 사용할 수 있습니다. 교구 코드를 직접 입력해 주세요.");
        return;
      }
      if (!("BarcodeDetector" in window)) {
        setCameraErr("이 브라우저는 카메라 QR 스캔을 지원하지 않습니다. 교구 코드 또는 QR URL을 직접 입력해 주세요.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled || !videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
        detector = new window.BarcodeDetector({ formats: ["qr_code"] });
        const tick = async () => {
          if (cancelled || handledRef.current || !videoRef.current || !detector) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes?.length) {
              resolveScan(codes[0].rawValue);
              return;
            }
          } catch {
            /* frame skip */
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch {
        setCameraErr("카메라 접근 권한이 필요합니다. 교구 코드를 직접 입력해 주세요.");
      }
    };

    start();
    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      stream?.getTracks().forEach(t => t.stop());
    };
  }, [resolveScan]);

  return (
    <PageShell>
      <PageHeader me={me} subtitle={PAGE_META["qr-scan"].sub}/>
      <PanelSection title="카메라 스캔">
        {cameraErr ? (
          <div style={{
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            borderRadius: 12,
            padding: "12px 14px",
            fontSize: 13,
            color: "#9a3412",
            lineHeight: 1.6,
            marginBottom: 14,
          }}>
            {cameraErr}
          </div>
        ) : (
          <div style={{
            position: "relative",
            borderRadius: 14,
            overflow: "hidden",
            background: "#0f172a",
            aspectRatio: "4 / 3",
            maxHeight: 360,
            marginBottom: 14,
          }}>
            <video
              ref={videoRef}
              playsInline
              muted
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            {cameraReady && (
              <div style={{
                position: "absolute",
                inset: "18%",
                border: "2px solid rgba(255,255,255,0.85)",
                borderRadius: 12,
                boxShadow: "0 0 0 9999px rgba(15,23,42,0.35)",
                pointerEvents: "none",
              }}/>
            )}
          </div>
        )}
        <div style={{ fontSize: 12, color: DS.textMuted, lineHeight: 1.6 }}>
          QR 코드를 프레임 안에 맞추면 자동으로 교구 상세 페이지로 이동합니다.
        </div>
      </PanelSection>

      <PanelSection title="직접 입력">
        <Inp2
          label="교구 코드 또는 QR URL"
          value={manual}
          onChange={e => setManual(e.target.value)}
          placeholder="예: AIR-001 또는 QR 링크"
        />
        <Btn full onClick={() => resolveScan(manual)} disabled={!manual.trim()}>교구 찾기</Btn>
      </PanelSection>
    </PageShell>
  );
}

function QrRentPage({ item, ris, rets, cart, setCart, me, onOpenCart, onViewDetail, onDismiss }) {
  const avail = availQty(item, ris, rets);
  const added = cart.some(c => c.item_id === item.id);
  const teacher = me?.role === "teacher";

  const addToCart = () => {
    if (!teacher) return;
    if (added) {
      setCart(p => p.filter(c => c.item_id !== item.id));
      return;
    }
    if (avail <= 0) return alert("현재 대여 가능한 수량이 없습니다.");
    setCart(p => [...p, { item_id: item.id, quantity: 1, due_date: "" }]);
  };

  return (
    <PageShell>
      <div className="no-print" style={{ marginBottom: 16 }}>
        <button
          type="button"
          onClick={onDismiss}
          style={{
            background: "#fff", border: "1px solid #e8ecee", borderRadius: 10,
            color: DS.primary, fontWeight: 600, fontSize: 12, cursor: "pointer",
            padding: "8px 14px", fontFamily: "inherit",
          }}
        >
          ← 이전
        </button>
      </div>

      <PageHeader me={me} subtitle={PAGE_META["qr-rent"].sub}/>

      <PanelSection>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
          {item.photo_url ? (
            <div style={{ width: 120, height: 120, borderRadius: 14, overflow: "hidden", flexShrink: 0 }}>
              <GearItemImg item={item} style={{ width: 120, height: 120, borderRadius: 14 }}/>
            </div>
          ) : (
            <div style={{
              width: 120, height: 120, borderRadius: 14, background: "#f8fafc",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, fontWeight: 700, color: DS.textMuted, border: "1px solid #e2e8f0",
            }}>
              {item.code?.slice(0, 4)}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: DS.textPrimary }}>{item.name}</div>
            {item.alias && <div style={{ fontSize: 12, color: DS.textMuted, marginTop: 4 }}>({item.alias})</div>}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              <CatTag cat={item.category}/>
              <span style={{ fontFamily: "monospace", fontSize: 11, color: DS.textMuted, background: "#f8fafc", padding: "3px 8px", borderRadius: 6 }}>
                {item.code}
              </span>
              <span style={{ fontSize: 11, background: "#f8fafc", padding: "3px 8px", borderRadius: 99, border: "1px solid #e2e8f0" }}>
                {item.branch}
              </span>
            </div>
            <div style={{
              marginTop: 14, display: "inline-flex", alignItems: "center", gap: 8,
              background: avail > 0 ? "#dcfce7" : "#fee2e2",
              color: avail > 0 ? "#16a34a" : "#dc2626",
              padding: "8px 14px", borderRadius: 10, fontWeight: 800, fontSize: 14,
            }}>
              대여 가능 {avail}개
              <span style={{ fontWeight: 500, fontSize: 11, opacity: 0.85 }}>
                / 전체 {item.total_quantity} · 대여중 {rentedQty(item.id, ris, rets)}
              </span>
            </div>
            {item.description && (
              <p style={{ fontSize: 13, color: DS.textSecondary, lineHeight: 1.7, marginTop: 12 }}>
                {item.description}
              </p>
            )}
          </div>
        </div>

        {teacher ? (
          <div className="no-print" style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
            <Btn
              full
              color={added ? "#dc2626" : avail > 0 ? DS.primary : "#cbd5e1"}
              disabled={!added && avail === 0}
              onClick={addToCart}
            >
              {added ? "장바구니에서 빼기" : avail > 0 ? "장바구니에 담기" : "대여 불가"}
            </Btn>
            <Btn full ghost disabled={!cart.length} onClick={onOpenCart}>
              대여 신청하기 ({cart.length}종)
            </Btn>
          </div>
        ) : (
          <div className="no-print" style={{ marginTop: 18 }}>
            <Btn full onClick={onViewDetail}>교구 상세보기</Btn>
          </div>
        )}
      </PanelSection>
    </PageShell>
  );
}

function ItemsQrPage({ me, items }) {
  const { categoryMap, categoryKeys } = useGearCategories();
  const canManageItems = isItemAdmin(me);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [catF, setCatF] = useState("ALL");
  const [printFilter, setPrintFilter] = useState("ALL");

  useEffect(() => {
    const reset = () => setPrintFilter("ALL");
    window.addEventListener("afterprint", reset);
    return () => window.removeEventListener("afterprint", reset);
  }, []);

  const filtered = useMemo(() => {
    let r = [...items];
    if (catF !== "ALL") r = r.filter(i => categoryMatchesFilter(i.category, catF));
    return r.sort((a, b) => (a.code || "").localeCompare(b.code || ""));
  }, [items, catF]);

  const printItems = useMemo(() => {
    let r = [...items];
    if (printFilter !== "ALL") r = r.filter(i => categoryMatchesFilter(i.category, printFilter));
    return r.sort((a, b) => (a.code || "").localeCompare(b.code || ""));
  }, [items, printFilter]);

  const printCategory = (key) => {
    setPrintFilter(key);
    requestAnimationFrame(() => setTimeout(() => window.print(), 80));
  };

  const regenerateAll = async () => {
    if (!confirm(`${items.length}개 교구의 QR 이미지를 모두 다시 생성할까요?`)) return;
    setBulkLoading(true);
    for (const it of items) {
      try { await createItemQr(it); } catch { /* skip */ }
    }
    setBulkLoading(false);
    alert("QR 생성이 완료되었습니다.");
  };

  const printAll = () => {
    setPrintFilter("ALL");
    requestAnimationFrame(() => setTimeout(() => window.print(), 80));
  };

  const printHeaderLabel = printFilter === "ALL"
    ? "GTS 교구 QR 코드"
    : `GTS 교구 QR 코드 — ${getCategoryMeta(printFilter, categoryMap).label}`;

  return (
    <PageShell>
      <PageHeader
        me={me}
        subtitle={PAGE_META["items-qr"].sub}
        actions={(
          <div className="no-print" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Btn sm ghost onClick={printAll} disabled={!items.length}>전체 QR 출력</Btn>
            {catF !== "ALL" && (
              <Btn sm ghost onClick={() => printCategory(catF)} disabled={!filtered.length}>
                {getCategoryMeta(catF, categoryMap).label} QR 전체 인쇄
              </Btn>
            )}
            {canManageItems && (
              <Btn sm onClick={regenerateAll} disabled={bulkLoading || !items.length}>
                {bulkLoading ? "생성 중..." : "스토리지 QR 재생성"}
              </Btn>
            )}
          </div>
        )}
      />

      <div className="no-print" style={{ display: "flex", gap: 4, overflowX: "auto", marginBottom: 16, paddingBottom: 2 }}>
        <button
          type="button"
          onClick={() => setCatF("ALL")}
          style={{
            padding: "10px 14px",
            border: "none",
            borderBottom: catF === "ALL" ? `2px solid ${DS.primary}` : "2px solid transparent",
            background: "transparent",
            whiteSpace: "nowrap",
            color: catF === "ALL" ? DS.primary : DS.textSecondary,
            fontWeight: catF === "ALL" ? 700 : 500,
            fontSize: 12,
            cursor: "pointer",
            flexShrink: 0,
            marginBottom: -1,
            fontFamily: "inherit",
          }}
        >
          전체
        </button>
        {categoryKeys.map(c => {
          const m = categoryMap[c] || { label: c, color: "#94a3b8" };
          const count = items.filter(i => categoryMatchesFilter(i.category, c)).length;
          if (!count) return null;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setCatF(c)}
              style={{
                padding: "10px 14px",
                border: "none",
                borderBottom: catF === c ? `2px solid ${DS.primary}` : "2px solid transparent",
                background: "transparent",
                whiteSpace: "nowrap",
                color: catF === c ? DS.primary : DS.textSecondary,
                fontWeight: catF === c ? 700 : 500,
                fontSize: 12,
                cursor: "pointer",
                flexShrink: 0,
                marginBottom: -1,
                fontFamily: "inherit",
              }}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="no-print">
          <PanelSection title="QR 목록">
            <Empty text={catF === "ALL" ? "등록된 교구가 없습니다" : "해당 카테고리 교구가 없습니다"}/>
          </PanelSection>
        </div>
      ) : (
        <>
          <div className="no-print" style={{ fontSize: 13, color: DS.textSecondary, marginBottom: 12, fontWeight: 600 }}>
            {filtered.length}개 교구
          </div>
          <div className="no-print gts-qr-screen-grid">
            {filtered.map(it => (
              <QrScreenCard key={it.id} item={it} qrSize={128}/>
            ))}
          </div>

          <div id="gts-qr-print-area" className="gts-qr-print-only">
            <div className="gts-qr-print-header">{printHeaderLabel}</div>
            <div className="gts-qr-print-grid">
              {printItems.map(it => <QrPrintCard key={it.id} item={it} showCategory/>)}
            </div>
          </div>
        </>
      )}
    </PageShell>
  );
}

function RentalStatusPage({me,teachers,reqs,ris,rets,items,initialFilter="all",onForceReturn}) {
  const [filter,setFilter]=useState(initialFilter);
  const [selected,setSelected]=useState(null);
  const [modalTab,setModalTab]=useState("current");
  const isOverduePage = initialFilter === "overdue";

  useEffect(() => { setFilter(initialFilter); }, [initialFilter]);

  const summaries=useMemo(
    ()=>buildTeacherSummaries(teachers,reqs,ris,items,rets),
    [teachers,reqs,ris,items,rets]
  );

  useEffect(() => {
    if (!selected) return;
    const fresh = summaries.find(s => s.teacher.id === selected.teacher.id);
    if (!fresh) return;
    const prevKey = selected.current.map(l => `${l.ri.id}:${l.ri.status}`).join("|");
    const nextKey = fresh.current.map(l => `${l.ri.id}:${l.ri.status}`).join("|");
    if (prevKey !== nextKey || fresh.totalQty !== selected.totalQty) {
      setSelected(fresh);
    }
  }, [summaries]);

  const overdueItems=useMemo(()=>ris
    .filter(ri=>["rented","partial_returned"].includes(ri.status)&&dday(ri.due_date)!==null&&dday(ri.due_date)<0)
    .map(ri=>{
      const req=reqs.find(r=>r.id===ri.request_id);
      return {
        ri,
        req,
        teacher:req? tname(req.teacher_id,teachers):"-",
        itemName:iname(ri.item_id,items),
        dd:ddayTag(ri.due_date),
      };
    })
    .sort((a,b)=>dday(a.ri.due_date)-dday(b.ri.due_date)),
  [ris,reqs,teachers,items]);

  /** 반납 시점에 연체였던 해결 건 */
  const resolvedOverdueRows = useMemo(() => (rets || [])
    .filter(r => ["return_approved", "damage_confirmed", "loss_confirmed"].includes(r.status))
    .map(ret => {
      const ri = ris.find(r => r.id === ret.rental_item_id);
      if (!ri?.due_date) return null;
      const actualReturnAt = ret.approved_at || ret.created_at;
      const delta = ddayKstAsOf(ri.due_date, actualReturnAt);
      if (delta == null || delta >= 0) return null;
      const req = reqs.find(r => r.id === ri.request_id);
      const teacherId = ret.teacher_id || req?.teacher_id;
      return {
        id: ret.id,
        teacherName: tname(teacherId, teachers),
        itemName: iname(ri.item_id, items),
        dueDate: ri.due_date,
        actualReturnAt,
        overdueDays: Math.abs(delta),
        adminName: ret.approved_by ? tname(ret.approved_by, teachers) : "-",
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.actualReturnAt) - new Date(a.actualReturnAt)),
  [rets, ris, reqs, teachers, items]);

  const filtered=useMemo(()=>{
    if(filter==="active") return summaries.filter(s=>s.hasCurrent);
    if(filter==="overdue") return summaries.filter(s=>s.hasOverdue);
    if(filter==="none") return summaries.filter(s=>!s.hasCurrent);
    return summaries;
  },[summaries,filter]);

  const stats=useMemo(()=>{
    const renting=summaries.filter(s=>s.hasCurrent);
    const overdue=summaries.filter(s=>s.hasOverdue);
    const okRenting=renting.filter(s=>!s.hasOverdue).length;
    return {
      renting:renting.length,
      overdue:overdue.length,
      okRenting,
      empty:summaries.filter(s=>!s.hasCurrent).length,
      totalQty:summaries.reduce((s,x)=>s+x.totalQty,0),
      totalTeachers:summaries.length,
    };
  },[summaries]);

  const dueAlerts=useMemo(()=>getDueAlerts(ris,reqs,items,teachers),[ris,reqs,items,teachers]);
  const monthBars=useMemo(()=>buildMonthlyRentalCounts(ris),[ris]);
  const maxMonth=Math.max(1,...monthBars.map(m=>m.count));

  const returnRate=useMemo(()=>{
    const done=ris.filter(r=>r.status==="returned").length;
    const all=ris.filter(r=>!["pending","rejected"].includes(r.status)).length;
    return all ? Math.round((done/all)*100) : 100;
  },[ris]);

  const donutTotal=stats.totalTeachers||1;
  const donutSegs=[
    {n:stats.okRenting,color:"#16a34a",label:"정상 대여"},
    {n:stats.overdue,color:"#dc2626",label:"연체"},
    {n:stats.empty,color:"#cbd5e1",label:"대여 없음"},
  ].filter(s=>s.n>0);
  let donutCursor=0;
  const donutGradient=donutSegs.length
    ? `conic-gradient(${donutSegs.map(s=>{
        const pct=(s.n/donutTotal)*100;
        const from=donutCursor;
        donutCursor+=pct;
        return `${s.color} ${from}% ${donutCursor}%`;
      }).join(", ")})`
    : "conic-gradient(#e2e8f0 0% 100%)";

  const openTeacher=(s)=>{setSelected(s);setModalTab("current");};

  useEffect(() => {
    if (!selected) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow || "";
    };
  }, [selected]);

  const statCard=(id,label,value,iconBg,iconColor,filterId,iconMark)=>{
    const on=filter===filterId;
    return(
      <button key={id} type="button" onClick={()=>setFilter(filterId)} style={{
        background:"#fff",borderRadius:18,padding:"20px 22px",
        border:on?`2px solid ${DS.primary}`:"1px solid #e8ecee",
        boxShadow:on?"0 8px 24px rgba(22,163,74,0.12)":"0 1px 4px rgba(0,0,0,0.04)",
        display:"flex",alignItems:"center",gap:16,width:"100%",
        cursor:"pointer",fontFamily:"inherit",textAlign:"left",
        transition:"box-shadow 0.15s, border-color 0.15s",
      }}>
        <div style={{
          width:52,height:52,borderRadius:14,flexShrink:0,
          background:iconBg,display:"flex",alignItems:"center",justifyContent:"center",
          fontSize:13,fontWeight:800,color:iconColor,
        }}>{iconMark}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:12,color:DS.textMuted,fontWeight:500,marginBottom:4}}>{label}</div>
          <div style={{fontSize:28,fontWeight:800,color:"#111827",letterSpacing:"-0.5px",lineHeight:1}}>{value}</div>
        </div>
        <span style={{color:"#cbd5e1",fontSize:18,fontWeight:300}}>›</span>
      </button>
    );
  };

  const filterChip=(id,label)=>{
    const on=filter===id;
    return(
      <button key={id} type="button" onClick={()=>setFilter(id)} style={{
        padding:"8px 14px",borderRadius:99,border:"none",
        background:on?DS.primary:"#f1f5f9",
        color:on?"#fff":DS.textSecondary,
        fontSize:12,fontWeight:on?700:500,cursor:"pointer",fontFamily:"inherit",
      }}>{label}</button>
    );
  };

  return(
    <PageShell>
      <PageHeader
        me={me}
        subtitle={isOverduePage ? PAGE_META.overdue.sub : PAGE_META["rental-status"].sub}
        alertCount={dueAlerts.length}
      />

      {isOverduePage ? (
        <>
          <PanelSection title={`연체 목록 (${overdueItems.length}건)`}>
            {overdueItems.length === 0 ? (
              <Empty text="연체 건이 없습니다"/>
            ) : overdueItems.map(({ ri, req, teacher, itemName, dd }) => (
              <div key={ri.id} style={{ ...card, borderLeft: "3px solid #dc2626", marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: "#dc2626" }}>
                      {itemName} ×{ri.quantity}개
                    </div>
                    <div style={{ fontSize: 12, color: DS.textSecondary, marginTop: 6, lineHeight: 1.7 }}>
                      <div>대여자: {teacher}</div>
                      <div>사용 장소: {req?.dispatch_location || "-"}</div>
                      <div>
                        반납예정: {fmt(ri.due_date)} ·{" "}
                        <span style={{ fontWeight: 800, color: dd?.color }}>{dd?.text}</span>
                      </div>
                    </div>
                  </div>
                  <ForceReturnButton ri={ri} me={me} itemName={itemName} onForceReturn={onForceReturn}/>
                </div>
              </div>
            ))}
          </PanelSection>

          <PanelSection title={`연체 해결 내역 (${resolvedOverdueRows.length}건)`}>
            {resolvedOverdueRows.length === 0 ? (
              <Empty text="연체 해결 내역이 없습니다"/>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <div style={{
                  display: "grid",
                  gap: 8,
                  padding: "8px 0",
                  borderBottom: "1px solid #e2e8f0",
                  fontSize: 10,
                  fontWeight: 700,
                  color: DS.textMuted,
                  gridTemplateColumns: "minmax(72px, 0.9fr) minmax(100px, 1.3fr) minmax(80px, 0.9fr) minmax(80px, 0.9fr) minmax(64px, 0.6fr) minmax(72px, 0.9fr)",
                  minWidth: 680,
                }}>
                  <span>선생님명</span>
                  <span>교구명</span>
                  <span>반납예정일</span>
                  <span>실제반납일</span>
                  <span>연체일수</span>
                  <span>처리 관리자</span>
                </div>
                {resolvedOverdueRows.map(row => (
                  <div
                    key={row.id}
                    style={{
                      display: "grid",
                      gap: 8,
                      padding: "12px 0",
                      borderTop: "1px solid #f8fafc",
                      fontSize: 12,
                      alignItems: "start",
                      gridTemplateColumns: "minmax(72px, 0.9fr) minmax(100px, 1.3fr) minmax(80px, 0.9fr) minmax(80px, 0.9fr) minmax(64px, 0.6fr) minmax(72px, 0.9fr)",
                      minWidth: 680,
                    }}
                  >
                    <span style={{ fontWeight: 700, color: DS.textPrimary }}>{row.teacherName}</span>
                    <span style={{ color: DS.textSecondary, lineHeight: 1.5 }}>{row.itemName}</span>
                    <span style={{ color: DS.textSecondary }}>{fmt(row.dueDate)}</span>
                    <span style={{ color: DS.textSecondary }}>{fmt(row.actualReturnAt)}</span>
                    <span style={{ fontWeight: 800, color: "#dc2626" }}>{row.overdueDays}일</span>
                    <span style={{ fontWeight: 600, color: DS.textPrimary }}>{row.adminName}</span>
                  </div>
                ))}
              </div>
            )}
          </PanelSection>
        </>
      ) : (
      <>
      <div style={{
        display:"grid",
        gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",
        gap:14,marginBottom:24,
      }}>
        {statCard("renting","대여 중 선생님",stats.renting,DS.primaryLight,DS.primary,"active","대여")}
        {statCard("overdue","연체",stats.overdue,"#fee2e2","#dc2626","overdue","연체")}
        {statCard("empty","대여 없음",stats.empty,"#f1f5f9","#64748b","none","없음")}
        {statCard("qty","총 대여 수량",stats.totalQty,"#dbeafe","#2563eb","all","수량")}
      </div>

      <div style={{
        display:"grid",
        gridTemplateColumns:"minmax(0,1.35fr) minmax(280px,0.85fr)",
        gap:18,marginBottom:18,
      }}>
        <div style={panelCard}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <div style={{fontSize:16,fontWeight:700,color:"#111827"}}>선생님별 대여 현황</div>
            <button type="button" onClick={()=>setFilter("all")} style={{
              border:"none",background:"transparent",color:DS.primary,
              fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
            }}>전체 보기</button>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:18}}>
            {filterChip("all","전체")}
            {filterChip("active","대여중")}
            {filterChip("overdue","연체")}
            {filterChip("none","없음")}
          </div>

          {filtered.length===0 ? (
            <div style={{textAlign:"center",padding:"48px 16px"}}>
              <div style={{
                width:72,height:72,borderRadius:20,background:"#f8fafc",
                margin:"0 auto 16px",display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:13,fontWeight:700,color:"#94a3b8",letterSpacing:"0.05em",
              }}>EMPTY</div>
              <div style={{fontSize:14,color:DS.textMuted,marginBottom:4}}>해당하는 선생님이 없습니다</div>
              <div style={{fontSize:12,color:DS.textMuted}}>다른 필터를 선택해 보세요</div>
            </div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:10,maxHeight:420,overflowY:"auto",paddingRight:4}}>
              {filtered.map(s=>{
                const overdueCard=s.hasOverdue;
                return(
                  <div
                    key={s.teacher.id}
                    onClick={()=>openTeacher(s)}
                    style={{
                      display:"flex",alignItems:"center",gap:14,padding:"14px 16px",
                      borderRadius:14,cursor:"pointer",
                      border:overdueCard?"1px solid #fecaca":"1px solid #f1f5f9",
                      background:overdueCard?"#fffafa":"#fafbfc",
                      transition:"background 0.15s",
                    }}
                    onMouseEnter={e=>{e.currentTarget.style.background=overdueCard?"#fef2f2":"#f1f5f9";}}
                    onMouseLeave={e=>{e.currentTarget.style.background=overdueCard?"#fffafa":"#fafbfc";}}
                  >
                    <div style={{
                      width:42,height:42,borderRadius:12,flexShrink:0,
                      background:overdueCard?"#fee2e2":DS.primaryLight,
                      display:"flex",alignItems:"center",justifyContent:"center",
                      fontSize:16,fontWeight:800,color:overdueCard?"#dc2626":DS.primary,
                    }}>{s.teacher.name[0]}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:700,fontSize:14,color:overdueCard?"#dc2626":"#111827"}}>{s.teacher.name}</div>
                      <div style={{fontSize:12,color:DS.textMuted,marginTop:3}}>
                        대여 {s.itemCount}종 · {s.totalQty}개
                      </div>
                    </div>
                    <div style={{display:"flex",gap:5,flexShrink:0,flexWrap:"wrap",justifyContent:"flex-end"}}>
                      {s.hasCurrent&&<MiniBadge label="대여중" bg="#ede9fe" color="#7c3aed"/>}
                      {s.hasOverdue&&<MiniBadge label="연체" bg="#fee2e2" color="#dc2626"/>}
                      {!s.hasCurrent&&<MiniBadge label="없음" bg="#f1f5f9" color="#94a3b8"/>}
                    </div>
                    <span style={{color:"#cbd5e1",marginLeft:4}}>›</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={panelCard}>
          <div style={{fontSize:16,fontWeight:700,color:"#111827",marginBottom:16}}>반납 임박 · 연체</div>
          {dueAlerts.length===0 ? (
            <div style={{textAlign:"center",padding:"40px 12px",color:DS.textMuted,fontSize:13}}>
              임박·연체 항목이 없습니다
            </div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:0,maxHeight:420,overflowY:"auto"}}>
              {dueAlerts.slice(0,12).map(({ri,d,itemName,teacher,dueDate},i)=>{
                const urgent=d<=0;
                return(
                  <div key={ri.id} style={{
                    display:"flex",gap:12,padding:"14px 0",
                    borderTop:i>0?"1px solid #f1f5f9":"none",alignItems:"flex-start",
                  }}>
                    <div style={{
                      width:8,height:8,borderRadius:"50%",marginTop:6,flexShrink:0,
                      background:urgent?"#dc2626":DS.primary,
                    }}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:600,color:"#111827",lineHeight:1.4}}>
                        {itemName} · {teacher}
                      </div>
                      <div style={{fontSize:11,color:DS.textMuted,marginTop:4}}>
                        반납예정 {fmt(dueDate)}
                      </div>
                      {urgent && (
                        <div style={{ marginTop: 8 }}>
                          <ForceReturnButton ri={ri} me={me} itemName={itemName} onForceReturn={onForceReturn}/>
                        </div>
                      )}
                    </div>
                    <span style={{
                      fontSize:11,fontWeight:800,flexShrink:0,
                      color:urgent?"#dc2626":"#ea580c",
                    }}>{ddayTag(dueDate)?.text}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div style={{
        display:"grid",
        gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",
        gap:18,
      }}>
        <div style={panelCard}>
          <div style={{fontSize:15,fontWeight:700,color:"#111827",marginBottom:18}}>선생님 현황 요약</div>
          <div style={{display:"flex",alignItems:"center",gap:20}}>
            <div style={{
              width:120,height:120,borderRadius:"50%",background:donutGradient,
              display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,
            }}>
              <div style={{
                width:76,height:76,borderRadius:"50%",background:"#fff",
                display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
              }}>
                <div style={{fontSize:22,fontWeight:800,color:"#111827"}}>{donutTotal}</div>
                <div style={{fontSize:10,color:DS.textMuted}}>명</div>
              </div>
            </div>
            <div style={{flex:1,display:"flex",flexDirection:"column",gap:10}}>
              {donutSegs.map(s=>(
                <div key={s.label} style={{display:"flex",alignItems:"center",gap:8,fontSize:12}}>
                  <span style={{width:10,height:10,borderRadius:3,background:s.color,flexShrink:0}}/>
                  <span style={{color:DS.textSecondary,flex:1}}>{s.label}</span>
                  <span style={{fontWeight:700,color:"#111827"}}>{s.n}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={panelCard}>
          <div style={{fontSize:15,fontWeight:700,color:"#111827",marginBottom:18}}>월별 대여 수량</div>
          <div style={{display:"flex",alignItems:"flex-end",gap:8,height:120}}>
            {monthBars.map(m=>(
              <div key={m.key} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
                <div style={{
                  width:"100%",maxWidth:36,
                  height:`${Math.max(8,(m.count/maxMonth)*96)}px`,
                  background:`linear-gradient(180deg, ${DS.primary} 0%, #86efac 100%)`,
                  borderRadius:"6px 6px 2px 2px",
                  minHeight:8,
                }}/>
                <span style={{fontSize:10,color:DS.textMuted}}>{m.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={panelCard}>
          <div style={{fontSize:15,fontWeight:700,color:"#111827",marginBottom:18}}>반납 완료율</div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:"8px 0"}}>
            <div style={{position:"relative",width:120,height:120}}>
              <svg width="120" height="120" viewBox="0 0 120 120" style={{transform:"rotate(-90deg)"}}>
                <circle cx="60" cy="60" r="50" fill="none" stroke="#f1f5f9" strokeWidth="12"/>
                <circle cx="60" cy="60" r="50" fill="none" stroke={DS.primary} strokeWidth="12"
                  strokeDasharray={`${returnRate*3.14} 314`} strokeLinecap="round"/>
              </svg>
              <div style={{
                position:"absolute",inset:0,display:"flex",flexDirection:"column",
                alignItems:"center",justifyContent:"center",
              }}>
                <div style={{fontSize:26,fontWeight:800,color:"#111827"}}>{returnRate}%</div>
                <div style={{fontSize:10,color:DS.textMuted}}>완료</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {selected&&(
        <div style={{
          position:"fixed",inset:0,background:"rgba(15,23,42,0.45)",
          backdropFilter:"blur(4px)",zIndex:1000,
          display:"flex",alignItems:"center",justifyContent:"center",padding:20,
        }} onClick={()=>setSelected(null)}>
          <div style={{
            background:"#fff",borderRadius:20,width:"min(96vw, 1000px)",
            maxHeight:"88vh",overflow:"hidden",display:"flex",flexDirection:"column",
            boxShadow:"0 24px 48px rgba(0,0,0,0.18)",
            overscrollBehavior:"contain",
          }} onClick={e=>e.stopPropagation()}>
            <div style={{padding:"20px 22px 0",borderBottom:"1px solid #f1f5f9",flexShrink:0}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
                <div>
                  <div style={{fontSize:18,fontWeight:700,color:selected.hasOverdue?"#dc2626":DS.textPrimary}}>
                    {selected.teacher.name}
                  </div>
                  <div style={{fontSize:12,color:DS.textMuted,marginTop:4}}>
                    대여 {selected.itemCount}종 · 총 {selected.totalQty}개
                  </div>
                </div>
                <button onClick={()=>setSelected(null)} style={{
                  background:"#f1f5f9",border:"none",borderRadius:8,
                  padding:"8px 12px",cursor:"pointer",fontSize:12,fontWeight:600,color:DS.textSecondary,
                }}>닫기</button>
              </div>
              <div style={{display:"flex",gap:0}}>
                {[["current","현재 대여중"],["history","전체 히스토리"]].map(([id,label])=>{
                  const on=modalTab===id;
                  return(
                    <button key={id} onClick={()=>setModalTab(id)} style={{
                      flex:1,padding:"12px 0",border:"none",background:"transparent",
                      borderBottom:on?`2px solid ${DS.primary}`:"2px solid transparent",
                      color:on?DS.primary:DS.textMuted,fontWeight:on?700:500,
                      fontSize:13,cursor:"pointer",fontFamily:"inherit",
                    }}>{label}</button>
                  );
                })}
              </div>
            </div>

            {modalTab==="current" ? (
              <div style={{flex:1,minHeight:0,display:"flex",overflow:"hidden"}}>
                <HoldingsListView
                  held={selected.current.map(c=>c.ri)}
                  items={items}
                  reqs={reqs}
                  me={me}
                  onForceReturn={onForceReturn}
                />
              </div>
            ) : (
              <div style={{padding:"16px 22px 22px",overflowY:"auto",flex:1}}>
                {selected.lines.length===0 ? (
                  <Empty text="대여 기록이 없습니다"/>
                ) : (
                  <div>
                    <div style={{
                      display:"grid",gridTemplateColumns:"72px 1fr 40px 1fr 64px",
                      gap:8,padding:"8px 0",borderBottom:"1px solid #e2e8f0",
                      fontSize:10,fontWeight:700,color:DS.textMuted,
                    }}>
                      <span>날짜</span><span>교구</span><span>수량</span><span>파견지</span><span>상태</span>
                    </div>
                    {[...selected.lines].sort((a,b)=>new Date(b.sortAt)-new Date(a.sortAt)).map(l=>{
                      const dateStr=l.sortAt?fmt(l.sortAt):fmt(l.req?.dispatch_start);
                      return(
                        <div key={l.ri.id} style={{
                          display:"grid",gridTemplateColumns:"72px 1fr 40px 1fr 64px",
                          gap:8,padding:"10px 0",borderBottom:"1px solid #f8fafc",
                          fontSize:11,alignItems:"center",
                        }}>
                          <span style={{color:DS.textMuted}}>{dateStr}</span>
                          <span style={{fontWeight:600,color:DS.textPrimary}}>{l.item?.name||"-"}</span>
                          <span style={{fontWeight:700}}>{l.ri.quantity}</span>
                          <span style={{color:DS.textSecondary}}>{l.req?.dispatch_location||"-"}</span>
                          {l.forceReturn ? (
                            <span style={{ fontSize: 10, fontWeight: 700, color: "#dc2626", lineHeight: 1.35 }}>
                              {FORCE_RETURN_MEMO}
                              {l.forceReturnBy && (
                                <span style={{ display: "block", color: DS.textMuted, fontWeight: 600 }}>
                                  {l.forceReturnBy} · {fmt(l.forceReturnAt)}
                                </span>
                              )}
                            </span>
                          ) : (
                            <Badge s={l.ri.status}/>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      </>
      )}
    </PageShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 대여 신청 관리
// ═══════════════════════════════════════════════════════════════════════
function RentalsPage({me,reqs,ris,items,teachers,rets,onApprove,onReject,onCancelRequest,onEditRequest,embedded=false}) {
  // 내 대여·반납(embedded)에서는 role과 무관하게 본인 신청만 표시. 관리자 전체 목록은 대여승인 등 별도 화면.
  const manageAll = isItemAdmin(me) && !embedded;
  const[tab,setTab]=useState("active");
  const[rejectId,setRejectId]=useState(null);
  const[reason,setReason]=useState("");
  const mine=manageAll?reqs:reqs.filter(r=>r.teacher_id===me.id);
  const active=mine.filter(r=>["pending","approved","partial"].includes(r.status));
  const done=mine.filter(r=>["rejected","completed","cancelled"].includes(r.status));
  const list=tab==="active"?active:done;
  const pendingCount=active.filter(r=>r.status==="pending").length;

  const body = (
    <>
      <div style={{
        display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",
        gap:14,marginBottom:24,
      }}>
        <DashStatCard label="진행 중" value={active.length} iconMark="진행" iconBg={DS.primaryLight} iconColor={DS.primary}/>
        <DashStatCard label="완료·거절" value={done.length} iconMark="완료" iconBg="#f1f5f9" iconColor="#64748b"/>
        {manageAll&&<DashStatCard label="승인 대기" value={pendingCount} iconMark="대기" iconBg="#fef3c7" iconColor="#d97706"/>}
      </div>

      {!manageAll && !embedded && active.length > 0 && (
        <div style={{
          background: "#fff7ed",
          border: "1px solid #fed7aa",
          borderRadius: 12,
          padding: "12px 16px",
          marginBottom: 16,
          fontSize: 13,
          color: "#9a3412",
          lineHeight: 1.6,
        }}>
          교구 <strong>반납 신청</strong>은 <strong>「반납 신청」</strong> 탭에서 교구별로 진행해 주세요.
        </div>
      )}

      <PanelSection title="대여 신청 목록">
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {[["active",`진행중 ${active.length}`,DS.primary],["done",`완료 ${done.length}`,"#64748b"]].map(([v,l,c])=>(
          <button key={v} onClick={()=>setTab(v)} style={{
            flex:1,padding:"12px 0",borderRadius:12,border:"none",
            background:tab===v?c:"#f1f5f9",
            color:tab===v?"#fff":DS.textSecondary,
            fontWeight:700,fontSize:13,cursor:"pointer",
            boxShadow:tab===v?`0 4px 16px ${c}33`:"none",
            transition:"all 0.2s",fontFamily:"inherit",
          }}>{l}</button>
        ))}
      </div>

      {!list.length&&<Empty text="해당하는 대여 기록이 없습니다"/>}
      {!!list.length && (
      <div className="gts-rental-cards-grid">
      {list.map(req=>{
        const t=teachers.find(x=>x.id===req.teacher_id);
        const reqRIs=ris.filter(ri=>ri.request_id===req.id);
        return(
          <div key={req.id} className="gts-rental-req-card" style={{...card,borderLeft:`3px solid ${SC[req.status]?.c||"#e2e8f0"}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:8}}>
              <div style={{minWidth:0,flex:1}}>
                {manageAll&&(
                  <div style={{fontSize:11,fontWeight:700,color:DS.primary,marginBottom:3}}>
                    {t?.name} <RoleBadge role={t?.role} isItemAdmin={t?.is_item_admin}/>
                  </div>
                )}
                <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:8}}>
                  <div style={{fontWeight:800,fontSize:14,color:DS.textPrimary}}>{req.dispatch_location}</div>
                  <Badge s={req.status}/>
                </div>
                <div style={{fontSize:11,color:DS.textSecondary,marginTop:2}}>{fmt(req.dispatch_start)} ~ {fmt(req.dispatch_end)}</div>
                {req.memo&&<div style={{fontSize:11,color:DS.textMuted,marginTop:1}}>{req.memo}</div>}
                {req.rejection_reason&&(
                  <div style={{fontSize:11,color:"#dc2626",background:"#fee2e2",padding:"4px 8px",borderRadius:7,marginTop:5,fontWeight:600}}>
                    거절: {req.rejection_reason}
                  </div>
                )}
              </div>
            </div>
            {reqRIs.map(ri=>{const dd=ddayTag(ri.due_date);const relRets=rets.filter(r=>r.rental_item_id===ri.id);return(
              <div key={ri.id} style={{padding:"7px 0",borderTop:"1px solid #f8fafc"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                  <span style={{fontSize:13,fontWeight:600,color:DS.textPrimary,minWidth:0}}>
                    {iname(ri.item_id,items)} ×{ri.quantity}개
                    {ri.due_date && <span style={{ fontSize: 11, color: DS.textMuted, marginLeft: 6 }}>반납예정 {fmt(ri.due_date)}</span>}
                  </span>
                  <div style={{display:"flex",gap:5,alignItems:"center",flexShrink:0}}>
                    {dd&&<span style={{fontSize:11,color:dd.color,fontWeight:dd.urgent?800:500}}>{dd.text}</span>}
                    <Badge s={ri.status}/>
                  </div>
                </div>
                {relRets.map(ret=>(
                  <div key={ret.id} style={{fontSize:10,color:DS.textMuted,marginTop:3}}>
                    └ 반납 신청 {ret.quantity}개 ({CC[ret.condition]?.l}) · <Badge s={ret.status}/>
                  </div>
                ))}
              </div>
            );})}
            {!manageAll && req.status === "pending" && (
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <Btn sm onClick={() => onEditRequest?.(req)}>신청 수정</Btn>
                <Btn sm ghost danger onClick={() => onCancelRequest?.(req.id)}>신청 취소</Btn>
              </div>
            )}
            {manageAll&&req.status==="pending"&&(
              <div style={{display:"flex",gap:8,marginTop:10}}>
                <Btn sm color={DS.primary} onClick={()=>onApprove(req.id)}>승인</Btn>
                <Btn sm danger onClick={()=>{setRejectId(req.id);setReason("");}}>거절</Btn>
              </div>
            )}
          </div>
        );
      })}
      </div>
      )}

      {rejectId&&(
        <Modal title="거절 사유 입력" onClose={()=>setRejectId(null)}>
          <Txa2 label="거절 사유 *" value={reason} onChange={e=>setReason(e.target.value)} placeholder="거절 이유 입력 (선생님에게 표시됩니다)"/>
          <Btn full danger onClick={()=>{if(!reason.trim())return alert("사유를 입력하세요");onReject(rejectId,reason);setRejectId(null);}}>거절 처리</Btn>
        </Modal>
      )}
      </PanelSection>
    </>
  );

  if (embedded) return body;
  return (
    <PageShell>
      <PageHeader me={me} subtitle={PAGE_META.rentals.sub} alertCount={manageAll ? pendingCount : 0}/>
      {body}
    </PageShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 장바구니 모달 — 리디자인
// ═══════════════════════════════════════════════════════════════════════
const RENTAL_MAX_DAYS = 28;
const RENTAL_ERR_DUE_BEFORE_START = "반납 예정일은 대여 시작일 이후여야 합니다";
const RENTAL_ERR_END_BEFORE_START = "대여 종료일은 대여 시작일 이후여야 합니다";
const RENTAL_ERR_MAX_PERIOD = "대여 기간은 최대 4주(28일)까지 가능합니다";
const RESERVATION_MIN_DAYS_AHEAD = 3;
const RESERVATION_ERR_MIN_DAYS_AHEAD = "예약은 최소 3일 전부터 가능합니다";

function reservationMinStartYmd() {
  return addDaysYmd(todayYmd(), RESERVATION_MIN_DAYS_AHEAD);
}

function defaultReservationDates() {
  const start_date = reservationMinStartYmd();
  return { start_date, end_date: addDaysYmd(start_date, 7) };
}

function parseYmdDate(ymd) {
  if (!ymd) return null;
  const [y, m, d] = String(ymd).split("-").map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function dayDiffFromRentalStart(startYmd, targetYmd) {
  const start = parseYmdDate(startYmd);
  const target = parseYmdDate(targetYmd);
  if (!start || !target) return null;
  return Math.round((target - start) / 86400000);
}

function validateCartRentalDates(dispatchStart, dispatchEnd, detailItems) {
  if (!dispatchStart) return null;

  if (dispatchEnd) {
    const endDiff = dayDiffFromRentalStart(dispatchStart, dispatchEnd);
    if (endDiff !== null && endDiff < 0) return RENTAL_ERR_END_BEFORE_START;
    if (endDiff !== null && endDiff > RENTAL_MAX_DAYS) return RENTAL_ERR_MAX_PERIOD;
  }

  for (const c of detailItems) {
    const due = c.due_date || dispatchEnd;
    if (!due) continue;
    const diff = dayDiffFromRentalStart(dispatchStart, due);
    if (diff !== null && diff < 0) return RENTAL_ERR_DUE_BEFORE_START;
    if (diff !== null && diff > RENTAL_MAX_DAYS) return RENTAL_ERR_MAX_PERIOD;
  }

  return null;
}

function validateReservationDates(startYmd, endYmd) {
  if (!startYmd || !endYmd) return "예약 기간을 입력하세요";
  const today = todayLocalDay();
  const start = parseLocalDay(startYmd);
  if (start) {
    const diff = Math.round((start - today) / 86400000);
    if (diff < RESERVATION_MIN_DAYS_AHEAD) return RESERVATION_ERR_MIN_DAYS_AHEAD;
  }
  const endDiff = dayDiffFromRentalStart(startYmd, endYmd);
  if (endDiff !== null && endDiff < 0) return RENTAL_ERR_END_BEFORE_START;
  if (endDiff !== null && endDiff > RENTAL_MAX_DAYS) return RENTAL_ERR_MAX_PERIOD;
  return null;
}

function ReservationModal({ item, onClose, onSubmit }) {
  const initialDates = useMemo(() => defaultReservationDates(), []);
  const [f, setF] = useState({
    location: "",
    start_date: initialDates.start_date,
    end_date: initialDates.end_date,
    quantity: 1,
  });
  const startMin = reservationMinStartYmd();

  const submit = () => {
    if (!f.location.trim()) return alert("사용 장소를 입력하세요");
    const dateErr = validateReservationDates(f.start_date, f.end_date);
    if (dateErr) return alert(dateErr);
    const maxQty = item?.total_quantity || 1;
    if (f.quantity < 1 || f.quantity > maxQty) return alert(`수량은 1~${maxQty}개까지 가능합니다`);
    onSubmit({
      location: f.location.trim(),
      start_date: f.start_date,
      end_date: f.end_date,
      quantity: f.quantity,
    });
  };

  return (
    <Modal title={`교구 예약 · ${item?.name || ""}`} onClose={onClose}>
      <Inp2 label="사용 장소 *" value={f.location} onChange={e => setF(p => ({ ...p, location: e.target.value }))} placeholder="예: 은빛유치원 (성동구)"/>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 10px" }}>
        <Inp2 label="예약 시작일 *" type="date" min={startMin} value={f.start_date} onChange={e => setF(p => ({ ...p, start_date: e.target.value }))}/>
        <Inp2 label="예약 종료일 *" type="date" min={f.start_date || startMin} value={f.end_date} onChange={e => setF(p => ({ ...p, end_date: e.target.value }))}/>
      </div>
      <Fld label={`수량 * (최대 ${item?.total_quantity || 1}개)`}>
        <QuantityInput
          value={f.quantity}
          min={1}
          max={item?.total_quantity || 1}
          onChange={quantity => setF(p => ({ ...p, quantity }))}
        />
      </Fld>
      <div style={{ fontSize: 12, color: DS.textMuted, marginBottom: 14, lineHeight: 1.6 }}>
        예약 시작일은 오늘 기준 최소 {RESERVATION_MIN_DAYS_AHEAD}일 후부터 선택할 수 있습니다. 예약 기간은 최대 4주(28일)까지 가능하며, 관리자 승인 후 해당 날짜에 대여가 확정됩니다.
      </div>
      <Btn full onClick={submit}>예약 신청</Btn>
    </Modal>
  );
}

function ExtensionPromptModal({ candidates, maxExtensions, onConfirm, onSkip, onClose }) {
  const selectable = candidates.filter(c => c.extCount < maxExtensions);
  const [selected, setSelected] = useState(() => new Set(selectable.map(c => c.ri.id)));
  const [weeks, setWeeks] = useState(1);
  const [busy, setBusy] = useState(false);

  const toggle = (id) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const handleConfirm = async () => {
    if (!selected.size) { await handleSkip(); return; }
    setBusy(true);
    try { await onConfirm([...selected], weeks); }
    finally { setBusy(false); }
  };

  const handleSkip = async () => {
    setBusy(true);
    try { await onSkip(); }
    finally { setBusy(false); }
  };

  return (
    <Modal title="반납하지 않은 교구가 있어요" onClose={busy ? undefined : onClose} dismissible={!busy}>
      <div style={{ padding: "0 20px 20px" }}>
        <p style={{ fontSize: 14, color: DS.textSecondary, lineHeight: 1.5, margin: "0 0 14px" }}>
          아직 반납하지 않은 교구 중 반납 기한이 임박했거나 지난 교구가 있어요.
          새 교구를 신청하기 전에 연장하시겠어요?
        </p>
        <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
          {candidates.map(c => {
            const dd = ddayTag(c.due_date);
            const atMax = c.extCount >= maxExtensions;
            const checked = selected.has(c.ri.id);
            return (
              <label key={c.ri.id} style={{
                display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px",
                border: `1px solid ${checked ? DS.primary : DS.inputBorder}`, borderRadius: 10,
                background: atMax ? "#f8fafc" : "#fff",
                opacity: atMax ? 0.6 : 1, cursor: atMax ? "not-allowed" : "pointer",
              }}>
                <input
                  type="checkbox"
                  style={{ marginTop: 3 }}
                  disabled={atMax || busy}
                  checked={checked}
                  onChange={() => toggle(c.ri.id)}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: DS.textPrimary }}>
                    {c.itemName} <span style={{ fontWeight: 500, color: DS.textSecondary }}>×{c.held}</span>
                  </div>
                  <div style={{ fontSize: 12, color: DS.textSecondary, marginTop: 2 }}>
                    {c.location} · 반납예정 {c.due_date || "-"}
                    {dd ? " · " : ""}
                    {dd && <span style={{ color: dd.color, fontWeight: 700 }}>{dd.text}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: atMax ? "#dc2626" : DS.textMuted, marginTop: 2 }}>
                    연장 {c.extCount}/{maxExtensions}{atMax ? " · 한도 도달" : ""}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: DS.textSecondary, marginBottom: 8 }}>연장 기간</div>
          <div style={{ display: "flex", gap: 8 }}>
            {EXTENSION_PERIOD_OPTIONS.map(opt => (
              <button
                key={opt.weeks}
                type="button"
                onClick={() => setWeeks(opt.weeks)}
                disabled={busy}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 10, fontSize: 14, fontWeight: 700,
                  cursor: busy ? "default" : "pointer",
                  border: `1px solid ${weeks === opt.weeks ? DS.primary : DS.inputBorder}`,
                  background: weeks === opt.weeks ? DS.primary : "#fff",
                  color: weeks === opt.weeks ? "#fff" : DS.textPrimary,
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          <Btn full onClick={handleConfirm} disabled={busy}>
            {busy ? "처리 중..." : `연장 + 새 교구 신청${selected.size ? ` (${selected.size}개 연장)` : ""}`}
          </Btn>
          <Btn full ghost onClick={handleSkip} disabled={busy}>
            연장 없이 새 교구만 신청
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

function CartModal({cart,setCart,items,ris,rets,onSubmit,onClose}) {
  const initialDates = useMemo(() => defaultRentalDates(), []);
  const[f,setF]=useState(()=>({
    dispatch_location:"",
    dispatch_start: initialDates.dispatch_start,
    dispatch_end: initialDates.dispatch_end,
    memo:"",
  }));
  const[details,setDetails]=useState(()=>cart.map(c=>({
    ...c,
    quantity: c.quantity || 1,
    due_date: c.due_date || initialDates.dispatch_end,
    due_date_custom: false,
  })));

  useEffect(() => {
    setDetails(prev => cart.map(c => {
      const existing = prev.find(p => p.item_id === c.item_id);
      return {
        ...c,
        quantity: existing?.quantity ?? c.quantity ?? 1,
        due_date: existing?.due_date || c.due_date || f.dispatch_end,
        due_date_custom: existing?.due_date_custom ?? false,
      };
    }));
  }, [cart, f.dispatch_end]);

  const setD=(id,k,v)=>{
    if (k === "due_date") {
      setDetails(p=>p.map(c=>c.item_id===id?{...c,due_date:v,due_date_custom:true}:c));
      return;
    }
    if (k === "quantity") {
      setDetails(p => p.map(c => c.item_id === id ? { ...c, quantity: v } : c));
      return;
    }
    setDetails(p=>p.map(c=>c.item_id===id?{...c,[k]:v}:c));
  };
  const handleEndDateChange=(value)=>{
    setF(p=>({...p,dispatch_end:value}));
    setDetails(p=>p.map(c=>c.due_date_custom?c:{...c,due_date:value}));
  };
  const remove=(id)=>{setCart(p=>p.filter(c=>c.item_id!==id));setDetails(p=>p.filter(c=>c.item_id!==id));};
  const submit=()=>{
    if(!f.dispatch_location.trim())return alert("사용 장소를 입력하세요");
    if(!f.dispatch_start||!f.dispatch_end)return alert("대여 기간을 입력하세요");
    if(!details.length)return alert("교구를 담아주세요");
    const dateErr = validateCartRentalDates(f.dispatch_start, f.dispatch_end, details);
    if (dateErr) return alert(dateErr);
    for(const c of details){const item=items.find(i=>i.id===c.item_id);const av=item?availQty(item,ris,rets):0;if(c.quantity<1||c.quantity>av)return alert(`${item?.name} 수량 오류 (가능: ${av}개)`);}
    onSubmit({...f,items:details.map(({ due_date_custom, ...c }) => c)});onClose();
  };
  return(
    <Modal title={`대여 신청 (${details.length}종)`} onClose={onClose}>
      <Inp2 label="사용 장소 *" value={f.dispatch_location} onChange={e=>setF(p=>({...p,dispatch_location:e.target.value}))} placeholder="예: 은빛유치원 (성동구)"/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 10px"}}>
        <Inp2 label="대여 시작일 *" type="date" value={f.dispatch_start} onChange={e=>setF(p=>({...p,dispatch_start:e.target.value}))}/>
        <Inp2 label="대여 종료일 *" type="date" value={f.dispatch_end} onChange={e=>handleEndDateChange(e.target.value)}/>
      </div>
      <Txa2 label="메모" value={f.memo} onChange={e=>setF(p=>({...p,memo:e.target.value}))}/>
      <div style={{borderTop:`1px solid ${DS.inputBorder}`,paddingTop:14,marginBottom:14}}>
        <div style={{fontWeight:800,fontSize:13,color:DS.textPrimary,marginBottom:10}}>신청 교구 ({details.length}종)</div>
        {!details.length&&<Empty text="교구를 담아주세요"/>}
        {details.map(c=>{const item=items.find(i=>i.id===c.item_id);const av=item?availQty(item,ris,rets):0;return(
          <div key={c.item_id} style={{...card,padding:"13px",marginBottom:9}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:9}}>
              <div style={{display:"flex",alignItems:"center",gap:9}}>
                {item?.photo_url
                  ? (
                    <div style={{ width: 40, height: 40, borderRadius: 10, overflow: "hidden", flexShrink: 0 }}>
                      <GearItemImg item={item} style={{ width: 40, height: 40, borderRadius: 10 }}/>
                    </div>
                  )
                  :<div style={{width:40,height:40,borderRadius:8,background:"#f8fafc",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:DS.textMuted,border:"1px solid #e2e8f0"}}>{item?.code?.slice(0,3)||"—"}</div>
                }
                <div>
                  <span style={{fontWeight:800,fontSize:13,color:DS.textPrimary}}>{item?.name}</span>
                  <div style={{fontSize:10,color:DS.textMuted,marginTop:1}}>{item?.code}</div>
                </div>
              </div>
              <button onClick={()=>remove(c.item_id)} style={{background:"#fee2e2",border:"none",color:"#dc2626",cursor:"pointer",fontSize:12,borderRadius:8,padding:"4px 10px",fontWeight:600,fontFamily:"inherit"}}>삭제</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 9px"}}>
              <div>
                <label style={lbl}>수량 (최대 {av})</label>
                <QuantityInput
                  value={c.quantity}
                  min={1}
                  max={av}
                  onChange={quantity => setD(c.item_id, "quantity", quantity)}
                />
              </div>
              <div>
                <label style={lbl}>반납 예정일</label>
                <input type="date" value={c.due_date} onChange={e=>setD(c.item_id,"due_date",e.target.value)} style={{...inp,padding:"9px 11px",fontSize:14}}/>
              </div>
            </div>
          </div>
        );})}
      </div>
      <Btn full onClick={submit}>대여 신청하기</Btn>
    </Modal>
  );
}

function EditRentalRequestModal({ req, reqRIs, items, ris, rets, onSubmit, onClose }) {
  const endDefault = toDateInputValue(req.dispatch_end);
  const [f, setF] = useState({
    dispatch_location: req.dispatch_location || "",
    dispatch_start: toDateInputValue(req.dispatch_start),
    dispatch_end: endDefault,
    memo: req.memo || "",
  });
  const [details, setDetails] = useState(() => reqRIs.map(ri => {
    const due = toDateInputValue(ri.due_date);
    return {
      rental_item_id: ri.id,
      item_id: ri.item_id,
      quantity: ri.quantity,
      due_date: due || endDefault,
      due_date_custom: !!(due && endDefault && due !== endDefault),
      originalQty: ri.quantity,
    };
  }));
  const [saving, setSaving] = useState(false);

  const setD = (rentalItemId, k, v) => {
    if (k === "due_date") {
      setDetails(p => p.map(c => c.rental_item_id === rentalItemId ? { ...c, due_date: v, due_date_custom: true } : c));
      return;
    }
    setDetails(p => p.map(c => c.rental_item_id === rentalItemId ? { ...c, [k]: v } : c));
  };
  const handleEndDateChange = (value) => {
    setF(p => ({ ...p, dispatch_end: value }));
    setDetails(p => p.map(c => c.due_date_custom ? c : { ...c, due_date: value }));
  };

  const submit = async () => {
    if (!f.dispatch_location.trim()) return alert("사용 장소를 입력하세요");
    if (!f.dispatch_start || !f.dispatch_end) return alert("대여 기간을 입력하세요");
    const dateErr = validateCartRentalDates(f.dispatch_start, f.dispatch_end, details);
    if (dateErr) return alert(dateErr);
    for (const c of details) {
      const item = items.find(i => i.id === c.item_id);
      const av = item ? availQtyForRentalEdit(item, ris, rets, c.originalQty) : 0;
      if (c.quantity < 1 || c.quantity > av) return alert(`${item?.name || "교구"} 수량 오류 (가능: ${av}개)`);
    }
    setSaving(true);
    try {
      const ok = await onSubmit({
        dispatch_location: f.dispatch_location.trim(),
        dispatch_start: f.dispatch_start,
        dispatch_end: f.dispatch_end,
        memo: f.memo,
        items: details.map(({ rental_item_id, item_id, quantity, due_date }) => ({
          rental_item_id,
          item_id,
          quantity,
          due_date: due_date || f.dispatch_end,
        })),
      });
      if (!ok) return;
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="대여 신청 수정" onClose={onClose}>
      <Inp2 label="사용 장소 *" value={f.dispatch_location} onChange={e => setF(p => ({ ...p, dispatch_location: e.target.value }))}/>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 10px" }}>
        <Inp2 label="대여 시작일 *" type="date" value={f.dispatch_start} onChange={e => setF(p => ({ ...p, dispatch_start: e.target.value }))}/>
        <Inp2 label="대여 종료일 *" type="date" value={f.dispatch_end} onChange={e => handleEndDateChange(e.target.value)}/>
      </div>
      <Txa2 label="메모" value={f.memo} onChange={e => setF(p => ({ ...p, memo: e.target.value }))}/>
      <div style={{ borderTop: `1px solid ${DS.inputBorder}`, paddingTop: 14, marginBottom: 14 }}>
        <div style={{ fontWeight: 800, fontSize: 13, color: DS.textPrimary, marginBottom: 10 }}>신청 교구 ({details.length}종)</div>
        {details.map(c => {
          const item = items.find(i => i.id === c.item_id);
          const av = item ? availQtyForRentalEdit(item, ris, rets, c.originalQty) : 0;
          return (
            <div key={c.rental_item_id} style={{ ...card, padding: "13px", marginBottom: 9 }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: DS.textPrimary, marginBottom: 9 }}>{item?.name || "-"}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 9px" }}>
                <div>
                  <label style={lbl}>수량 (최대 {av})</label>
                  <QuantityInput
                    value={c.quantity}
                    min={1}
                    max={av}
                    onChange={quantity => setD(c.rental_item_id, "quantity", quantity)}
                  />
                </div>
                <div>
                  <label style={lbl}>반납 예정일</label>
                  <input type="date" value={c.due_date} onChange={e => setD(c.rental_item_id, "due_date", e.target.value)} style={{ ...inp, padding: "9px 11px", fontSize: 14 }}/>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <Btn full onClick={submit} disabled={saving}>{saving ? "저장 중..." : "수정 저장"}</Btn>
    </Modal>
  );
}

function ItemReturnModal({ groups: groupsProp, group, onSubmit, onClose }) {
  const initialGroups = useMemo(() => {
    const list = groupsProp?.length ? groupsProp : (group ? [group] : []);
    return list.map(g => ({
      item_id: g.item_id,
      item: g.item,
      lines: g.lines,
      totalReturnable: g.totalReturnable,
      totalHeld: g.totalHeld,
      quantity: g.totalReturnable || 1,
      location: "",
      idea: "",
      condition: "normal",
      memo: "",
    }));
  }, [groupsProp, group]);

  const [rows, setRows] = useState(initialGroups);
  const [step, setStep] = useState("location"); // location | photo
  const [bulkLocation, setBulkLocation] = useState(BRANCHES[0] || "");
  const [selectedIds, setSelectedIds] = useState(() => new Set(initialGroups.map(g => g.item_id)));
  const [photoByLocation, setPhotoByLocation] = useState({}); // loc -> { file, preview, skipped }
  const [photoLocIndex, setPhotoLocIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    setRows(initialGroups);
    setSelectedIds(new Set(initialGroups.map(g => g.item_id)));
    setStep("location");
    setPhotoByLocation({});
    setPhotoLocIndex(0);
  }, [initialGroups]);

  const locationGroups = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const loc = String(r.location || "").trim();
      if (!loc) continue;
      if (!map.has(loc)) map.set(loc, []);
      map.get(loc).push(r);
    }
    return [...map.entries()].map(([location, items]) => ({ location, items }));
  }, [rows]);

  const updateRow = (itemId, patch) => {
    setRows(prev => prev.map(r => (r.item_id === itemId ? { ...r, ...patch } : r)));
  };

  const toggleSelect = (itemId) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const applyBulkLocation = () => {
    if (!bulkLocation) return alert("위치를 선택하세요");
    setRows(prev => prev.map(r => (
      selectedIds.has(r.item_id) ? { ...r, location: bulkLocation } : r
    )));
  };

  const goPhotoStep = () => {
    for (const r of rows) {
      const q = parseInt(r.quantity, 10) || 0;
      if (q < 1 || q > r.totalReturnable) {
        return alert(`${r.item?.name || "교구"}: 수량을 1~${r.totalReturnable}개로 입력하세요`);
      }
      if (!String(r.location || "").trim()) {
        return alert("모든 교구의 반납 위치를 선택해 주세요");
      }
    }
    const locs = locationGroups.map(g => g.location);
    setPhotoByLocation(prev => {
      const next = { ...prev };
      for (const loc of locs) {
        if (!next[loc]) next[loc] = { file: null, preview: null, skipped: false };
      }
      return next;
    });
    setPhotoLocIndex(0);
    setStep("photo");
  };

  const currentLocGroup = locationGroups[photoLocIndex];
  const currentPhoto = currentLocGroup ? photoByLocation[currentLocGroup.location] : null;

  const setCurrentPhoto = (patch) => {
    if (!currentLocGroup) return;
    const loc = currentLocGroup.location;
    setPhotoByLocation(prev => ({
      ...prev,
      [loc]: { ...(prev[loc] || { file: null, preview: null, skipped: false }), ...patch },
    }));
  };

  const onPickFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("이미지 파일만 업로드할 수 있습니다");
      return;
    }
    try {
      const blob = await compressReturnPhoto(file);
      const preview = URL.createObjectURL(blob);
      setCurrentPhoto({ file: blob, preview, skipped: false });
    } catch (err) {
      alert("사진 처리 오류: " + (err.message || "알 수 없는 오류"));
    }
    e.target.value = "";
  };

  const finishCurrentLocAndMaybeNext = (skipped) => {
    if (!currentLocGroup) return;
    const loc = currentLocGroup.location;
    const state = photoByLocation[loc] || {};
    let nextPhotos = photoByLocation;
    if (skipped) {
      if (RETURN_PHOTO_REQUIRED) {
        return alert("사진이 필수입니다. 촬영하거나 업로드해 주세요.");
      }
      const patch = { skipped: true, file: null, preview: null };
      nextPhotos = { ...photoByLocation, [loc]: { ...(state), ...patch } };
      setPhotoByLocation(nextPhotos);
    } else if (!state.file && !state.skipped) {
      if (RETURN_PHOTO_REQUIRED) {
        return alert("사진을 촬영하거나 업로드해 주세요.");
      }
      return alert("사진을 업로드하거나 「사진 없이 이 위치 반납」을 눌러 주세요.");
    }

    if (photoLocIndex < locationGroups.length - 1) {
      setPhotoLocIndex(i => i + 1);
      return;
    }
    submitAll(nextPhotos);
  };

  const submitAll = async (photosMap = photoByLocation) => {
    const groupsForValidate = locationGroups.map(g => {
      const st = photosMap[g.location] || {};
      return {
        location: g.location,
        photoFile: st.file || null,
        skippedPhoto: Boolean(st.skipped) && !st.file,
      };
    });
    const err = validateReturnLocationGroups(groupsForValidate);
    if (err) return alert(err);

    setSaving(true);
    try {
      const payloads = [];
      for (const locGroup of locationGroups) {
        const st = photosMap[locGroup.location] || {};
        const sharedBlob = st.file || null;
        for (const row of locGroup.items) {
          let photoUrl = null;
          if (sharedBlob) {
            photoUrl = await uploadReturnPhoto(supabase, row.item_id, sharedBlob);
          }
          payloads.push({
            itemId: row.item_id,
            quantity: parseInt(row.quantity, 10) || 0,
            condition: row.condition || "normal",
            memo: row.memo || "",
            idea: row.idea || "",
            lines: row.lines,
            return_location: locGroup.location,
            return_photo_url: photoUrl,
          });
        }
      }
      await onSubmit(payloads);
    } catch (e) {
      alert("반납 처리 오류: " + (e.message || "알 수 없는 오류"));
    }
    setSaving(false);
  };

  if (!rows.length) return null;

  return (
    <Modal title={rows.length > 1 ? `반납 신청 (${rows.length}종)` : `반납 신청 — ${rows[0].item?.name || ""}`} onClose={onClose}>
      {step === "location" ? (
        <>
          <div style={{
            background: RETURN_THEME.light, border: `1px solid ${RETURN_THEME.border}`,
            borderRadius: 10, padding: "10px 13px", marginBottom: 14, fontSize: 12, color: RETURN_THEME.text, lineHeight: 1.55,
          }}>
            반납 위치는 필수입니다. 같은 위치로 가는 교구는 묶어서 사진 1장으로 처리할 수 있습니다.
            {RETURN_PHOTO_REQUIRED
              ? " 사진은 필수입니다."
              : " 사진은 권장이며, 다음 단계에서 건너뛸 수 있습니다."}
          </div>

          {rows.length > 1 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14, alignItems: "flex-end" }}>
              <div style={{ flex: 1, minWidth: 140 }}>
                <Sel2 label="선택한 항목에 위치 일괄 적용" value={bulkLocation} onChange={e => setBulkLocation(e.target.value)}>
                  {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                </Sel2>
              </div>
              <Btn sm color={RETURN_THEME.primary} onClick={applyBulkLocation} style={{ marginBottom: 14 }}>일괄 적용</Btn>
            </div>
          )}

          {rows.map(r => (
            <div key={r.item_id} style={{
              border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, marginBottom: 10, background: "#fff",
            }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                {rows.length > 1 && (
                  <input
                    type="checkbox"
                    checked={selectedIds.has(r.item_id)}
                    onChange={() => toggleSelect(r.item_id)}
                    style={{ marginTop: 4 }}
                    aria-label="일괄 위치 적용 대상"
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{r.item?.name || "-"}</div>
                  <div style={{ fontSize: 11, color: DS.textMuted, marginTop: 2 }}>
                    반납 가능 {r.totalReturnable}개 · 대여 중 {r.totalHeld}개
                  </div>
                  <Fld label={`반납 수량 (최대 ${r.totalReturnable})`}>
                    <QuantityInput
                      value={r.quantity}
                      min={1}
                      max={r.totalReturnable}
                      onChange={quantity => updateRow(r.item_id, { quantity })}
                    />
                  </Fld>
                  <Sel2
                    label="반납 위치 *"
                    value={r.location}
                    onChange={e => updateRow(r.item_id, { location: e.target.value })}
                  >
                    <option value="">위치 선택</option>
                    {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                  </Sel2>
                  {rows.length === 1 && (
                    <>
                      <Sel2 label="반납 상태" value={r.condition} onChange={e => updateRow(r.item_id, { condition: e.target.value })}>
                        <option value="normal">정상</option>
                        <option value="damaged">파손</option>
                        <option value="lost">분실</option>
                        <option value="shortage">수량부족</option>
                      </Sel2>
                      <Txa2 label="메모" value={r.memo} onChange={e => updateRow(r.item_id, { memo: e.target.value })}/>
                      <Txa2
                        label="이 교구로 했던 활동 아이디어가 있다면 공유해주세요 (선택)"
                        value={r.idea}
                        onChange={e => updateRow(r.item_id, { idea: e.target.value })}
                        placeholder="수업에서 활용한 게임·활동 방법을 다른 선생님과 나눠 주세요"
                      />
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}

          <Btn full color={RETURN_THEME.primary} onClick={goPhotoStep}>
            다음 · 사진 {RETURN_PHOTO_REQUIRED ? "(필수)" : "(권장)"}
          </Btn>
        </>
      ) : (
        <>
          <div style={{ fontSize: 12, color: DS.textSecondary, marginBottom: 10 }}>
            위치 그룹 {photoLocIndex + 1} / {locationGroups.length}
          </div>
          {currentLocGroup && (
            <>
              <div style={{
                background: RETURN_THEME.light, borderRadius: 10, padding: "10px 12px", marginBottom: 12,
                fontSize: 13, fontWeight: 700, color: RETURN_THEME.text,
              }}>
                위치: {currentLocGroup.location}
                <div style={{ fontWeight: 500, fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>
                  {currentLocGroup.items.map(it => it.item?.name).filter(Boolean).join(" · ")}
                </div>
              </div>

              <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={onPickFile}/>

              {currentPhoto?.preview ? (
                <div style={{ marginBottom: 12 }}>
                  <img src={currentPhoto.preview} alt="반납 사진 미리보기" style={{ width: "100%", maxHeight: 240, objectFit: "cover", borderRadius: 12, border: "1px solid #e2e8f0" }}/>
                  <Btn sm ghost onClick={() => fileRef.current?.click()} style={{ marginTop: 8 }}>사진 다시 선택</Btn>
                </div>
              ) : (
                <div
                  onClick={() => fileRef.current?.click()}
                  style={{
                    width: "100%", height: 160, borderRadius: 14, border: `2px dashed ${DS.inputBorder}`,
                    background: "#fafafa", display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center", cursor: "pointer", marginBottom: 12,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: DS.textSecondary }}>사진 촬영 / 업로드</div>
                  <div style={{ fontSize: 11, color: DS.textMuted, marginTop: 4 }}>자동 압축 · JPEG</div>
                </div>
              )}

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Btn ghost onClick={() => setStep("location")} disabled={saving}>이전</Btn>
                {!RETURN_PHOTO_REQUIRED && (
                  <Btn ghost onClick={() => finishCurrentLocAndMaybeNext(true)} disabled={saving}>
                    사진 없이 이 위치 반납
                  </Btn>
                )}
                <Btn
                  color={RETURN_THEME.primary}
                  onClick={() => finishCurrentLocAndMaybeNext(false)}
                  disabled={saving}
                  style={{ flex: 1 }}
                >
                  {saving
                    ? "처리 중..."
                    : (photoLocIndex < locationGroups.length - 1
                      ? "다음 위치"
                      : (RETURN_PHOTO_REQUIRED || currentPhoto?.file ? "반납 완료" : "사진 확인 후 완료"))}
                </Btn>
              </div>
            </>
          )}
        </>
      )}
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// APP ROOT — 리디자인
// ═══════════════════════════════════════════════════════════════════════
const HUB_APP_ROUTES = {
  edu: "/gear",
  pe: "/pe-resources",
  payroll: "/schedule?view=payroll",
  schedule: "/schedule",
};

function goBackOr(navigate, fallback) {
  if (window.history.length > 1) navigate(-1);
  else navigate(fallback);
}

function RouteTracker() {
  const location = useLocation();
  useEffect(() => {
    saveLastRoute(`${location.pathname}${location.search}${location.hash}`);
  }, [location]);
  return null;
}

function RestoreRouteAfterLogin() {
  const navigate = useNavigate();
  const restored = useRef(false);

  useEffect(() => {
    if (restored.current || !consumeRestoreAfterLogin()) return;
    const saved = getLastRoute();
    if (!saved) return;
    const current = `${window.location.pathname}${window.location.search}`;
    if (saved !== current) {
      restored.current = true;
      navigate(saved, { replace: true });
    }
  }, [navigate]);

  return null;
}

function UnknownRoute() {
  const navigate = useNavigate();
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 16,
      fontFamily: "'Noto Sans KR', sans-serif",
      background: "#f0f3f7",
      color: "#172033",
    }}>
      <p style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>페이지를 찾을 수 없습니다.</p>
      <button
        type="button"
        onClick={() => navigate("/")}
        style={{
          padding: "10px 18px",
          borderRadius: 8,
          border: "none",
          background: "#059669",
          color: "#fff",
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        홈으로
      </button>
    </div>
  );
}

function AuthenticatedRoutes({ me, session, logout }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!me?.id || !session?.user?.id) return;
    if (!peekGearScan()) return;
    if (window.location.pathname.startsWith("/gear")) return;
    navigate("/gear");
  }, [me?.id, session?.user?.id, navigate]);

  return (
    <>
      <PushNotificationPrompt supabase={supabase} teacherId={me?.id}/>
      <RouteTracker/>
      <RestoreRouteAfterLogin/>
      <Routes>
      <Route
        path="/english-script"
        element={(
          <EnglishScriptApp
            me={me}
            onBack={() => goBackOr(navigate, "/pe-resources")}
            onGoMain={() => navigate("/")}
            onGoSituations={() => navigate("/situation-manual")}
            onGoChildTypes={() => navigate("/child-types")}
            onGoFlowTips={() => navigate("/class-flow-tips")}
            onGoPronunciationTips={() => navigate("/pronunciation-tips")}
          />
        )}
      />
      <Route
        path="/english-script/register"
        element={(
          <GearScriptRegisterApp
            me={me}
            onBack={() => goBackOr(navigate, "/english-script")}
            onGoMain={() => navigate("/")}
          />
        )}
      />
      <Route path="/video-resources" element={<Navigate to="/pe-resources?category=videos" replace/>}/>
      <Route
        path="/child-types"
        element={<ChildTypeApp onBack={() => goBackOr(navigate, "/english-script")} onGoMain={() => navigate("/")}/>}
      />
      <Route
        path="/situation-manual"
        element={<SituationManualApp onBack={() => goBackOr(navigate, "/english-script")} onGoMain={() => navigate("/")}/>}
      />
      <Route
        path="/class-flow-tips"
        element={<ClassFlowTipsApp onBack={() => goBackOr(navigate, "/english-script")} onGoMain={() => navigate("/")}/>}
      />
      <Route
        path="/lesson-script-builder"
        element={<LessonScriptBuilderApp me={me} onBack={() => goBackOr(navigate, "/english-script")} onGoMain={() => navigate("/")}/>}
      />
      <Route
        path="/admin/lesson-script-data"
        element={(
          <LessonScriptDataAdminPage
            me={me}
            onBack={() => goBackOr(navigate, "/lesson-script-builder")}
          />
        )}
      />
      <Route
        path="/pronunciation-tips"
        element={<PronunciationTipsApp onBack={() => goBackOr(navigate, "/english-script")} onGoMain={() => navigate("/")}/>}
      />
      <Route
        path="/gear"
        element={<EquipmentApp onBack={() => navigate("/")} me={me} session={session}/>}
      />
      <Route
        path="/admin/data-export"
        element={(
          <DataExportPage
            me={me}
            onBack={() => navigate("/gear?page=settings")}
          />
        )}
      />
      <Route
        path="/pe-resources"
        element={(
          <PeResourcesApp
            me={me}
            onBack={() => navigate(isGearTeacher(me) ? "/gear" : "/")}
            onGoMain={() => navigate("/")}
            onNavigate={path => navigate(path)}
          />
        )}
      />
      <Route
        path="/schedule"
        element={(
          <ScheduleApp
            me={me}
            session={session}
            onBack={() => navigate("/")}
          />
        )}
      />
      <Route
        path="/growth"
        element={<GrowthApp onBack={() => navigate("/")} supabaseUser={me}/>}
      />
      <Route
        path="/"
        element={(
          <HubPage
            me={me}
            onLogout={logout}
            onSelect={id => {
              if (id === "schedule") {
                navigate("/schedule?view=institution-schedule");
                return;
              }
              const path = HUB_APP_ROUTES[id];
              if (path) navigate(path);
            }}
          />
        )}
      />
      <Route path="*" element={<UnknownRoute/>}/>
      </Routes>
    </>
  );
}

export default function App() {
  const [session,    setSession]    = useState(null);
  const [authReady,  setAuthReady]  = useState(false);
  const [me,         setMe]         = useState(null);
  const [meLoading,  setMeLoading]  = useState(false);

  useEffect(() => {
    const scan = parseGearScanFromLocation();
    if (scan) {
      saveGearScan(scan);
      clearGearScanUrl();
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthReady(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (event === "SIGNED_OUT" || !session) {
        setMe(null);
        markRestoreAfterLogin();
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user?.id) {
      setMe(null);
      return;
    }
    const userId = session.user.id;
    if (me?.id === userId) return;

    setMeLoading(true);
    let cancelled = false;
    supabase.from("teachers").select("*").eq("id", userId).single()
      .then(({ data: meData }) => {
        if (cancelled) return;
        if (meData) {
          const block = getTeacherAccessBlock(meData);
          if (block.blocked) {
            supabase.auth.signOut();
            alert(block.message);
            return;
          }
        }
        setMe(meData ? { ...meData, email: meData.email || session.user.email || "" } : null);
        if (meData?.id && session.user.email && !String(meData.email || "").trim()) {
          supabase.from("teachers").update({ email: session.user.email }).eq("id", meData.id);
        }
      })
      .catch(e => console.error(e))
      .finally(() => {
        if (!cancelled) setMeLoading(false);
      });

    return () => { cancelled = true; };
  }, [session?.user?.id, me?.id]);

  const logout = async () => {
    if (!confirm("로그아웃 하시겠습니까?")) return;
    await supabase.auth.signOut();
  };

  if (!authReady) return (
    <div style={{ minHeight: "100vh", background: "#0d1f12", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Spinner/>
    </div>
  );
  if (!session) return <LoginPage/>;
  if (!me && meLoading) return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg,#0D1829 0%,#1C2951 50%,#0D1829 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Noto Sans KR',sans-serif" }}>
      <Spinner text="로그인 확인 중..."/>
    </div>
  );
  if (!me) return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg,#0D1829 0%,#1C2951 50%,#0D1829 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Noto Sans KR',sans-serif" }}>
      <Spinner text="로그인 확인 중..."/>
    </div>
  );

  if (shouldForcePasswordChange(session)) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(160deg,#0D1829 0%,#1C2951 50%,#0D1829 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        fontFamily: "'Noto Sans KR',sans-serif",
      }}>
        <div style={{ width: "100%", maxWidth: 560 }}>
          <ChangePwModal email={session.user.email} required/>
        </div>
      </div>
    );
  }

  return <AuthenticatedRoutes me={me} session={session} logout={logout}/>;
}

// ═══════════════════════════════════════════════════════════════════════
// 홈 허브 — GTS 통합 플랫폼
// ═══════════════════════════════════════════════════════════════════════
function HubIconCube({ color }) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" aria-hidden>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
      <line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  );
}

function HubIconUser({ color }) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" aria-hidden>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  );
}

function HubIconCalendar({ color }) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
}

function HubIconBook({ color }) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" aria-hidden>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  );
}

function HubIconGraduation({ color }) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" aria-hidden>
      <path d="M22 10v6"/>
      <path d="M2 10l10-5 10 5-10 5z"/>
      <path d="M6 12v5c0 2 4 3 6 3s6-1 6-3v-5"/>
    </svg>
  );
}

function HubIconPayroll({ color }) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" aria-hidden>
      <circle cx="12" cy="12" r="9"/>
      <path d="M12 7v10"/>
      <path d="M9.5 9.5h3a2 2 0 1 1 0 4h-3"/>
      <path d="M12 15.5v1"/>
    </svg>
  );
}

function HubIconVideo({ color }) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" aria-hidden>
      <rect x="2" y="5" width="15" height="14" rx="2"/>
      <path d="M17 9l5-3v12l-5-3"/>
    </svg>
  );
}

const HUB_THEMES = {
  green: {
    color: "#16a34a",
    colorDark: "#15803d",
    iconBg: "#ecfdf5",
    iconBorder: "#bbf7d0",
    cardBg: "#f6fcf8",
    cardBorder: "rgba(22, 163, 74, 0.1)",
    btnVariant: "solid",
  },
  blue: {
    color: "#2563eb",
    colorDark: "#1d4ed8",
    iconBg: "#eff6ff",
    iconBorder: "#bfdbfe",
    cardBg: "#f7f9fe",
    cardBorder: "rgba(37, 99, 235, 0.1)",
    btnVariant: "solid",
  },
  teal: {
    color: "#0d9488",
    colorDark: "#0f766e",
    iconBg: "#f0fdfa",
    iconBorder: "#99f6e4",
    cardBg: "#f5fbfa",
    cardBorder: "rgba(13, 148, 136, 0.1)",
    btnVariant: "outline",
  },
  amber: {
    color: "#f59e0b",
    colorDark: "#d97706",
    iconBg: "#fffbeb",
    iconBorder: "#fde68a",
    cardBg: "#fffdf5",
    cardBorder: "rgba(245, 158, 11, 0.12)",
    btnVariant: "solid",
  },
  purple: {
    color: "#8b5cf6",
    colorDark: "#7c3aed",
    iconBg: "#f5f3ff",
    iconBorder: "#ddd6fe",
    cardBg: "#faf8ff",
    cardBorder: "rgba(139, 92, 246, 0.12)",
    btnVariant: "solid",
  },
};

const HUB_MODULES = [
  {
    id: "edu",
    title: "교구 시스템",
    desc: "교구 대여부터 반납, 재고 관리까지 체계적으로 관리하세요.",
    theme: "green",
    features: ["교구 대여 신청", "반납 관리", "재고 현황", "파손·수리 관리"],
    Icon: HubIconCube,
    btnLabel: "시스템 바로가기 →",
    mobileStatus: "대여 · 반납 · 재고",
    ready: true,
    appRoute: "edu",
  },
  {
    id: "pe",
    title: "교육",
    desc: "수업 준비에 필요한 자료를 한곳에서 확인하세요.",
    theme: "blue",
    features: ["영상 자료", "음원 자료", "영어 대본"],
    Icon: HubIconGraduation,
    btnLabel: "자료실 바로가기 →",
    mobileStatus: "영상 · 음원 · 영어대본",
    ready: true,
    appRoute: "pe",
  },
  {
    id: "payroll",
    title: "급여",
    desc: "급여 내역과 명세서를 확인하세요.",
    theme: "amber",
    features: ["월별 급여", "수업 시간", "정산 내역"],
    Icon: HubIconPayroll,
    btnLabel: "시스템 바로가기 →",
    mobileStatus: "급여 내역 · 명세서",
    ready: true,
    appRoute: "payroll",
  },
  {
    id: "schedule",
    title: "스케줄",
    desc: "월별 수업 일정을 한눈에 관리하세요.",
    theme: "purple",
    mobileTheme: "teal",
    features: ["월별 일정", "주간 시간표", "수업 일정"],
    Icon: HubIconCalendar,
    btnLabel: "시스템 바로가기 →",
    mobileStatus: "월별 · 주간 일정",
    ready: true,
    appRoute: "schedule",
  },
];

function hubModuleTheme(mod, mobile = false) {
  const key = mobile && mod.mobileTheme ? mod.mobileTheme : mod.theme;
  return HUB_THEMES[key] || HUB_THEMES.blue;
}

function HubModuleCardMobile({ mod, onEnter }) {
  const { Icon } = mod;
  const theme = hubModuleTheme(mod, true);
  const enter = () => onEnter(mod);
  return (
    <button
      type="button"
      className="hub-card-compact"
      onClick={enter}
      style={{
        "--hub-accent": theme.color,
        "--hub-icon-bg": theme.iconBg,
        "--hub-icon-border": theme.iconBorder,
        "--hub-card-bg": theme.cardBg,
        "--hub-card-border": theme.cardBorder,
      }}
    >
      <ChevronRight size={18} strokeWidth={2.25} className="hub-card-compact__chev" aria-hidden/>
      <div className="hub-card-compact__icon" aria-hidden>
        <Icon color={theme.color}/>
      </div>
      <div className="hub-card-compact__title">{mod.title}</div>
      <div className="hub-card-compact__status">{mod.mobileStatus}</div>
    </button>
  );
}

function HubModuleCardLg({ mod, onEnter }) {
  const { Icon } = mod;
  const theme = hubModuleTheme(mod, false);
  const enter = () => onEnter(mod);
  return (
    <button
      type="button"
      className="hub-card-lg"
      onClick={enter}
      style={{
        "--hub-accent": theme.color,
        "--hub-icon-bg": theme.iconBg,
        "--hub-icon-border": theme.iconBorder,
        "--hub-card-bg": theme.cardBg,
        "--hub-card-border": theme.cardBorder,
      }}
    >
      <ChevronRight size={18} strokeWidth={2.25} className="hub-card-lg__chev" aria-hidden/>
      <div className="hub-card-lg__icon" aria-hidden>
        <Icon color={theme.color}/>
      </div>
      <div className="hub-card-lg__body">
        <div className="hub-card-lg__title">{mod.title}</div>
        <div className="hub-card-lg__desc">{mod.desc}</div>
        <div className="hub-card-lg__status">{mod.mobileStatus}</div>
      </div>
    </button>
  );
}

function HubModuleCard({ mod, onEnter }) {
  const { Icon } = mod;
  const theme = hubModuleTheme(mod, false);
  const btnVariant = mod.btnVariant || theme.btnVariant;
  const enter = () => onEnter(mod);
  return (
    <div
      className={`hub-card hub-card--desktop${btnVariant === "outline" ? " hub-card--outline-btn" : ""}`}
      role="button"
      tabIndex={0}
      onClick={enter}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); enter(); } }}
      style={{
        "--hub-accent": theme.color,
        "--hub-accent-dark": theme.colorDark,
        "--hub-icon-bg": theme.iconBg,
        "--hub-icon-border": theme.iconBorder,
        "--hub-card-bg": theme.cardBg,
        "--hub-card-border": theme.cardBorder,
      }}
    >
      <div className="hub-card__watermark" aria-hidden>
        <Icon color={theme.color}/>
      </div>
      <div className="hub-card__body">
        <div className="hub-card__icon-wrap">
          <Icon color={theme.color}/>
        </div>
        <div className="hub-card__title">{mod.title}</div>
        <div className="hub-card__desc">{mod.desc}</div>
        <div className="hub-card__divider" aria-hidden/>
        <div className="hub-card__features">
          {mod.features.map(t => (
            <div key={t} className="hub-card__feature">
              <span className="hub-card__feature-dot" aria-hidden/>
              {t}
            </div>
          ))}
        </div>
      </div>
      <div className="hub-card__footer">
        <button
          type="button"
          className="hub-card__btn"
          onClick={(e) => { e.stopPropagation(); enter(); }}
        >
          {mod.btnLabel || "시스템 바로가기 →"}
        </button>
      </div>
    </div>
  );
}

function HubPage({ me, onSelect, onLogout }) {
  const navigate = useNavigate();
  const [feedItems, setFeedItems] = useState([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [viewNotice, setViewNotice] = useState(null);
  const [readNoticeIds, setReadNoticeIds] = useState(() => new Set());

  const showTodo = isItemAdmin(me);
  const showUnreadStyles = isGearTeacher(me) || me?.role === "teacher";
  const [todos, setTodos] = useState([]);
  const [todoTeachers, setTodoTeachers] = useState([]);
  const [todoReqs, setTodoReqs] = useState([]);
  const [todoRIs, setTodoRIs] = useState([]);
  const [todoRets, setTodoRets] = useState([]);

  useEffect(() => {
    let cancelled = false;
    setFeedLoading(true);
    loadUnifiedNoticeFeed(fetchNotices)
      .then((items) => {
        if (!cancelled) setFeedItems(items || []);
      })
      .finally(() => {
        if (!cancelled) setFeedLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!showUnreadStyles || !me?.id) return;
    let cancelled = false;
    const noticeIds = (feedItems || [])
      .filter((i) => i.source === "notice" && i.raw?.id)
      .map((i) => i.raw.id);
    if (!noticeIds.length) {
      setReadNoticeIds(new Set());
      return;
    }
    fetchMyNoticeReadIds(supabase, me.id, noticeIds).then((mine) => {
      if (!cancelled) setReadNoticeIds(mine);
    });
    return () => { cancelled = true; };
  }, [feedItems, me?.id, showUnreadStyles]);

  const noticeUnreadCount = useMemo(() => {
    if (!showUnreadStyles) return 0;
    return (feedItems || []).filter(
      (i) => i.source === "notice" && i.raw?.id && !readNoticeIds.has(i.raw.id),
    ).length;
  }, [feedItems, readNoticeIds, showUnreadStyles]);

  const handleMarkedRead = useCallback((noticeId) => {
    if (!noticeId) return;
    setReadNoticeIds((prev) => {
      const next = new Set(prev);
      next.add(noticeId);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!showTodo) return;
    let cancelled = false;
    (async () => {
      try {
        const [todoRes, reqRes, riRes, retRes] = await Promise.all([
          supabase.from("admin_todos").select("*").order("created_at", { ascending: false }),
          supabase.from("rental_requests").select("*").order("created_at", { ascending: false }),
          supabase.from("rental_items").select("*"),
          supabase.from("return_requests").select("*").order("created_at", { ascending: false }),
        ]);
        if (cancelled) return;
        if (!todoRes.error) setTodos(todoRes.data || []);
        if (!reqRes.error) setTodoReqs(reqRes.data || []);
        if (!riRes.error) setTodoRIs(riRes.data || []);
        if (!retRes.error) setTodoRets(retRes.data || []);
        try {
          const ts = await fetchTeachers();
          if (!cancelled) setTodoTeachers(ts || []);
        } catch { /* 담당자 목록 실패는 무시 */ }
      } catch (e) {
        console.warn("허브 할 일 로드 실패", e);
      }
    })();
    return () => { cancelled = true; };
  }, [showTodo]);

  const addTodo = async ({ content, assignee_id, priority, start_date, due_date, checklist }) => {
    const row = {
      content: content.trim(),
      assignee_id: assignee_id || null,
      priority: priority === "urgent" ? "urgent" : (priority === "important" ? "important" : (priority === "low" ? "low" : "normal")),
      start_date: toKstDateOnly(start_date),
      due_date: toKstDateOnly(due_date),
      checklist: Array.isArray(checklist) ? checklist : [],
      is_completed: false,
      created_by: me.id,
      created_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from("admin_todos").insert(row).select().single();
    if (error) { alert(error.message || "할 일 추가에 실패했습니다."); return; }
    setTodos(prev => [data, ...prev]);
    void sendPushEvent(supabase, "task_assigned", {
      assignee_id: assignee_id || null,
      title: row.content,
      priority: row.priority,
    });
  };

  const toggleTodo = async (id, isCompleted) => {
    const completed_at = isCompleted ? new Date().toISOString() : null;
    setTodos(prev => prev.map(t => t.id === id ? { ...t, is_completed: isCompleted, completed_at } : t));
    const { error } = await supabase.from("admin_todos").update({ is_completed: isCompleted, completed_at }).eq("id", id);
    if (error) alert(error.message || "처리에 실패했습니다.");
  };

  const deleteTodo = async (id) => {
    setTodos(prev => prev.filter(t => t.id !== id));
    const { error } = await supabase.from("admin_todos").delete().eq("id", id);
    if (error) alert(error.message || "삭제에 실패했습니다.");
  };

  const updateTodo = async (id, patch) => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
    const { error } = await supabase.from("admin_todos").update(patch).eq("id", id);
    if (error) alert(error.message || "수정에 실패했습니다.");
  };

  const handleEnter = (mod) => {
    if (mod.ready && mod.appRoute) {
      onSelect(mod.appRoute);
      return;
    }
    alert("준비 중입니다. 곧 이용하실 수 있습니다.");
  };

  return (
    <div className="hub-page">
      <div className="hub-page__decor" aria-hidden/>

      <header className="hub-topbar">
        <div className="hub-topbar__brand">
          <GtsHexLogo size={32}/>
          <span className="hub-topbar__brand-text">GTS</span>
        </div>
        <div className="hub-topbar__actions">
          <RoleBadge role={me.role} isItemAdmin={me.is_item_admin}/>
          <button type="button" className="hub-topbar__logout" onClick={onLogout}>로그아웃</button>
        </div>
      </header>

      <main className="hub-main">
        <div className="hub-main-inner">
          <div className="hub-hero">
            <h1 className="hub-hero__title">안녕하세요, {me.name}님! 👋</h1>
            <p className="hub-hero__desc">
              {me?.role === "teacher"
                ? "오늘도 좋은 하루 보내세요."
                : "하나의 계정으로 모든 GTS 서비스를 이용할 수 있습니다."}
            </p>
          </div>

          <div className="hub-modules hub-modules--core">
            {HUB_MODULES.map(mod => (
              <div key={mod.id} className="hub-module-cell" data-module-id={mod.id}>
                <HubModuleCard mod={mod} onEnter={handleEnter}/>
                <HubModuleCardLg mod={mod} onEnter={handleEnter}/>
                <HubModuleCardMobile mod={mod} onEnter={handleEnter}/>
              </div>
            ))}
          </div>

          <div className="hub-notices-section hub-notices-section--below">
            <UnifiedNoticesFeed
              items={feedItems}
              loading={feedLoading}
              previewCount={5}
              compact
              onSelectNotice={setViewNotice}
              onViewAll={() => navigate("/gear?page=notices")}
              showUnreadStyles={showUnreadStyles}
              readNoticeIds={readNoticeIds}
              unreadCount={noticeUnreadCount}
            />
          </div>

          <div className="hub-notices-section hub-notices-section--aside">
            <UnifiedNoticesFeed
              items={feedItems}
              loading={feedLoading}
              previewCount={7}
              compact
              onSelectNotice={setViewNotice}
              onViewAll={() => navigate("/gear?page=notices")}
              showUnreadStyles={showUnreadStyles}
              readNoticeIds={readNoticeIds}
              unreadCount={noticeUnreadCount}
            />
          </div>

          {showTodo && (
            <div className="hub-todo-section">
              <AdminTodoSection
                me={me}
                teachers={todoTeachers}
                todos={todos}
                reqs={todoReqs}
                ris={todoRIs}
                rets={todoRets}
                setPage={(p) => navigate(`/gear?page=${p}`)}
                onAdd={addTodo}
                onToggle={toggleTodo}
                onDelete={deleteTodo}
                onUpdate={updateTodo}
                readOnly
              />
            </div>
          )}
        </div>
      </main>

      {viewNotice ? (
        <NoticeDetailModal
          notice={viewNotice}
          onClose={() => setViewNotice(null)}
          canManage={false}
          me={me}
          onMarkedRead={handleMarkedRead}
          onEdit={() => {
            setViewNotice(null);
            navigate("/gear?page=notices");
          }}
          onDelete={() => {}}
        />
      ) : null}

      <footer className="hub-footer">
        <div className="hub-footer__line">GTS 통합 플랫폼 · © 2025 GTS. All rights reserved.</div>
        <div className="hub-footer__links">
          <span>이용약관</span>
          <span aria-hidden>·</span>
          <span>개인정보처리방침</span>
          <span aria-hidden>·</span>
          <span>고객센터</span>
        </div>
      </footer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 교구 대여 시스템
// ═══════════════════════════════════════════════════════════════════════
function gearHomePage(me) {
  return isGearPlatformAdmin(me) ? "dashboard" : "notices";
}

function removeRowById(rows, id) {
  if (!id) return rows;
  return rows.filter(r => r.id !== id);
}

function upsertRowById(rows, row, { prepend = false } = {}) {
  if (!row?.id) return rows;
  const idx = rows.findIndex(r => r.id === row.id);
  if (idx >= 0) {
    const next = rows.slice();
    next[idx] = row;
    return next;
  }
  return prepend ? [row, ...rows] : [...rows, row];
}

function applyRealtimePayload(setter, payload, { prepend = false } = {}) {
  setter(prev => {
    if (payload.eventType === "DELETE") return removeRowById(prev, payload.old?.id);
    if (payload.new?.id) return upsertRowById(prev, payload.new, { prepend });
    return prev;
  });
}

function parseGearAppUrl(search, me) {
  const raw = search ?? (typeof window !== "undefined" ? window.location.search : "");
  const params = new URLSearchParams(raw.startsWith("?") ? raw.slice(1) : raw);
  const home = gearHomePage(me);
  let page = params.get("page") || home;
  if (page === "dashboard" && !isGearPlatformAdmin(me)) page = "notices";
  return {
    page,
    itemId: params.get("item"),
    from: params.get("from") || "items",
    noticeId: params.get("notice") || null,
  };
}

function buildGearAppUrl(page, { itemId, from, noticeId, me } = {}) {
  const home = gearHomePage(me);
  const params = new URLSearchParams();
  if (page && page !== home) params.set("page", page);
  if (page === "item-detail" && itemId) {
    params.set("item", String(itemId));
    if (from && from !== "items") params.set("from", from);
  }
  if (page === "notices" && noticeId) {
    if (!params.has("page")) params.set("page", "notices");
    params.set("notice", String(noticeId));
  }
  const qs = params.toString();
  return qs ? `/gear?${qs}` : "/gear";
}

function EquipmentApp({ onBack, me, session }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { page, itemId, from, noticeId } = useMemo(
    () => parseGearAppUrl(location.search, me),
    [location.search, me?.id, me?.role],
  );

  const [items,      setItems]      = useState([]);
  const [teachers,   setTeachers]   = useState([]);
  const [reqs,       setReqs]       = useState([]);
  const [ris,        setRIs]        = useState([]);
  const [rets,       setRets]       = useState([]);
  const [reservations,setReservations]= useState([]);
  const [notices,    setNotices]    = useState([]);
  const [adminTodos, setAdminTodos] = useState([]);
  const [dataLoading,setDataLoading]= useState(false);
  const [cart,       setCart]       = useState([]);
  const [showCart,   setShowCart]   = useState(false);
  const [extPrompt,  setExtPrompt]  = useState(null);
  const [detailItem, setDetailItem] = useState(null);
  const [detailBackPage, setDetailBackPage] = useState("items");
  const [scanRentItem,setScanRentItem]= useState(null);
  const [itemReturnGroup,setItemReturnGroup] = useState(null);
  const [itemReturnGroups,setItemReturnGroups] = useState(null);
  const [showPwModal,setShowPwModal]= useState(false);
  const [showProfile,setShowProfile]= useState(false);
  const [showMobileMore,setShowMobileMore] = useState(false);
  const [showMobileDrawer,setShowMobileDrawer] = useState(false);
  const [isPC,setIsPC] = useState(typeof window !== "undefined" && window.innerWidth >= 768);

  const setPage = useCallback((nextPage, meta = {}, { replace = false } = {}) => {
    if (nextPage === "english-script") {
      navigate("/english-script");
      return;
    }
    if (nextPage === "data-export") {
      navigate("/admin/data-export");
      return;
    }
    if (nextPage === "video-resources") {
      navigate("/pe-resources?category=videos");
      return;
    }
    if (nextPage === "pe-resources") {
      navigate("/pe-resources");
      return;
    }
    navigate(buildGearAppUrl(nextPage, { ...meta, me }), { replace });
  }, [navigate, me]);

  const clearNoticeDeepLink = useCallback(() => {
    setPage("notices", {}, { replace: true });
  }, [setPage]);

  useEffect(() => {
    if (!me?.id) return;
    const params = new URLSearchParams(location.search.startsWith("?") ? location.search.slice(1) : location.search);
    if (params.get("page") === "dashboard" && !isGearPlatformAdmin(me)) {
      setPage("notices", {}, { replace: true });
    }
  }, [me?.id, me?.role, location.search, setPage]);

  useEffect(() => {
    if (page === "item-detail" && itemId && items.length) {
      const item = items.find(i => String(i.id) === String(itemId));
      setDetailItem(item ?? null);
      setDetailBackPage(from);
    } else if (page !== "item-detail") {
      setDetailItem(null);
    }
  }, [page, itemId, from, items]);

  useEffect(()=>{
    const handle = () => setIsPC(window.innerWidth >= 768);
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);

  const loadAll = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setDataLoading(true);
    const errors = [];
    try {
      // 시작일이 된 확정 예약을 pending → rented 로 전환 (함수 미배포 시 무시)
      {
        const { error: activateErr } = await supabase.rpc("activate_due_reservations");
        if (activateErr) console.warn("activate_due_reservations:", activateErr.message);
      }

      let ts = [];
      try {
        ts = await fetchTeachers();
      } catch (e) {
        errors.push(`선생님 목록: ${e?.message || e}`);
      }

      const [itemsRes, reqsRes, riRes, retRes, resRes] = await Promise.all([
        supabase.from("items").select("*").order("code"),
        supabase.from("rental_requests").select("*").order("created_at", { ascending: false }),
        supabase.from("rental_items").select("*"),
        supabase.from("return_requests").select("*").order("created_at", { ascending: false }),
        supabase.from("reservations").select("*").order("created_at", { ascending: false }),
      ]);

      const labeled = [
        ["교구", itemsRes],
        ["대여신청", reqsRes],
        ["대여항목", riRes],
        ["반납신청", retRes],
        ["예약", resRes],
      ];
      for (const [label, res] of labeled) {
        if (res.error) errors.push(`${label}: ${res.error.message}`);
      }

      setTeachers(ts);
      if (!itemsRes.error) setItems(itemsRes.data || []);
      if (!reqsRes.error) setReqs(reqsRes.data || []);
      if (!riRes.error) setRIs(riRes.data || []);
      if (!retRes.error) setRets(retRes.data || []);
      if (!resRes.error) setReservations(resRes.data || []);

      const noticeList = await fetchNotices();
      setNotices(noticeList);

      if (isItemAdmin(me) || isGearPlatformAdmin(me)) {
        const todoRes = await supabase
          .from("admin_todos")
          .select("*")
          .order("created_at", { ascending: false });
        if (todoRes.error) {
          const code = todoRes.error.code;
          const msg = todoRes.error.message || "";
          const tableMissing = code === "42P01" || code === "PGRST205" || /schema cache|does not exist/i.test(msg);
          if (!tableMissing) errors.push(`할 일: ${msg}`);
        } else {
          setAdminTodos(todoRes.data || []);
        }
      }
    } catch (e) {
      console.error("loadAll failed", e);
      errors.push(String(e?.message || e));
    } finally {
      if (!silent) setDataLoading(false);
      if (errors.length) {
        console.error("loadAll errors:", errors);
        if (!silent) {
          alert(
            "데이터를 불러오는 중 오류가 발생했습니다.\n"
            + "새로고침 후에도 반복되면 관리자에게 문의하세요.\n\n"
            + errors.slice(0, 4).join("\n")
            + (errors.length > 4 ? `\n…외 ${errors.length - 4}건` : ""),
          );
        }
      }
    }
  }, []);

  const loadAllRef = useRef(loadAll);
  loadAllRef.current = loadAll;

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (!me?.id) return;

    const channel = supabase
      .channel(`gear-rentals-${me.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rental_requests" }, payload => {
        applyRealtimePayload(setReqs, payload, { prepend: true });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "rental_items" }, payload => {
        applyRealtimePayload(setRIs, payload);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "return_requests" }, payload => {
        applyRealtimePayload(setRets, payload, { prepend: true });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, payload => {
        applyRealtimePayload(setReservations, payload, { prepend: true });
      })
      .subscribe(status => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn("교구 Realtime 구독 실패 — 탭 전환 시 자동 새로고침으로 보완합니다.", status);
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [me?.id]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        loadAllRef.current({ silent: true });
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  useEffect(() => {
    if (dataLoading || !items.length) return;
    const scan = consumeGearScan();
    if (!scan) return;
    const item = findItemByScan(items, scan);
    if (item) {
      setScanRentItem(item);
      setPage("qr-rent");
    } else {
      alert("QR로 연결된 교구를 찾을 수 없습니다.");
    }
  }, [dataLoading, items]);

  const addNotice = async (payload) => {
    const row = {
      title: payload.title,
      body: payload.body || "",
      importance: payload.importance || "normal",
      notice_type: payload.notice_type || "general",
      institution_id: payload.institution_id || null,
      audience_type: payload.audience_type || "all",
      audience_teacher_ids: Array.isArray(payload.audience_teacher_ids)
        ? payload.audience_teacher_ids
        : [],
      event_date: payload.event_date || null,
      event_end_date: payload.event_end_date || null,
      exception_type: payload.exception_type || null,
      event_time: payload.event_time || null,
      event_location: payload.event_location || null,
      schedule_exception_ids: payload.schedule_exception_ids || [],
      author_id: me.id,
      author_name: me.name,
      created_at: new Date().toISOString(),
    };
    const { list, savedToDb, notice: saved } = await persistNotice(row, notices);
    setNotices(list);
    if (savedToDb) {
      void sendPushEvent(supabase, "notice_posted", {
        title: row.title,
        notice_id: saved?.id,
        audience_type: saved?.audience_type || row.audience_type,
        institution_id: saved?.institution_id || row.institution_id,
        audience_teacher_ids: saved?.audience_teacher_ids || row.audience_teacher_ids,
      });
    }
    alert(row.notice_type === "event" ? "행사 공지와 일정이 등록되었습니다." : "공지가 등록되었습니다.");
  };

  const refreshNotices = async () => {
    const noticeList = await fetchNotices();
    setNotices(noticeList);
  };

  const addAdminTodo = async ({ content, assignee_id, priority, start_date, due_date, checklist }) => {
    const row = {
      content: content.trim(),
      assignee_id: assignee_id || null,
      priority: priority === "urgent" ? "urgent" : (priority === "important" ? "important" : (priority === "low" ? "low" : "normal")),
      start_date: toKstDateOnly(start_date),
      due_date: toKstDateOnly(due_date),
      checklist: Array.isArray(checklist) ? checklist : [],
      is_completed: false,
      created_by: me.id,
      created_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from("admin_todos").insert(row).select().single();
    if (error) { alert(error.message || "할 일 추가에 실패했습니다."); return; }
    setAdminTodos(prev => [data, ...prev]);
    void sendPushEvent(supabase, "task_assigned", {
      assignee_id: assignee_id || null,
      title: row.content,
      priority: row.priority,
    });
  };

  const toggleAdminTodo = async (id, isCompleted) => {
    const completed_at = isCompleted ? new Date().toISOString() : null;
    setAdminTodos(prev => prev.map(t => t.id === id ? { ...t, is_completed: isCompleted, completed_at } : t));
    const { error } = await supabase.from("admin_todos").update({ is_completed: isCompleted, completed_at }).eq("id", id);
    if (error) { alert(error.message || "처리에 실패했습니다."); refreshAdminTodos(); }
  };

  const deleteAdminTodo = async (id) => {
    setAdminTodos(prev => prev.filter(t => t.id !== id));
    const { error } = await supabase.from("admin_todos").delete().eq("id", id);
    if (error) { alert(error.message || "삭제에 실패했습니다."); refreshAdminTodos(); }
  };

  const updateAdminTodo = async (id, patch) => {
    setAdminTodos(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
    const { error } = await supabase.from("admin_todos").update(patch).eq("id", id);
    if (error) { alert(error.message || "수정에 실패했습니다."); refreshAdminTodos(); }
  };

  const refreshAdminTodos = async () => {
    const { data, error } = await supabase.from("admin_todos").select("*").order("created_at", { ascending: false });
    if (!error) setAdminTodos(data || []);
  };

  const updateNotice = async (patch) => {
    const id = patch.id;
    const existing = notices.find(n => n.id === id);
    const payload = {
      title: patch.title,
      body: patch.body || "",
      importance: normalizeNoticeImportance(patch.importance),
      notice_type: patch.notice_type || "general",
      institution_id: patch.institution_id || null,
      audience_type: patch.audience_type || "all",
      audience_teacher_ids: Array.isArray(patch.audience_teacher_ids)
        ? patch.audience_teacher_ids
        : [],
      event_date: patch.event_date || null,
      event_end_date: patch.event_end_date || null,
      exception_type: patch.exception_type || null,
      event_time: patch.event_time || null,
      event_location: patch.event_location || null,
      schedule_exception_ids: existing?.schedule_exception_ids || [],
    };

    try {
      const next = await updateNoticeRecord(id, payload, notices);
      let updated = next.find(n => n.id === id) || { ...existing, ...payload, id };
      if (payload.notice_type === "event") {
        const ids = await syncNoticeEventSchedule(updated);
        updated = { ...updated, schedule_exception_ids: ids };
        await supabase.from("notices").update({ schedule_exception_ids: ids }).eq("id", id);
      } else if (existing?.notice_type === "event") {
        await deleteNoticeEventSchedule(existing);
        updated = { ...updated, schedule_exception_ids: [] };
        await supabase.from("notices").update({ schedule_exception_ids: [] }).eq("id", id);
      }
      await refreshNotices();
      alert(payload.notice_type === "event" ? "공지와 행사 일정이 수정되었습니다." : "공지가 수정되었습니다.");
      return true;
    } catch (err) {
      alert(err?.message || "수정에 실패했습니다.");
      return false;
    }
  };

  const deleteNotice = async (id) => {
    const target = notices.find(n => n.id === id);
    if (target?.notice_type === "event") {
      try { await deleteNoticeEventSchedule(target); } catch { /* ignore */ }
    }
    const next = await removeNotice(id, notices);
    setNotices(next);
    await refreshNotices();
  };

  const logout = async () => {
    if (!confirm("로그아웃 하시겠습니까?")) return;
    await supabase.auth.signOut();
  };

  const doSubmitRent = async ({dispatch_location,dispatch_start,dispatch_end,memo,items:ci}) => {
    const conflicts = await checkRotationRentalConflicts(supabase, {
      me, cartItems: ci, items, dispatch_start, dispatch_end, teachers,
    });
    if (conflicts.length) {
      const msg = formatRotationConflictConfirmMessage(conflicts, { actionLabel: "대여" });
      if (!confirm(msg)) return;
    }
    const {data:newReq,error}=await supabase.from("rental_requests").insert({teacher_id:me.id,dispatch_location,dispatch_start,dispatch_end,memo,status:"pending"}).select().single();
    if(error||!newReq){alert("신청 오류: "+error?.message);return;}
    const {data:newRIs}=await supabase.from("rental_items").insert(ci.map(c=>({request_id:newReq.id,item_id:c.item_id,quantity:c.quantity,due_date:c.due_date||dispatch_end,status:"pending"}))).select();
    setReqs(p=>[newReq,...p]); setRIs(p=>[...p,...(newRIs||[])]); setCart([]);
    sendPushEvent(supabase, "rental_requested", {
      teacher_id: me.id,
      teacher_name: me.name,
      item_names: formatPushItemNames(ci.map(c => items.find(i => i.id === c.item_id)?.name)),
    }).catch(() => {});
    alert("대여 신청이 완료되었습니다.\n관리자 승인 후 대여가 확정됩니다.");
  };

  /** 선택한 보유 교구의 반납예정일을 weeks 만큼 연장 + 관리자 알림 */
  const extendRentalItems = async (riIds, weeks) => {
    const extended = [];
    for (const riId of riIds) {
      const ri = ris.find(r => r.id === riId);
      if (!ri || extensionCountOf(ri) >= MAX_RENTAL_EXTENSIONS) continue;
      const newDue = computeExtendedDueDate(ri.due_date, weeks);
      if (!newDue) continue;
      const { data, error } = await supabase.from("rental_items")
        .update({
          due_date: newDue,
          extension_count: extensionCountOf(ri) + 1,
          last_extended_at: new Date().toISOString(),
        })
        .eq("id", ri.id)
        .select()
        .single();
      if (error) { alert("연장 오류: " + error.message); continue; }
      if (data) extended.push(data);
    }
    if (extended.length) {
      setRIs(prev => prev.map(r => extended.find(u => u.id === r.id) || r));
      sendPushEvent(supabase, "rental_extended", {
        teacher_id: me.id,
        teacher_name: me.name,
        weeks,
        item_names: formatPushItemNames(extended.map(u => items.find(i => i.id === u.item_id)?.name)),
      }).catch(() => {});
    }
    return extended.length;
  };

  const submitRent = async (payload) => {
    const candidates = getExtensionCandidates(me, reqs, ris, items, rets);
    if (candidates.length) {
      setExtPrompt({ payload, candidates });
      return;
    }
    await doSubmitRent(payload);
  };

  const submitReservation = async ({ item_id, location, start_date, end_date, quantity }) => {
    const dateErr = validateReservationDates(start_date, end_date);
    if (dateErr) { alert(dateErr); return false; }
    const item = items.find(i => i.id === item_id);
    const maxQty = item?.total_quantity || 1;
    if (quantity < 1 || quantity > maxQty) {
      alert(`수량은 1~${maxQty}개까지 가능합니다`);
      return false;
    }
    const existing = getTeacherPendingReservation(reservations, me.id, item_id);
    if (existing) {
      alert("이미 예약 대기 중인 교구입니다.");
      return false;
    }

    const conflicts = await checkRotationRentalConflicts(supabase, {
      me,
      cartItems: [{ item_id, quantity }],
      items,
      dispatch_start: start_date,
      dispatch_end: end_date,
      teachers,
    });
    if (conflicts.length) {
      const msg = formatRotationConflictConfirmMessage(conflicts, { actionLabel: "예약" });
      if (!confirm(msg)) return false;
    }

    const { data, error } = await supabase.from("reservations").insert({
      teacher_id: me.id,
      item_id,
      quantity,
      start_date,
      end_date,
      location: location.trim(),
      status: "pending",
    }).select().single();

    if (error || !data) {
      alert("예약 신청 오류: " + (error?.message || "알 수 없는 오류"));
      return false;
    }
    setReservations(p => [data, ...p]);
    alert("예약 신청이 완료되었습니다.\n관리자 승인 후 대여가 확정됩니다.");
    return true;
  };

  const cancelReservation = async (resId) => {
    const res = reservations.find(r => r.id === resId);
    if (!res || res.teacher_id !== me.id || res.status !== "pending") {
      alert("취소할 수 없는 예약입니다.");
      return false;
    }
    const { error } = await supabase.from("reservations").update({ status: "cancelled" }).eq("id", resId);
    if (error) {
      alert("예약 취소 오류: " + error.message);
      return false;
    }
    setReservations(p => p.map(r => (r.id === resId ? { ...r, status: "cancelled" } : r)));
    alert("예약이 취소되었습니다.");
    return true;
  };

  const approveReservation = async (resId) => {
    if (!canManage(me)) return false;
    const res = reservations.find(r => r.id === resId);
    if (!res || res.status !== "pending") {
      alert("승인할 수 없는 예약입니다.");
      return false;
    }
    const now = new Date().toISOString();
    // 시작일 전: pending(예약 보유) → 시작일부터 cron/로드 시 rented(대여 중)
    const itemStatus = res.start_date <= todayYmd() ? "rented" : "pending";
    const { data: newReq, error: reqErr } = await supabase.from("rental_requests").insert({
      teacher_id: res.teacher_id,
      dispatch_location: res.location,
      dispatch_start: res.start_date,
      dispatch_end: res.end_date,
      memo: "교구 예약 승인",
      status: "approved",
      approved_by: me.id,
      approved_at: now,
    }).select().single();

    if (reqErr || !newReq) {
      alert("대여 생성 오류: " + (reqErr?.message || "알 수 없는 오류"));
      return false;
    }

    const { data: newRIs, error: riErr } = await supabase.from("rental_items").insert({
      request_id: newReq.id,
      item_id: res.item_id,
      quantity: res.quantity,
      due_date: res.end_date,
      status: itemStatus,
      approved_by: me.id,
      approved_at: now,
    }).select();

    if (riErr || !newRIs?.length) {
      alert("교구 항목 생성 오류: " + (riErr?.message || "알 수 없는 오류"));
      return false;
    }

    const { error: resErr } = await supabase.from("reservations").update({
      status: "confirmed",
      approved_by: me.id,
      approved_at: now,
      rental_request_id: newReq.id,
    }).eq("id", resId);

    if (resErr) {
      alert("예약 상태 업데이트 오류: " + resErr.message);
      return false;
    }

    setReqs(p => [newReq, ...p]);
    setRIs(p => [...p, ...newRIs]);
    setReservations(p => p.map(r => (
      r.id === resId
        ? { ...r, status: "confirmed", approved_by: me.id, approved_at: now, rental_request_id: newReq.id }
        : r
    )));
    notifyRotationDueAfterApproval({
      teacherId: res.teacher_id,
      teacherForConflictCheck: { id: res.teacher_id },
      cartItems: [{ item_id: res.item_id, quantity: res.quantity }],
      dispatch_start: res.start_date,
      dispatch_end: res.end_date,
    });
    alert(
      itemStatus === "rented"
        ? "예약이 승인되어 대여가 시작되었습니다."
        : "예약이 승인되었습니다.\n시작일이 되면 자동으로 대여 중으로 전환됩니다."
    );
    return true;
  };

  const rejectReservation = async (resId, reason) => {
    if (!canManage(me)) return false;
    const res = reservations.find(r => r.id === resId);
    if (!res || res.status !== "pending") {
      alert("거절할 수 없는 예약입니다.");
      return false;
    }
    const { error } = await supabase.from("reservations").update({
      status: "cancelled",
      rejection_reason: reason,
    }).eq("id", resId);
    if (error) {
      alert("예약 거절 오류: " + error.message);
      return false;
    }
    setReservations(p => p.map(r => (
      r.id === resId ? { ...r, status: "cancelled", rejection_reason: reason } : r
    )));
    alert("예약이 거절되었습니다.");
    return true;
  };

  const pushItemNamesForRequest = (reqId) => formatPushItemNames(
    ris
      .filter(ri => ri.request_id === reqId)
      .map(ri => items.find(i => i.id === ri.item_id)?.name),
  );

  /** 승인 직후: 순환 겹침이 있으면 반납기한 안내 푸시 (기능 B) */
  const notifyRotationDueAfterApproval = async ({
    teacherId,
    teacherForConflictCheck,
    cartItems,
    dispatch_start,
    dispatch_end,
  }) => {
    if (!teacherId || !cartItems?.length || !dispatch_start || !dispatch_end) return;
    try {
      const conflicts = await checkRotationRentalConflicts(supabase, {
        me: teacherForConflictCheck || { id: teacherId },
        cartItems,
        items,
        dispatch_start,
        dispatch_end,
        teachers,
      });
      const earliest = earliestRotationConflictByItem(conflicts);
      for (const c of earliest) {
        const returnBy = ymdAddDays(c.weekStart, -1) || c.weekStart;
        await sendPushEvent(supabase, "rental_rotation_due_notice", {
          teacher_id: teacherId,
          item_name: c.itemName,
          return_by: returnBy,
          next_teacher_name: c.teacherName,
          week_start: c.weekStart,
          week_end: c.weekEnd,
        });
      }
    } catch (e) {
      console.warn("rotation due notice failed", e);
    }
  };

  const approveReq = async (reqId) => {
    if (!canManage(me)) return;
    const req = reqs.find(r => r.id === reqId);
    const now=new Date().toISOString();
    const { error: reqErr } = await supabase.from("rental_requests").update({status:"approved",approved_by:me.id,approved_at:now}).eq("id",reqId);
    if (reqErr) { alert("승인 오류: " + reqErr.message); return; }
    const { error: riErr } = await supabase.from("rental_items").update({status:"rented",approved_by:me.id,approved_at:now}).eq("request_id",reqId).eq("status","pending");
    if (riErr) { alert("교구 항목 승인 오류: " + riErr.message); return; }
    setReqs(p=>p.map(r=>r.id===reqId?{...r,status:"approved",approved_by:me.id,approved_at:now}:r));
    setRIs(p=>p.map(ri=>ri.request_id===reqId&&ri.status==="pending"?{...ri,status:"rented",approved_by:me.id,approved_at:now}:ri));
    if (req?.teacher_id) {
      sendPushEvent(supabase, "rental_approved", {
        teacher_id: req.teacher_id,
        item_names: pushItemNamesForRequest(reqId),
      });
      const cartItems = ris
        .filter(ri => ri.request_id === reqId)
        .map(ri => ({ item_id: ri.item_id, quantity: ri.quantity, due_date: ri.due_date }));
      notifyRotationDueAfterApproval({
        teacherId: req.teacher_id,
        teacherForConflictCheck: { id: req.teacher_id },
        cartItems,
        dispatch_start: req.dispatch_start,
        dispatch_end: req.dispatch_end,
      });
    }
    alert("대여 신청이 승인되었습니다.");
  };

  const rejectReq = async (reqId,reason) => {
    if (!canManage(me)) return;
    const req = reqs.find(r => r.id === reqId);
    const now=new Date().toISOString();
    const { error: reqErr } = await supabase.from("rental_requests").update({status:"rejected",rejected_by:me.id,rejected_at:now,rejection_reason:reason}).eq("id",reqId);
    if (reqErr) { alert("거절 오류: " + reqErr.message); return; }
    const { error: riErr } = await supabase.from("rental_items").update({status:"rejected"}).eq("request_id",reqId).eq("status","pending");
    if (riErr) { alert("교구 항목 거절 오류: " + riErr.message); return; }
    setReqs(p=>p.map(r=>r.id===reqId?{...r,status:"rejected",rejected_by:me.id,rejected_at:now,rejection_reason:reason}:r));
    setRIs(p=>p.map(ri=>ri.request_id===reqId&&ri.status==="pending"?{...ri,status:"rejected"}:ri));
    if (req?.teacher_id) {
      sendPushEvent(supabase, "rental_rejected", {
        teacher_id: req.teacher_id,
        item_names: pushItemNamesForRequest(reqId),
        reason,
      });
    }
    alert("대여 신청이 거절되었습니다.");
  };

  const cancelRentalRequest = async (reqId) => {
    const req = reqs.find(r => r.id === reqId);
    if (!req || req.teacher_id !== me.id || req.status !== "pending") {
      alert("취소할 수 없는 신청입니다.");
      return false;
    }
    if (!confirm("대여 신청을 취소하시겠습니까?")) return false;

    const { error: reqErr } = await supabase.from("rental_requests").update({ status: "cancelled" }).eq("id", reqId);
    if (reqErr) {
      alert("신청 취소 오류: " + reqErr.message);
      return false;
    }
    const { error: riErr } = await supabase.from("rental_items").update({ status: "cancelled" }).eq("request_id", reqId).eq("status", "pending");
    if (riErr) {
      alert("교구 항목 취소 오류: " + riErr.message);
      return false;
    }

    setReqs(p => p.map(r => (r.id === reqId ? { ...r, status: "cancelled" } : r)));
    setRIs(p => p.map(ri => (ri.request_id === reqId && ri.status === "pending" ? { ...ri, status: "cancelled" } : ri)));
    alert("대여 신청이 취소되었습니다.");
    return true;
  };

  const updateRentalRequest = async (reqId, { dispatch_location, dispatch_start, dispatch_end, memo, items: ci }) => {
    const req = reqs.find(r => r.id === reqId);
    if (!req || req.teacher_id !== me.id || req.status !== "pending") {
      alert("수정할 수 없는 신청입니다.");
      return false;
    }

    const { error: reqErr } = await supabase.from("rental_requests").update({
      dispatch_location,
      dispatch_start,
      dispatch_end,
      memo: memo || "",
    }).eq("id", reqId);
    if (reqErr) {
      alert("신청 수정 오류: " + reqErr.message);
      return false;
    }

    for (const line of ci) {
      const { error: riErr } = await supabase.from("rental_items").update({
        quantity: line.quantity,
        due_date: line.due_date || dispatch_end,
      }).eq("id", line.rental_item_id).eq("request_id", reqId).eq("status", "pending");
      if (riErr) {
        alert("교구 항목 수정 오류: " + riErr.message);
        return false;
      }
    }

    setReqs(p => p.map(r => (
      r.id === reqId ? { ...r, dispatch_location, dispatch_start, dispatch_end, memo: memo || "" } : r
    )));
    setRIs(p => p.map(ri => {
      const line = ci.find(c => c.rental_item_id === ri.id);
      if (!line || ri.request_id !== reqId) return ri;
      return { ...ri, quantity: line.quantity, due_date: line.due_date || dispatch_end };
    }));
    alert("대여 신청이 수정되었습니다.");
    return true;
  };

  const submitReturnByItem = async (payloadOrList) => {
    const list = Array.isArray(payloadOrList) ? payloadOrList : [payloadOrList];
    const autoApprove = isItemAdmin(me);
    const now = new Date().toISOString();
    const allCreated = [];

    for (const { quantity, condition, memo, lines, itemId, idea, return_location, return_photo_url } of list) {
      if (!String(return_location || "").trim()) {
        alert("반납 위치가 없습니다.");
        return;
      }
      let remaining = quantity;
      const sorted = [...lines].sort(
        (a, b) => new Date(a.ri.approved_at || a.req?.created_at || 0) - new Date(b.ri.approved_at || b.req?.created_at || 0)
      );
      const payloads = [];
      for (const line of sorted) {
        if (remaining <= 0) break;
        if (line.returnable <= 0) continue;
        const q = Math.min(remaining, line.returnable);
        payloads.push({
          rental_item_id: line.ri.id,
          quantity: q,
          condition,
          memo: memo || "",
          teacher_id: me.id,
          status: autoApprove ? "return_approved" : "return_pending",
          return_location: return_location || null,
          return_photo_url: return_photo_url || null,
          ...(autoApprove ? { approved_by: me.id, approved_at: now } : {}),
        });
        remaining -= q;
      }
      if (remaining > 0) {
        alert("반납 가능 수량을 초과했습니다.");
        return;
      }
      const created = [];
      for (const row of payloads) {
        const { data, error } = await supabase.from("return_requests").insert(row).select().single();
        if (error) {
          alert("반납 신청 오류: " + error.message);
          return;
        }
        created.push(data);
        allCreated.push(data);

        if (autoApprove) {
          const ri = ris.find(r => r.id === row.rental_item_id);
          if (ri) {
            const approved = [
              ...rets.filter(r => r.rental_item_id === row.rental_item_id && r.status === "return_approved"),
              data,
            ].reduce((s, r) => s + r.quantity, 0);
            const ns = approved >= ri.quantity ? "returned" : "partial_returned";
            const { error: riErr } = await supabase.from("rental_items").update({ status: ns }).eq("id", ri.id);
            if (riErr) {
              alert("반납 처리 오류: " + riErr.message);
              return;
            }
            setRIs(p => p.map(r => (r.id === ri.id ? { ...r, status: ns } : r)));
            const allRI = ris.filter(r => r.request_id === ri.request_id);
            const allDone = allRI.every(r => (r.id === ri.id ? ns === "returned" : r.status === "returned"));
            const rs = allDone ? "completed" : "partial";
            await supabase.from("rental_requests").update({ status: rs }).eq("id", ri.request_id);
            setReqs(p => p.map(r => (r.id === ri.request_id && r.status !== "rejected" ? { ...r, status: rs } : r)));
          }
        }
      }

      // 교구 최신 반납 스냅샷 (사진 스킵 시 이전 사진은 유지, 위치만 갱신)
      if (itemId) {
        const itemPatch = {
          last_return_location: return_location,
          last_return_at: now,
          last_returned_by: me.id,
          ...(return_photo_url ? { last_return_photo_url: return_photo_url } : {}),
        };
        const { error: itemErr } = await supabase.from("items").update(itemPatch).eq("id", itemId);
        if (itemErr) console.warn("items last_return update:", itemErr.message);
        else setItems(p => p.map(it => (it.id === itemId ? { ...it, ...itemPatch } : it)));
      }

      const ideaText = (idea || "").trim();
      if (ideaText && itemId) {
        const { error: ideaErr } = await insertItemIdea(supabase, {
          itemId,
          teacherId: me.id,
          teacherName: me.name,
          content: ideaText,
        });
        if (ideaErr) {
          console.warn("item idea save failed", ideaErr.message);
        }
      }

      if (!autoApprove) {
        const returnItemName = items.find(i => i.id === itemId)?.name;
        sendPushEvent(supabase, "return_submitted", {
          teacher_id: me.id,
          teacher_name: me.name,
          item_names: formatPushItemNames([returnItemName]),
        });
      }
    }

    setRets(p => [...allCreated, ...p]);
    setItemReturnGroup(null);
    setItemReturnGroups(null);
    alert(
      autoApprove
        ? (allCreated.length > 1
          ? `반납 ${allCreated.length}건이 처리되었습니다.\n재고가 반영되었습니다.`
          : "반납이 완료되었습니다.\n재고가 반영되었습니다.")
        : (allCreated.length > 1
          ? `반납 신청 ${allCreated.length}건이 접수되었습니다.\n상태: 반납 승인 대기 · 관리자 승인 후 재고가 복구됩니다.`
          : "반납 신청이 접수되었습니다.\n상태: 반납 승인 대기 · 관리자 승인 후 재고가 복구됩니다.")
    );
  };

  const forceReturnRentalItem = async (ri, reason) => {
    if (!isSuperAdmin(me)) return false;
    if (!ri?.id) return false;
    const reasonText = (reason || "").trim();
    if (!reasonText) {
      alert("강제반납 사유를 입력하세요");
      return false;
    }

    const now = new Date().toISOString();
    const req = reqs.find(r => r.id === ri.request_id);
    const qty = Math.max(1, heldQtyForRi(ri, rets) || ri.quantity);
    const memo = `강제 반납: ${reasonText}`;

    const { data: newRet, error: retErr } = await supabase.from("return_requests").insert({
      rental_item_id: ri.id,
      quantity: qty,
      condition: "normal",
      memo,
      teacher_id: req?.teacher_id || me.id,
      status: "return_approved",
      approved_by: me.id,
      approved_at: now,
    }).select().single();

    if (retErr) {
      alert("강제 반납 기록 저장 오류: " + retErr.message);
      return false;
    }

    const { error } = await supabase.from("rental_items").update({ status: "returned" }).eq("id", ri.id);
    if (error) {
      alert("강제 반납 오류: " + error.message);
      return false;
    }

    await supabase.from("activity_logs").insert({
      entity_type: "rental_item",
      entity_id: ri.id,
      action: memo,
      actor_id: me.id,
      actor_name: me.name,
      target_id: req?.teacher_id || null,
      target_name: req ? tname(req.teacher_id, teachers) : "-",
    });

    setRIs(p => p.map(r => (r.id === ri.id ? { ...r, status: "returned" } : r)));
    if (newRet) setRets(p => [newRet, ...p]);

    const related = ris.filter(r => r.request_id === ri.request_id);
    const allReturned = related.every(r => (r.id === ri.id ? true : r.status === "returned"));
    if (allReturned && ri.request_id) {
      await supabase.from("rental_requests").update({ status: "completed" }).eq("id", ri.request_id);
      setReqs(p => p.map(r => (
        r.id === ri.request_id && r.status !== "rejected" ? { ...r, status: "completed" } : r
      )));
    }

    alert(`강제 반납 처리되었습니다.\n처리자: ${me.name}\n처리 시간: ${fmtdt(now)}`);
    return true;
  };

  const approveReturn = async (retId) => {
    if (!canManage(me)) return;
    const now=new Date().toISOString();
    const ret=rets.find(r=>r.id===retId);
    await supabase.from("return_requests").update({status:"return_approved",approved_by:me.id,approved_at:now}).eq("id",retId);
    if(ret){
      const ri=ris.find(r=>r.id===ret.rental_item_id);
      if(ri){
        const approved=[...rets.filter(r=>r.rental_item_id===ret.rental_item_id&&r.status==="return_approved"),ret].reduce((s,r)=>s+r.quantity,0);
        const ns=approved>=ri.quantity?"returned":"partial_returned";
        await supabase.from("rental_items").update({status:ns}).eq("id",ri.id);
        setRIs(p=>p.map(r=>r.id===ri.id?{...r,status:ns}:r));
        const allRI=ris.filter(r=>r.request_id===ri.request_id);
        const allDone=allRI.every(r=>r.id===ri.id?ns==="returned":r.status==="returned");
        const rs=allDone?"completed":"partial";
        await supabase.from("rental_requests").update({status:rs}).eq("id",ri.request_id);
        setReqs(p=>p.map(r=>r.id===ri.request_id&&r.status!=="rejected"?{...r,status:rs}:r));
      }
    }
    setRets(p=>p.map(r=>r.id===retId?{...r,status:"return_approved",approved_by:me.id,approved_at:now}:r));
    alert("반납이 승인되었습니다. 재고가 반영되었습니다.");
  };

  const confirmDamage=async(id)=>{if(!canManage(me))return;const now=new Date().toISOString();await supabase.from("return_requests").update({status:"damage_confirmed",approved_by:me.id,approved_at:now}).eq("id",id);setRets(p=>p.map(r=>r.id===id?{...r,status:"damage_confirmed",approved_by:me.id,approved_at:now}:r));};
  const confirmLoss=async(id)=>{if(!canManage(me))return;const now=new Date().toISOString();await supabase.from("return_requests").update({status:"loss_confirmed",approved_by:me.id,approved_at:now}).eq("id",id);setRets(p=>p.map(r=>r.id===id?{...r,status:"loss_confirmed",approved_by:me.id,approved_at:now}:r));};

  const reloadItems = async () => {
    const { data, error } = await supabase.from("items").select("*").order("code");
    if (error) {
      console.error("교구 목록 새로고침 실패", error);
      return;
    }
    setItems(data || []);
  };

  const saveItem = async (data, editId) => {
    if (!canManage(me)) {
      alert("권한이 없습니다");
      return null;
    }
    if (findItemNameConflict(items, data.name, editId)) {
      alert(DUPLICATE_ITEM_NAME_MESSAGE);
      return null;
    }
    const trySave = async (payload) => {
      if (editId) return supabase.from("items").update(payload).eq("id", editId).select().single();
      return supabase.from("items").insert(payload).select().single();
    };
    let payload = { ...data };
    let { data: row, error } = await trySave(payload);
    if (error?.message?.includes("qr_url")) {
      const { qr_url, ...rest } = payload;
      payload = rest;
      ({ data: row, error } = await trySave(payload));
    }
    if (error?.message?.includes("photo_position")) {
      const { photo_position, ...rest } = payload;
      payload = rest;
      ({ data: row, error } = await trySave(payload));
    }
    if (error?.message?.includes("activity_photos")) {
      const { activity_photos, ...rest } = payload;
      payload = rest;
      ({ data: row, error } = await trySave(payload));
    }
    if (error) {
      if (isDuplicateItemNameError(error)) {
        alert(DUPLICATE_ITEM_NAME_MESSAGE);
        return null;
      }
      alert("저장 오류: " + error.message);
      return null;
    }
    if (!editId && row) {
      const pushResult = await sendPushEvent(supabase, "gear_registered", {
        item_id: row.id,
        item_name: row.name,
        actor_name: me?.name || "관리자",
      });
      if (!pushResult.ok) {
        console.warn("[gear] 신규 교구 등록 푸시 실패", pushResult);
      }
    }
    await reloadItems();
    if (editId && detailItem?.id === editId && row) setDetailItem(row);
    return row;
  };

  const deleteItem = async (item) => {
    if (!item?.id) return false;
    if (!canEditItems(me)) {
      alert("관리자만 교구를 삭제할 수 있습니다.");
      return false;
    }
    const confirmed = window.confirm(
      "정말 삭제하시겠습니까?\n\n연결된 대여·반납 기록도 함께 삭제됩니다."
    );
    if (!confirmed) return false;

    try {
      await deleteItemRelatedRecords(item.id);
    } catch (e) {
      alert("연결 기록 삭제 오류: " + (e?.message || e));
      return false;
    }

    const { error } = await supabase.from("items").delete().eq("id", item.id);
    if (error) {
      alert("교구 삭제 오류: " + error.message);
      return false;
    }

    setCart(p => p.filter(c => c.item_id !== item.id));
    if (detailItem?.id === item.id) {
      setDetailItem(null);
      setPage("items");
    }
    await loadAll();
    alert("교구와 연결된 대여 기록이 삭제되었습니다.");
    return true;
  };

  if (dataLoading) return (
    <div style={{minHeight:"100vh",background:DS.pageBg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Noto Sans KR',sans-serif"}}>
      <Spinner text="데이터 불러오는 중..."/>
    </div>
  );

  const admin  = isItemAdmin(me);
  const superA = isSuperAdmin(me);
  const reqBadge = reqs.filter(r=>r.status==="pending").length;
  const retBadge = filterReturnPendingLastWeek(rets).length;
  const resBadge = reservations.filter(r=>r.status==="pending").length;
  const overdueBadge = ris.filter(r=>["rented","partial_returned"].includes(r.status)&&dday(r.due_date)!==null&&dday(r.due_date)<0).length;
  const badge  = reqBadge + retBadge + resBadge;

  const sidebarNav = buildSidebarNav(me);
  const mobileBottomNav = buildMobileBottomNav(me);
  const mobileMoreNav = buildMobileMoreNav(me, mobileBottomNav);

  const goItemsFromDetail = () => setPage(detailBackPage || "items");

  const openItemDetail = (item, fromPage = page) => {
    setDetailItem(item);
    setDetailBackPage(fromPage);
    setPage("item-detail", { itemId: item.id, from: fromPage });
  };

  const renderPage = () => {
    if (!isGearPlatformAdmin(me) && page === "dashboard") {
      return (
        <NoticesPage
          me={me}
          notices={notices}
          onAdd={addNotice}
          onUpdate={updateNotice}
          onDelete={deleteNotice}
          items={items}
          reqs={reqs}
          ris={ris}
          rets={rets}
          setPage={setPage}
          onItemClick={item => openItemDetail(item, "notices")}
          teachers={teachers}
          adminTodos={adminTodos}
          onAddTodo={addAdminTodo}
          onToggleTodo={toggleAdminTodo}
          onDeleteTodo={deleteAdminTodo}
          onUpdateTodo={updateAdminTodo}
          initialNoticeId={noticeId}
          onNoticeDeepLinkConsumed={clearNoticeDeepLink}
        />
      );
    }
    if (!admin && !superA && ["rental-approval","returns-approval","overdue","accounts","items-register","items-qr","gear-rotation-manage","gear-categories","stats","report","settings","rental-manage","reservation-approval"].includes(page)) {
      return (
        <PageShell>
          <div style={{textAlign:"center",padding:"70px 20px"}}>
            <div style={{fontWeight:700,fontSize:16,color:"#dc2626"}}>접근 권한이 없습니다</div>
          </div>
        </PageShell>
      );
    }
    if (admin && !superA && ["accounts","items-register","settings"].includes(page)) {
      return (
        <PageShell>
          <div style={{textAlign:"center",padding:"70px 20px"}}>
            <div style={{fontWeight:700,fontSize:16,color:"#dc2626"}}>접근 권한이 없습니다</div>
          </div>
        </PageShell>
      );
    }

    return (
      <>
        {page==="dashboard"&&<DashboardPage me={me} items={items} teachers={teachers} reqs={reqs} ris={ris} rets={rets} reservations={reservations} onApprove={approveReq} onReject={rejectReq} onApproveRet={approveReturn} onDamage={confirmDamage} onLoss={confirmLoss} onApproveReservation={approveReservation} onRejectReservation={rejectReservation} setPage={setPage} onForceReturn={forceReturnRentalItem} adminTodos={adminTodos} onAddTodo={addAdminTodo} onToggleTodo={toggleAdminTodo} onDeleteTodo={deleteAdminTodo} onUpdateTodo={updateAdminTodo}/>}
        {page==="rental-status"&&<RentalStatusPage me={me} teachers={teachers} reqs={reqs} ris={ris} rets={rets} items={items} onForceReturn={forceReturnRentalItem}/>}
        {page==="overdue"&&<RentalStatusPage me={me} teachers={teachers} reqs={reqs} ris={ris} rets={rets} items={items} initialFilter="overdue" onForceReturn={forceReturnRentalItem}/>}
        {page==="items"&&<ItemsPage items={items} setItems={setItems} ris={ris} rets={rets} reqs={reqs} teachers={teachers} me={me} cart={cart} setCart={setCart} reservations={reservations} onDetail={item=>openItemDetail(item,"items")} onSaveItem={saveItem} onDeleteItem={deleteItem} onSubmitReservation={submitReservation} onCancelReservation={cancelReservation}/>}
        {page==="items-register"&&<ItemsPage items={items} setItems={setItems} ris={ris} rets={rets} reqs={reqs} teachers={teachers} me={me} cart={cart} setCart={setCart} reservations={reservations} onDetail={item=>openItemDetail(item,"items-register")} onSaveItem={saveItem} onDeleteItem={deleteItem} openAddOnMount setPage={setPage}/>}
        {page==="items-browse"&&(
          <ItemsBrowsePage
            me={me}
            items={items}
            ris={ris}
            rets={rets}
            reqs={reqs}
            teachers={teachers}
            cart={cart}
            setCart={setCart}
            reservations={reservations}
            onDetail={item=>openItemDetail(item,"items-browse")}
            onOpenCart={()=>setShowCart(true)}
            onSubmitReservation={submitReservation}
            onCancelReservation={cancelReservation}
            onSaveItem={saveItem}
          />
        )}
        {page==="my-gear-rotation"&&(
          <MyGearRotationPage
            me={me}
            items={items}
            reqs={reqs}
            ris={ris}
            rets={rets}
            onDetail={(item, from) => openItemDetail(item, from)}
            onGoRental={() => setPage("rental-return")}
            PageHeader={PageHeader}
            PageShell={PageShell}
          />
        )}
        {page==="gear-rotation-manage"&&isItemAdmin(me)&&(
          <GearRotationManagePage
            me={me}
            items={items}
            onSaveItem={saveItem}
            onReloadItems={loadAll}
            PageHeader={PageHeader}
            PageShell={PageShell}
          />
        )}
        {page==="gear-categories"&&isItemAdmin(me)&&(
          <PageShell>
            <PageHeader me={me} subtitle={PAGE_META["gear-categories"].sub}/>
            <GearCategoryManagePage me={me} items={items}/>
          </PageShell>
        )}
        {page==="items-qr"&&isItemAdmin(me)&&<ItemsQrPage me={me} items={items}/>}
        {page==="qr-scan"&&(
          <QrScanPage
            me={me}
            items={items}
            onFound={(item) => openItemDetail(item, "qr-scan")}
          />
        )}
        {page==="item-detail"&&!detailItem&&(
          <PageShell>
            <div style={{ display: "flex", justifyContent: "center", padding: "80px 20px" }}>
              <Spinner text="교구 정보 불러오는 중..."/>
            </div>
          </PageShell>
        )}
        {page==="item-detail"&&detailItem&&(
          <ItemDetailPage
            item={detailItem}
            ris={ris}
            rets={rets}
            reqs={reqs}
            teachers={teachers}
            cart={cart}
            setCart={setCart}
            onBack={goItemsFromDetail}
            backLabel={DETAIL_BACK_LABELS[detailBackPage] || "보유 자산으로"}
            me={me}
            onForceReturn={forceReturnRentalItem}
          />
        )}
        {page==="qr-rent"&&scanRentItem&&(
          <QrRentPage
            item={scanRentItem}
            ris={ris}
            rets={rets}
            cart={cart}
            setCart={setCart}
            me={me}
            onOpenCart={()=>setShowCart(true)}
            onViewDetail={()=>openItemDetail(scanRentItem,"qr-rent")}
            onDismiss={()=>{
              setScanRentItem(null);
              setPage(canPersonalGearRental(me) ? "rental-return" : "items");
            }}
          />
        )}
        {(page==="rental-return"||(canPersonalGearRental(me)&&(page==="rentals"||page==="my-rental-status"||page==="return-request")))&&canPersonalGearRental(me)&&(
          <TeacherRentalReturnPage
            me={me}
            reqs={reqs}
            ris={ris}
            items={items}
            rets={rets}
            teachers={teachers}
            onReturnItem={setItemReturnGroup}
            onReturnItems={setItemReturnGroups}
            onCancelRequest={cancelRentalRequest}
            onUpdateRequest={updateRentalRequest}
            initialTab={page==="my-rental-status"||page==="return-request"?"return":"rent"}
          />
        )}
        {page==="rentals"&&me?.role!=="teacher"&&<RentalsPage me={me} reqs={reqs} ris={ris} items={items} teachers={teachers} rets={rets} onApprove={approveReq} onReject={rejectReq}/>}
        {page==="rental-approval"&&<RentalApprovalPage me={me} reqs={reqs} ris={ris} items={items} teachers={teachers} onApprove={approveReq} onReject={rejectReq}/>}
        {page==="reservation-approval"&&<ReservationApprovalPage me={me} reservations={reservations} items={items} teachers={teachers} onApprove={approveReservation} onReject={rejectReservation}/>}
        {page==="my-reservations"&&<MyReservationsPage me={me} reservations={reservations} items={items} ris={ris} rets={rets} onCancel={cancelReservation}/>}
        {page==="returns-approval"&&<ReturnsApprovalPage me={me} rets={rets} ris={ris} items={items} teachers={teachers} onApproveRet={approveReturn} onDamage={confirmDamage} onLoss={confirmLoss}/>}
        {page==="rental-manage"&&<RentalManageHubPage me={me} setPage={setPage}/>}
        {page==="stats"&&<StatsPage me={me} items={items} ris={ris} reqs={reqs} teachers={teachers}/>}
        {page==="report"&&isItemAdmin(me)&&<ReportPage me={me} items={items} ris={ris} rets={rets} reqs={reqs} teachers={teachers}/>}
        {page==="notices"&&(
          <NoticesPage
            me={me}
            notices={notices}
            onAdd={addNotice}
            onUpdate={updateNotice}
            onDelete={deleteNotice}
            items={items}
            reqs={reqs}
            ris={ris}
            rets={rets}
            setPage={setPage}
            onItemClick={item => openItemDetail(item, "notices")}
            teachers={teachers}
            adminTodos={adminTodos}
            onAddTodo={addAdminTodo}
            onToggleTodo={toggleAdminTodo}
            onDeleteTodo={deleteAdminTodo}
            onUpdateTodo={updateAdminTodo}
            initialNoticeId={noticeId}
            onNoticeDeepLinkConsumed={clearNoticeDeepLink}
          />
        )}
        {page==="settings"&&<SettingsPage me={me} onChangePw={()=>setShowPwModal(true)} onLogout={logout} onDataExport={superA ? () => navigate("/admin/data-export") : undefined}/>}
        {page==="accounts"&&superA&&<AccountsPage me={me} teachers={teachers} setTeachers={setTeachers} ris={ris} reqs={reqs} items={items}/>}
      </>
    );
  };

  // ── PC 레이아웃 ──────────────────────────────────────────
  if (isPC) {
    const SIDEBAR_W = 256;
    const sb = DARK_SB;
    return (
      <GearCategoriesProvider>
      <div className="equipment-app equipment-app--desktop" style={{
        display:"flex",minHeight:"100vh",
        width:"100%",maxWidth:"100%",overflowX:"hidden",
        background:DS.pageBg,
        fontFamily:"'Noto Sans KR','Apple SD Gothic Neo',sans-serif",
      }}>
        <style>{`
          *{box-sizing:border-box;}
          ::-webkit-scrollbar{width:5px}
          ::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:99px}
          ::-webkit-scrollbar-track{background:transparent}
          @keyframes spin{to{transform:rotate(360deg)}}
        `}</style>

        {/* ── 사이드바 ── */}
        <div className="no-print" style={{
          width:SIDEBAR_W,
          background:sb.bg,
          borderRight:"none",
          display:"flex",flexDirection:"column",
          position:"fixed",top:0,left:0,bottom:0,
          zIndex:100,
        }}>
          <div style={{padding:"20px 18px 16px"}}>
            <PlatformMainButton onClick={onBack} className="equipment-sidebar-main-btn"/>

            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:22}}>
              <GtsLogo height={36}/>
              <div>
                <div style={{fontSize:15,fontWeight:800,color:"#fff",letterSpacing:"-0.3px"}}>GTS</div>
                <div style={{fontSize:10,color:sb.muted,marginTop:2,lineHeight:1.3}}>대여 관리 시스템</div>
              </div>
            </div>
          </div>

          <div style={{padding:"0 16px 10px"}}>
            <button onClick={()=>setShowCart(true)} style={{
              width:"100%",padding:"10px 14px",
              background: cart.length > 0 ? "rgba(22,163,74,0.15)" : "rgba(255,255,255,0.06)",
              border: cart.length > 0 ? "1px solid rgba(22,163,74,0.35)" : "1px solid rgba(255,255,255,0.1)",
              borderRadius:8,cursor:"pointer",
              color: cart.length > 0 ? "#86efac" : "rgba(255,255,255,0.7)",
              fontWeight:600,fontSize:12,
              textAlign:"left",display:"flex",alignItems:"center",gap:8,
              fontFamily:"inherit",
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
              </svg>
              <span>장바구니</span>
              {cart.length > 0 ? (
                <span style={{
                  marginLeft:"auto",background:DS.primary,color:"#fff",
                  borderRadius:99,padding:"1px 8px",fontSize:10,fontWeight:700,
                }}>{cart.length}</span>
              ) : null}
            </button>
          </div>

          <SidebarNav
            nav={sidebarNav}
            page={page}
            setPage={setPage}
            sb={sb}
            badge={badge}
            reqBadge={reqBadge}
            retBadge={retBadge}
            resBadge={resBadge}
            overdueBadge={overdueBadge}
            admin={admin}
          />

          <div style={{padding:"12px 14px 20px"}}>
            <div style={{
              background:sb.profileBg,border:`1px solid ${sb.profileBorder}`,
              borderRadius:14,padding:"14px 14px 12px",
            }}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                <div style={{
                  width:40,height:40,borderRadius:12,flexShrink:0,
                  background:"rgba(22,163,74,0.25)",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:15,fontWeight:800,color:"#86efac",
                }}>{me.name[0]}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:13,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    {me.name}님
                  </div>
                  <div style={{fontSize:11,color:sb.muted,marginTop:2}}>{ROLE_CFG[me.role]?.label}</div>
                </div>
              </div>
              <div style={{display:"flex",gap:6}}>
                <button onClick={()=>setShowPwModal(true)} style={{
                  flex:1,padding:"8px",borderRadius:8,border:"none",
                  background:"rgba(255,255,255,0.06)",color:"rgba(255,255,255,0.65)",
                  fontSize:11,cursor:"pointer",fontFamily:"inherit",
                }}>비밀번호 변경</button>
                <button onClick={logout} style={{
                  flex:1,padding:"8px",borderRadius:8,border:"none",
                  background:"rgba(220,38,38,0.15)",color:"#fca5a5",
                  fontSize:11,cursor:"pointer",fontFamily:"inherit",
                }}>로그아웃</button>
              </div>
            </div>
            <div style={{
              marginTop:14,height:56,borderRadius:12,overflow:"hidden",
              background:"linear-gradient(135deg, rgba(22,163,74,0.2) 0%, rgba(17,24,39,0.8) 100%)",
              display:"flex",alignItems:"flex-end",justifyContent:"center",gap:6,paddingBottom:8,
            }}>
              {[28,36,22,32].map((h,i)=>(
                <div key={i} style={{
                  width:14,height:h,borderRadius:4,
                  background:`rgba(22,163,74,${0.35 + i * 0.12})`,
                }}/>
              ))}
            </div>
          </div>
        </div>

        {/* ── 메인 콘텐츠 ── */}
        <div style={{
          marginLeft:SIDEBAR_W,
          flex:1,
          minWidth:0,
          padding:"32px 36px",
          overflowY:"auto",
          overflowX:"hidden",
          minHeight:"100vh",
          boxSizing:"border-box",
        }}>
          {renderPage()}
        </div>

        {showCart&&<CartModal cart={cart} setCart={setCart} items={items} ris={ris} rets={rets} onSubmit={submitRent} onClose={()=>setShowCart(false)}/>}
        {extPrompt&&(
          <ExtensionPromptModal
            candidates={extPrompt.candidates}
            maxExtensions={MAX_RENTAL_EXTENSIONS}
            onConfirm={async (riIds, weeks) => {
              const n = await extendRentalItems(riIds, weeks);
              const payload = extPrompt.payload;
              setExtPrompt(null);
              await doSubmitRent(payload);
              if (n) alert(`${n}개 교구를 ${weeks}주 연장 신청했습니다.`);
            }}
            onSkip={async () => {
              const payload = extPrompt.payload;
              setExtPrompt(null);
              await doSubmitRent(payload);
            }}
            onClose={() => setExtPrompt(null)}
          />
        )}
        {(itemReturnGroups?.length || itemReturnGroup) && (
          <ItemReturnModal
            groups={itemReturnGroups}
            group={itemReturnGroup}
            onSubmit={submitReturnByItem}
            onClose={() => { setItemReturnGroup(null); setItemReturnGroups(null); }}
          />
        )}
        {showPwModal&&<ChangePwModal email={session.user.email} onClose={()=>setShowPwModal(false)}/>}
      </div>
      </GearCategoriesProvider>
    );
  }

  // ── 모바일 레이아웃 ──────────────────────────────────────
  const mobileTitle = (PAGE_META[page] || PAGE_META[gearHomePage(me)]).title;
  const mobileIconBtn = {
    width: 44,
    height: 44,
    minWidth: 44,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 10,
    cursor: "pointer",
    padding: 0,
    fontFamily: "inherit",
    color: "#fff",
    flexShrink: 0,
  };

  return (
    <GearCategoriesProvider>
    <div className="equipment-app equipment-app--mobile" style={{
      width: "100%",
      maxWidth: "100%",
      margin: 0,
      overflowX: "hidden",
      minHeight: "100vh",
      background: DS.pageBg,
      fontFamily: "'Noto Sans KR','Apple SD Gothic Neo',sans-serif",
      paddingBottom: "calc(72px + env(safe-area-inset-bottom, 0px))",
    }}>
      <style>{`
        *{box-sizing:border-box;}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
      `}</style>

      <MobileNavDrawer
        open={showMobileDrawer}
        onClose={()=>setShowMobileDrawer(false)}
        nav={sidebarNav}
        page={page}
        setPage={setPage}
        sb={DARK_SB}
        badge={badge}
        reqBadge={reqBadge}
        retBadge={retBadge}
        resBadge={resBadge}
        overdueBadge={overdueBadge}
        admin={admin}
        me={me}
        onBack={onBack}
        onLogout={logout}
        onChangePw={()=>setShowPwModal(true)}
        cartCount={cart.length}
        onOpenCart={()=>setShowCart(true)}
      />

      <header className="no-print" style={{
        background: DARK_SB.bg,
        padding: "6px 8px",
        paddingTop: "calc(6px + env(safe-area-inset-top, 0px))",
        position: "sticky",
        top: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        minHeight: 56,
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}>
        <button
          type="button"
          aria-label="메뉴 열기"
          onClick={()=>setShowMobileDrawer(true)}
          style={mobileIconBtn}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/>
          </svg>
        </button>

        <h1 style={{
          position: "absolute",
          left: 56,
          right: 56,
          margin: 0,
          textAlign: "center",
          fontSize: 15,
          fontWeight: 800,
          color: "#fff",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          pointerEvents: "none",
        }}>{mobileTitle}</h1>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <button
            type="button"
            onClick={()=>setShowCart(true)}
            aria-label={cart.length > 0 ? `장바구니 ${cart.length}개` : "장바구니"}
            style={{
              ...mobileIconBtn,
              position: "relative",
              color: cart.length > 0 ? "#86efac" : "rgba(255,255,255,0.75)",
              background: cart.length > 0 ? "rgba(22,163,74,0.2)" : "rgba(255,255,255,0.08)",
              border: cart.length > 0 ? "1px solid rgba(22,163,74,0.35)" : "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
            </svg>
            {cart.length > 0 ? (
              <span style={{
                position: "absolute",
                top: 2,
                right: 2,
                minWidth: 16,
                height: 16,
                padding: "0 4px",
                borderRadius: 99,
                background: DS.primary,
                color: "#fff",
                fontSize: 9,
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1.5px solid #0f172a",
              }}>
                {cart.length}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            aria-label="프로필 메뉴"
            onClick={()=>setShowProfile(v=>!v)}
            style={mobileIconBtn}
          >
            <span style={{ fontSize: 15, fontWeight: 800, color: "#86efac" }}>{me.name[0]}</span>
          </button>
        </div>
      </header>

      {/* 프로필 드롭다운 */}
      {showProfile&&(
        <>
          <div style={{
            position: "fixed",
            top: "calc(56px + env(safe-area-inset-top, 0px))",
            right: 8,
            background: "#fff",
            borderRadius: 16,
            boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
            zIndex: 300,
            padding: "8px 0",
            minWidth: 220,
            border: "1px solid #e2e8f0",
          }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid #f1f5f9" }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: DS.textPrimary }}>{me.name}</div>
              <div style={{ marginTop: 6 }}><RoleBadge role={me.role} isItemAdmin={me.is_item_admin}/></div>
              <div style={{ fontSize: 12, color: DS.textMuted, marginTop: 6, overflow: "hidden", textOverflow: "ellipsis" }}>{session.user.email}</div>
            </div>
            <button
              type="button"
              onClick={()=>{ setShowPwModal(true); setShowProfile(false); }}
              style={{
                display: "block", width: "100%", minHeight: 44, padding: "12px 16px", border: "none",
                background: "none", textAlign: "left", fontSize: 14, cursor: "pointer",
                color: DS.textSecondary, fontFamily: "inherit", fontWeight: 600,
              }}
            >
              비밀번호 변경
            </button>
            <button
              type="button"
              onClick={()=>{ logout(); setShowProfile(false); }}
              style={{
                display: "block", width: "100%", minHeight: 44, padding: "12px 16px", border: "none",
                background: "none", textAlign: "left", fontSize: 14, cursor: "pointer",
                color: "#dc2626", fontFamily: "inherit", fontWeight: 600,
              }}
            >
              로그아웃
            </button>
          </div>
          <div style={{ position: "fixed", inset: 0, zIndex: 299 }} onClick={()=>setShowProfile(false)}/>
        </>
      )}

      <div className="mobile-content">{renderPage()}</div>

      {showMobileMore&&(
        <MobileMoreSheet
          items={mobileMoreNav}
          page={page}
          onSelect={id=>{ setPage(id); setShowMobileMore(false); }}
          onClose={()=>setShowMobileMore(false)}
        />
      )}

      {/* 하단 탭 내비 */}
      <nav className="no-print mobile-bottom-nav" aria-label="주요 메뉴" style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        width: "100%",
        background: DARK_SB.bg,
        borderTop: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 -4px 24px rgba(0,0,0,0.25)",
        zIndex: 200,
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}>
        <div style={{ display: "flex", width: "100%", minHeight: 56 }}>
        {mobileBottomNav.map(n=>{
          const moreActive = n.id === "more" && mobileMoreNav.some(m => isNavPageActive(page, m.id));
          const active = n.id === "more" ? moreActive : isNavPageActive(page, n.id);
          return (
            <button
              key={n.id}
              type="button"
              aria-label={n.label}
              aria-current={active ? "page" : undefined}
              onClick={()=>{
                if (n.id === "more") setShowMobileMore(true);
                else { setPage(n.id); setShowMobileMore(false); setShowMobileDrawer(false); }
              }}
              style={{
                flex: 1,
                minWidth: 0,
                minHeight: 56,
                padding: "6px 4px",
                border: "none",
                background: "transparent",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
                cursor: "pointer",
                position: "relative",
                fontFamily: "inherit",
              }}
            >
              <NavGlyph
                id={n.glyph || n.id}
                color={active ? "#86efac" : DARK_SB.muted}
                size={17}
              />
              <span style={{
                fontSize: 9,
                fontWeight: active ? 700 : 500,
                color: active ? "#86efac" : DARK_SB.muted,
                lineHeight: 1.15,
                textAlign: "center",
                maxWidth: "100%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}>{n.label}</span>
              {n.id==="dashboard"&&badge>0&&admin&&(
                <span style={{
                  position:"absolute",top:3,right:"12%",
                  background:"#ef4444",color:"#fff",
                  borderRadius:99,fontSize:7,fontWeight:900,
                  padding:"1px 3px",minWidth:10,textAlign:"center",
                }}>{badge}</span>
              )}
              {n.id==="returns-approval"&&retBadge>0&&(
                <span style={{
                  position:"absolute",top:3,right:"12%",
                  background:"#ef4444",color:"#fff",
                  borderRadius:99,fontSize:7,fontWeight:900,
                  padding:"1px 3px",minWidth:10,textAlign:"center",
                }}>{retBadge}</span>
              )}
              {active&&(
                <div style={{
                  position:"absolute",top:0,left:"18%",right:"18%",
                  height:2,
                  background:DS.primary,
                  borderRadius:"0 0 4px 4px",
                }}/>
              )}
            </button>
          );
        })}
        </div>
      </nav>

      {showCart&&<CartModal cart={cart} setCart={setCart} items={items} ris={ris} rets={rets} onSubmit={submitRent} onClose={()=>setShowCart(false)}/>}
      {extPrompt&&(
        <ExtensionPromptModal
          candidates={extPrompt.candidates}
          maxExtensions={MAX_RENTAL_EXTENSIONS}
          onConfirm={async (riIds, weeks) => {
            const n = await extendRentalItems(riIds, weeks);
            const payload = extPrompt.payload;
            setExtPrompt(null);
            await doSubmitRent(payload);
            if (n) alert(`${n}개 교구를 ${weeks}주 연장 신청했습니다.`);
          }}
          onSkip={async () => {
            const payload = extPrompt.payload;
            setExtPrompt(null);
            await doSubmitRent(payload);
          }}
          onClose={() => setExtPrompt(null)}
        />
      )}
      {(itemReturnGroups?.length || itemReturnGroup) && (
        <ItemReturnModal
          groups={itemReturnGroups}
          group={itemReturnGroup}
          onSubmit={submitReturnByItem}
          onClose={() => { setItemReturnGroup(null); setItemReturnGroups(null); }}
        />
      )}
      {showPwModal&&<ChangePwModal email={session.user.email} onClose={()=>setShowPwModal(false)}/>}
    </div>
    </GearCategoriesProvider>
  );
}
