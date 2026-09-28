import { fetchScheduleExceptions } from "./schedule/api.js";
import { DAY_LABELS, EXCEPTION_LABELS, fmtLocalDate } from "./schedule/constants.js";
import { exceptionEndDate } from "./schedule/scheduleExceptions.js";
import { audienceBadgeTone, audienceLabel } from "./noticeAudience.js";
import {
  fetchItemQuantityAdjustments,
  formatAdjustmentSubtitle,
} from "./itemQuantityAdjust.js";
import {
  buildClassIncidentFeedItem,
  countClassIncidentsNeedingReview,
  countPendingSafetyIncidents,
  fetchLatestClassIncident,
} from "./schedule/classIncidentReports.js";

/** @typedef {'institution'|'global'|'vacation'|'event'|'urgent'|'inventory'|'class_incident'|'general'} UnifiedNoticeType */

/**
 * @typedef {Object} UnifiedFeedItem
 * @property {string} id
 * @property {'notice'|'exception'} source
 * @property {UnifiedNoticeType} type
 * @property {string} title
 * @property {string} subtitle
 * @property {string} [eventDate] YYYY-MM-DD — D-day 기준
 * @property {string} [createdAt]
 * @property {boolean} [pinned]
 * @property {*} raw
 */

export const UNIFIED_NOTICE_TYPE_LABELS = {
  institution: "담당기관",
  global: "전체공지",
  vacation: "방학",
  event: "행사",
  urgent: "긴급",
  inventory: "재고",
  class_incident: "수업보고",
  general: "일반",
};

export const UNIFIED_NOTICE_TYPE_TONES = {
  institution: "institution",
  global: "global",
  vacation: "vacation",
  event: "event",
  urgent: "urgent",
  inventory: "inventory",
  class_incident: "class_incident",
  general: "general",
};

const FEED_LOOKAHEAD_DAYS = 120;

function parseLocalDate(dateStr) {
  const [y, m, d] = String(dateStr).split("-").map(Number);
  return new Date(y, m - 1, d);
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function daysUntil(dateStr, from = new Date()) {
  if (!dateStr) return null;
  const target = startOfDay(parseLocalDate(dateStr));
  const base = startOfDay(from);
  return Math.round((target - base) / 86_400_000);
}

export function formatDdayLabel(dateStr, from = new Date()) {
  const diff = daysUntil(dateStr, from);
  if (diff == null) return "";
  if (diff === 0) return "오늘";
  if (diff > 0) return `D-${diff}`;
  if (diff === -1) return "어제";
  return "";
}

export function formatKoreanEventDate(dateStr) {
  const d = parseLocalDate(dateStr);
  return `${d.getMonth() + 1}월 ${d.getDate()}일(${DAY_LABELS[d.getDay()]})`;
}

export function isNoticeCurrentlyVisible(notice, now = new Date()) {
  if (notice?.notice_type !== "event") return true;
  const visibleThrough = notice.event_end_date || notice.event_date;
  if (!visibleThrough) return true;
  const remainingDays = daysUntil(visibleThrough, now);
  return !Number.isFinite(remainingDays) || remainingDays >= 0;
}

function formatExceptionSubtitle(ex) {
  const start = formatKoreanEventDate(ex.exception_date);
  const end = exceptionEndDate(ex);
  if (ex.end_date && ex.end_date !== ex.exception_date) {
    return `${start} ~ ${formatKoreanEventDate(end)}`;
  }
  return start;
}

function classifyNotice(notice) {
  if (notice.notice_type === "event") return "event";
  const title = notice.title || "";
  const body = notice.body || "";
  const text = `${title} ${body}`;

  if (notice.importance === "important" || /긴급/.test(title)) {
    return "urgent";
  }
  if (/방학/.test(text)) return "vacation";
  if (/전체|만나는\s*날/.test(title)) return "global";
  if (/행사/.test(title)) return "event";
  return "general";
}

function classifyException(ex) {
  const note = ex.note?.trim() || "";
  if (ex.exception_type === "event") {
    return { type: "event", title: note || "행사" };
  }
  if (ex.exception_type === "cancelled") {
    if (/방학/.test(note)) {
      return { type: "vacation", title: note || "방학 일정" };
    }
    return { type: "institution", title: note || EXCEPTION_LABELS.cancelled };
  }
  if (ex.exception_type === "time_change") {
    return { type: "institution", title: note || EXCEPTION_LABELS.time_change };
  }
  return { type: "institution", title: note || "안내" };
}

/** @param {object} notice */
export function noticeToFeedItem(notice) {
  const type = classifyNotice(notice);
  const body = notice.body?.trim();
  const subtitle = body
    ? body.split("\n").map(s => s.trim()).filter(Boolean)[0]?.slice(0, 100) || ""
    : "";
  const institutionName = notice.institutions?.name || null;
  const institutionId = notice.institution_id || null;
  const scopeLabel = audienceLabel(notice, institutionName);
  const scopeTone = audienceBadgeTone(notice);

  return /** @type {UnifiedFeedItem} */ ({
    id: `notice-${notice.id}`,
    source: "notice",
    type,
    title: notice.title || "공지",
    subtitle: subtitle || (notice.author_name ? `${notice.author_name} · 공지` : "공지"),
    eventDate: notice.notice_type === "event" ? notice.event_date : undefined,
    createdAt: notice.created_at,
    pinned: notice.importance === "important",
    institutionId,
    institutionName,
    scopeLabel,
    scopeTone,
    raw: notice,
  });
}

/** @param {object} ex */
export function exceptionToFeedItem(ex) {
  const { type, title } = classifyException(ex);
  const instName = ex.institutions?.name;
  const subtitleParts = [formatExceptionSubtitle(ex)];
  if (instName) subtitleParts.push(instName);

  return /** @type {UnifiedFeedItem} */ ({
    id: `exception-${ex.id}`,
    source: "exception",
    type,
    title,
    subtitle: subtitleParts.join(" · "),
    eventDate: ex.exception_date,
    createdAt: ex.created_at,
    pinned: false,
    raw: ex,
  });
}

function typeRank(type) {
  const order = { urgent: 0, inventory: 1, class_incident: 2, institution: 3, global: 4, vacation: 5, event: 6, general: 7 };
  return order[type] ?? 9;
}

/** @param {UnifiedFeedItem[]} items */
export function sortUnifiedFeedItems(items, now = new Date()) {
  return [...items].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;

    const aUrgent = a.type === "urgent" || a.urgentSafety;
    const bUrgent = b.type === "urgent" || b.urgentSafety;
    if (aUrgent !== bUrgent) return aUrgent ? -1 : 1;

    const aType = typeRank(a.type);
    const bType = typeRank(b.type);
    if (aType !== bType) return aType - bType;

    const aDays = a.eventDate ? daysUntil(a.eventDate, now) : null;
    const bDays = b.eventDate ? daysUntil(b.eventDate, now) : null;
    if (aDays != null && bDays != null && aDays !== bDays) {
      const aFuture = aDays >= 0;
      const bFuture = bDays >= 0;
      if (aFuture && bFuture) return aDays - bDays;
      if (aFuture) return -1;
      if (bFuture) return 1;
    }
    if (aDays != null && bDays == null) return -1;
    if (aDays == null && bDays != null) return 1;

    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });
}

