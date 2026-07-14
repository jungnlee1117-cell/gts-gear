import { fetchScheduleExceptions } from "./schedule/api.js";
import { DAY_LABELS, EXCEPTION_LABELS, fmtLocalDate } from "./schedule/constants.js";
import { exceptionEndDate } from "./schedule/scheduleExceptions.js";

/** @typedef {'institution'|'global'|'vacation'|'event'|'urgent'|'general'} UnifiedNoticeType */

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
  general: "일반",
};

export const UNIFIED_NOTICE_TYPE_TONES = {
  institution: "institution",
  global: "global",
  vacation: "vacation",
  event: "event",
  urgent: "urgent",
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

  return /** @type {UnifiedFeedItem} */ ({
    id: `notice-${notice.id}`,
    source: "notice",
    type,
    title: notice.title || "공지",
    subtitle: subtitle || (notice.author_name ? `${notice.author_name} · 공지` : "공지"),
    eventDate: notice.notice_type === "event" ? notice.event_date : undefined,
    createdAt: notice.created_at,
    pinned: notice.importance === "important",
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
  const order = { urgent: 0, institution: 1, global: 2, vacation: 3, event: 4, general: 5 };
  return order[type] ?? 9;
}

/** @param {UnifiedFeedItem[]} items */
export function sortUnifiedFeedItems(items, now = new Date()) {
  return [...items].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;

    const aUrgent = a.type === "urgent";
    const bUrgent = b.type === "urgent";
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

/** @param {object[]} notices @param {object[]} exceptions */
export function buildUnifiedFeed(notices = [], exceptions = [], now = new Date()) {
  const linkedExceptionIds = new Set();
  for (const notice of notices) {
    if (notice.notice_type === "event" && notice.schedule_exception_ids?.length) {
      notice.schedule_exception_ids.forEach(id => linkedExceptionIds.add(id));
    }
  }
  const standaloneExceptions = (exceptions || []).filter(
    ex => !ex.notice_id && !linkedExceptionIds.has(ex.id),
  );
  const items = [
    ...notices.map(noticeToFeedItem),
    ...standaloneExceptions.map(exceptionToFeedItem),
  ];
  return sortUnifiedFeedItems(items, now);
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

export async function loadUnifiedNoticeFeed(fetchNoticesFn) {
  const [notices, exceptions] = await Promise.all([
    fetchNoticesFn(),
    fetchScheduleExceptionsForFeed(),
  ]);
  return buildUnifiedFeed(notices || [], exceptions || []);
}