export const INVENTORY_LOG_FEED_ID = "inventory-log";

export function isLegacyInventoryNotice(notice) {
  return notice?.audience_type === "item_admins"
    || notice?.body_style?.source === "item_quantity_adjust";
}

export function isLegacyClassIncidentNotice(notice) {
  return notice?.audience_type === "schedule_admins"
    || notice?.body_style?.source === "class_incident_report";
}

export function isInventoryLogItem(item) {
  return item?.source === "inventory" || item?.raw?.kind === "inventory-log";
}

export function buildInventoryLogFeedItem(latestRow) {
  return {
    id: INVENTORY_LOG_FEED_ID,
    source: "inventory",
    type: "inventory",
    title: "교구 재고 변경",
    subtitle: formatAdjustmentSubtitle(latestRow),
    createdAt: latestRow?.created_at || null,
    pinned: true,
    scopeLabel: "교구관리자",
    scopeTone: "item_admins",
    raw: { kind: "inventory-log" },
  };
}

/** 공지사항 목록은 행사 일정이 아닌 순수 공지만 표시합니다. */
export function buildUnifiedFeed(notices = [], _exceptions = [], now = new Date()) {
  const noticeItems = (notices || [])
    .filter(notice => notice.notice_type !== "event")
    .filter(notice => !isLegacyInventoryNotice(notice))
    .filter(notice => !isLegacyClassIncidentNotice(notice))
    .map(noticeToFeedItem);
  return sortUnifiedFeedItems(noticeItems, now);
}

export async function fetchScheduleExceptionsForFeed(now = new Date()) {
  const start = fmtLocalDate(now);
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + FEED_LOOKAHEAD_DAYS);
  const end = fmtLocalDate(endDate);
  try {
    return await fetchScheduleExceptions(null, start, end);
  } catch {
    return [];
  }
}

export async function loadUnifiedNoticeFeed(fetchNoticesFn, {
  includeInventoryLog = false,
  includeClassIncidents = false,
} = {}) {
  const notices = await fetchNoticesFn();
  const extras = [];
  if (includeInventoryLog) {
    let latest = null;
    try {
      const { rows } = await fetchItemQuantityAdjustments({ limit: 1 });
      latest = rows?.[0] || null;
    } catch {
      /* 이력 조회 실패해도 고정 카드는 보여 줌 */
    }
    extras.push(buildInventoryLogFeedItem(latest));
  }
  if (includeClassIncidents) {
    let latest = null;
    let pending = 0;
    try {
      const [latestRes, count, safetyCount] = await Promise.all([
        fetchLatestClassIncident(),
        countClassIncidentsNeedingReview(),
        countPendingSafetyIncidents(),
      ]);
      latest = latestRes.row;
      pending = count;
      extras.push(buildClassIncidentFeedItem(latest, pending, safetyCount));
    } catch {
      /* 조회 실패해도 고정 카드는 보여 줌 */
      extras.push(buildClassIncidentFeedItem(latest, pending));
    }
  }
  return sortUnifiedFeedItems([...extras, ...buildUnifiedFeed(notices || [])]);
}
