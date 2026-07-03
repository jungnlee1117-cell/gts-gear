import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, ChevronDown, ChevronLeft, CheckCheck } from "lucide-react";
import {
  countScheduleChangeNotifications,
  countUnreadScheduleChangeNotifications,
  fetchScheduleChangeNotifications,
  markAllScheduleChangeNotificationsRead,
  markScheduleChangeNotificationRead,
  markScheduleChangeNotificationsReadByIds,
} from "./api.js";
import { DAY_LABELS, PAY_TYPES, yearMonthKey } from "./constants.js";
import {
  isPersonalLessonNotification,
  resolveNotificationPayType,
} from "./scheduleChangeNotifications.js";
import { summarizeChangeReasons } from "./changeReasonOptions.js";

const TYPE_FILTERS = [
  { id: "all", label: "전체" },
  ...PAY_TYPES.map(t => ({ id: t, label: t })),
  { id: "personal", label: "개인레슨" },
];

const CHANGE_LABELS = {
  skipped: "수업 안 함",
  custom: "시간·분 수정",
  extra_added: "스케줄 외 추가",
};

const CHANGE_BADGE_CLASS = {
  skipped: "sch-change-alerts-type--skipped",
  custom: "sch-change-alerts-type--custom",
  extra_added: "sch-change-alerts-type--extra_added",
};

function formatAlertDate(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${y}년 ${m}월 ${d}일 (${DAY_LABELS[dt.getDay()]})`;
}

function formatShortDate(dateStr) {
  if (!dateStr) return "";
  const [, m, d] = dateStr.split("-").map(Number);
  return `${m}/${d}`;
}

function formatDateRange(dateMin, dateMax) {
  if (!dateMin) return "";
  if (!dateMax || dateMin === dateMax) return formatShortDate(dateMin);
  return `${formatShortDate(dateMin)}~${formatShortDate(dateMax)}`;
}

function formatCreatedAt(iso) {
  if (!iso) return "";
  const dt = new Date(iso);
  return `${dt.getFullYear()}.${dt.getMonth() + 1}.${dt.getDate()} ${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
}

function matchesTypeFilter(item, filterId) {
  if (filterId === "all") return true;
  if (filterId === "personal") return isPersonalLessonNotification(item);
  return resolveNotificationPayType(item) === filterId;
}

function institutionLabel(item) {
  if (item.institutions?.name) return item.institutions.name;
  if (isPersonalLessonNotification(item)) return "개인레슨";
  return "원 미지정";
}

function daysBetween(dateA, dateB) {
  const [y1, m1, d1] = dateA.split("-").map(Number);
  const [y2, m2, d2] = dateB.split("-").map(Number);
  const t1 = new Date(y1, m1 - 1, d1).getTime();
  const t2 = new Date(y2, m2 - 1, d2).getTime();
  return Math.round((t2 - t1) / 86400000);
}

function buildChangeTypeCounts(items) {
  const counts = {};
  for (const item of items) {
    const type = item.change_type || "custom";
    counts[type] = (counts[type] || 0) + 1;
  }
  return counts;
}

/** 선생님 + 기관 + 연속 날짜 기준 그룹 */
function groupChangeAlerts(items) {
  const sorted = [...items].sort((a, b) => {
    const keyA = `${a.teacher_id}|${a.institution_id || ""}`;
    const keyB = `${b.teacher_id}|${b.institution_id || ""}`;
    if (keyA !== keyB) return keyA.localeCompare(keyB);
    const dateCmp = a.class_date.localeCompare(b.class_date);
    if (dateCmp !== 0) return dateCmp;
    return (a.created_at || "").localeCompare(b.created_at || "");
  });

  const groups = [];
  for (const item of sorted) {
    const key = `${item.teacher_id}|${item.institution_id || ""}`;
    const last = groups[groups.length - 1];

    if (last && last.key === key && daysBetween(last.dateMax, item.class_date) <= 1) {
      last.items.push(item);
      if (item.class_date > last.dateMax) last.dateMax = item.class_date;
      if (item.class_date < last.dateMin) last.dateMin = item.class_date;
      last.typeCounts = buildChangeTypeCounts(last.items);
      last.reasonSummary = summarizeChangeReasons(last.items);
      continue;
    }

    groups.push({
      id: `${key}|${item.class_date}`,
      key,
      teacherName: item.teachers?.name || "강사",
      institutionName: institutionLabel(item),
      dateMin: item.class_date,
      dateMax: item.class_date,
      items: [item],
      typeCounts: buildChangeTypeCounts([item]),
      reasonSummary: summarizeChangeReasons([item]),
    });
  }

  return groups.sort((a, b) => b.dateMax.localeCompare(a.dateMax));
}

function ChangeAlertDetail({ item }) {
  const payType = resolveNotificationPayType(item);
  return (
    <div className="sch-change-alerts-detail-item">
      <div className="sch-change-alerts-detail-item-head">
        <span className="sch-change-alerts-detail-date">{formatAlertDate(item.class_date)}</span>
        {payType ? <span className="sch-change-alerts-pay-type">{payType}</span> : null}
        <span className={`sch-change-alerts-type sch-change-alerts-type--${item.change_type}`}>
          {CHANGE_LABELS[item.change_type] || item.change_type}
        </span>
        <span className="sch-change-alerts-created">입력 {formatCreatedAt(item.created_at)}</span>
      </div>
      <div className="sch-change-alerts-detail">
        {item.change_type === "extra_added" ? (
          <div className="sch-change-alerts-row sch-change-alerts-row--actual">
            <span className="sch-change-alerts-label">추가</span>
            <span>{item.actual_handling}</span>
          </div>
        ) : (
          <>
            <div className="sch-change-alerts-row">
              <span className="sch-change-alerts-label">원래</span>
              <span>{item.original_schedule}</span>
            </div>
            <div className="sch-change-alerts-row sch-change-alerts-row--actual">
              <span className="sch-change-alerts-label">처리</span>
              <span>{item.actual_handling}</span>
            </div>
          </>
        )}
        {item.change_reason ? (
          <div className="sch-change-alerts-row sch-change-alerts-row--reason">
            <span className="sch-change-alerts-label">사유</span>
            <span>{item.change_reason}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function ScheduleChangeAlertsView({ onBack }) {
  const today = new Date();
  const [yearMonth, setYearMonth] = useState(yearMonthKey(today));
  const [typeFilter, setTypeFilter] = useState("all");
  const [items, setItems] = useState([]);
  const [monthTotal, setMonthTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const totalUnread = useUnreadChangeAlertCount(true);

  const [y, m] = yearMonth.split("-").map(Number);
  const monthLabel = `${y}년 ${m}월`;

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    setExpandedIds(new Set());
    try {
      const [rows, total] = await Promise.all([
        fetchScheduleChangeNotifications({ yearMonth }),
        countScheduleChangeNotifications({ yearMonth }),
      ]);
      setItems(rows);
      setMonthTotal(total);
    } catch (e) {
      console.error(e);
      setItems([]);
      setMonthTotal(0);
      setLoadError(e?.message || "변동 내역을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [yearMonth]);

  useEffect(() => { load(); }, [load]);

  const filteredItems = useMemo(
    () => items.filter(item => matchesTypeFilter(item, typeFilter)),
    [items, typeFilter],
  );

  const groupedItems = useMemo(
    () => groupChangeAlerts(filteredItems),
    [filteredItems],
  );

  const unreadInView = useMemo(
    () => filteredItems.filter(i => !i.is_read).length,
    [filteredItems],
  );

  const typeCounts = useMemo(() => {
    const counts = { all: items.length };
    for (const f of TYPE_FILTERS) {
      if (f.id === "all") continue;
      counts[f.id] = items.filter(item => matchesTypeFilter(item, f.id)).length;
    }
    return counts;
  }, [items]);

  const shiftMonth = (delta) => {
    setYearMonth(prev => {
      const [yy, mm] = prev.split("-").map(Number);
      const d = new Date(yy, mm - 1 + delta, 1);
      return yearMonthKey(d);
    });
  };

  const goTodayMonth = () => setYearMonth(yearMonthKey(today));

  const markItemsRead = async (targets) => {
    const unread = targets.filter(i => !i.is_read);
    if (!unread.length) return;
    await Promise.all(unread.map(item => markScheduleChangeNotificationRead(item.id)));
    const idSet = new Set(unread.map(i => i.id));
    setItems(prev => prev.map(r => (
      idSet.has(r.id) ? { ...r, is_read: true, read_at: new Date().toISOString() } : r
    )));
  };

  const handleToggleGroup = async (group) => {
    const isOpen = expandedIds.has(group.id);
    if (isOpen) {
      setExpandedIds(prev => {
        const next = new Set(prev);
        next.delete(group.id);
        return next;
      });
      return;
    }

    setExpandedIds(prev => new Set(prev).add(group.id));
    try {
      await markItemsRead(group.items);
    } catch (e) {
      alert("확인 처리 실패: " + (e.message || "알 수 없는 오류"));
    }
  };

  const handleMarkAllRead = async () => {
    if (!unreadInView) return;
    const scope = typeFilter === "all"
      ? `${monthLabel} 전체`
      : `${monthLabel} · ${TYPE_FILTERS.find(f => f.id === typeFilter)?.label}`;
    if (!confirm(`${scope} 미확인 ${unreadInView}건을 모두 확인 처리할까요?`)) return;
    setMarking(true);
    try {
      const unreadIds = filteredItems.filter(i => !i.is_read).map(i => i.id);
      if (typeFilter === "all") {
        await markAllScheduleChangeNotificationsRead({ yearMonth });
      } else {
        await markScheduleChangeNotificationsReadByIds(unreadIds);
      }
      const idSet = new Set(unreadIds);
      setItems(prev => prev.map(r => (
        idSet.has(r.id) ? { ...r, is_read: true, read_at: new Date().toISOString() } : r
      )));
    } catch (e) {
      alert("일괄 확인 실패: " + (e.message || "알 수 없는 오류"));
    } finally {
      setMarking(false);
    }
  };

  return (
    <div className="sch-view sch-change-alerts-view">
      <header className="sch-view-header">
        <button type="button" className="sch-back-btn" onClick={onBack}>
          <ChevronLeft size={18}/> 스케줄 관리
        </button>
        <h2 className="sch-view-title">수업 변동 내역</h2>
        <div className="sch-header-actions">
          {unreadInView > 0 ? (
            <button
              type="button"
              className="sch-btn sch-btn--ghost sch-change-alerts-mark-all"
              disabled={marking}
              onClick={handleMarkAllRead}
            >
              <CheckCheck size={16}/> 이번 달 확인 ({unreadInView})
            </button>
          ) : null}
        </div>
      </header>

      <p className="sch-change-alerts-desc">
        강사가 평소 스케줄과 다르게 입력한 기록입니다 (수업 안 함, 시간·분 수정).
        공휴일 자동 처리는 포함되지 않습니다. 카드를 눌러 상세를 확인하세요.
      </p>

      <div className="sch-month-nav sch-change-alerts-month-nav">
        <button type="button" className="sch-btn sch-btn--ghost" onClick={() => shiftMonth(-1)} aria-label="이전 달">
          ←
        </button>
        <span className="sch-month-label">{monthLabel}</span>
        <button type="button" className="sch-btn sch-btn--ghost" onClick={() => shiftMonth(1)} aria-label="다음 달">
          →
        </button>
        <button type="button" className="sch-btn sch-btn--ghost sch-btn--today" onClick={goTodayMonth}>
          이번 달
        </button>
      </div>

      <div className="sch-change-alerts-filters" role="tablist" aria-label="수업 유형 필터">
        {TYPE_FILTERS.map(f => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={typeFilter === f.id}
            className={`sch-change-alerts-filter${typeFilter === f.id ? " sch-change-alerts-filter--active" : ""}`}
            onClick={() => setTypeFilter(f.id)}
          >
            {f.label}
            {typeCounts[f.id] > 0 ? (
              <span className="sch-change-alerts-filter-count">{typeCounts[f.id]}</span>
            ) : null}
          </button>
        ))}
      </div>

      <p className="sch-change-alerts-summary sch-muted">
        {loading
          ? "불러오는 중…"
          : loadError
            ? loadError
            : `${monthLabel} 변동 ${monthTotal}건 · 요약 ${groupedItems.length}건`}
      </p>

      {loadError ? (
        <div className="sch-change-alerts-empty">
          <Bell size={28} strokeWidth={1.5}/>
          <p>{loadError}</p>
          <button type="button" className="sch-btn sch-btn--ghost" onClick={load}>다시 시도</button>
        </div>
      ) : loading ? (
        <p className="sch-muted">불러오는 중…</p>
      ) : groupedItems.length === 0 ? (
        <div className="sch-change-alerts-empty">
          <Bell size={28} strokeWidth={1.5}/>
          <p>
            {items.length === 0
              ? `${monthLabel}에 변동 내역이 없습니다.`
              : "선택한 유형의 변동 내역이 없습니다."}
          </p>
          {items.length === 0 && totalUnread > 0 ? (
            <p className="sch-muted" style={{ marginTop: 8 }}>
              미확인 {totalUnread}건이 다른 달에 있습니다. ← → 버튼으로 이전 달을 확인해 보세요.
            </p>
          ) : null}
        </div>
      ) : (
        <ul className="sch-change-alerts-list">
          {groupedItems.map(group => {
            const isOpen = expandedIds.has(group.id);
            const hasUnread = group.items.some(i => !i.is_read);
            const dateRange = formatDateRange(group.dateMin, group.dateMax);
            const summaryBadges = Object.entries(group.typeCounts);

            return (
              <li
                key={group.id}
                className={`sch-change-alerts-item${hasUnread ? " sch-change-alerts-item--unread" : ""}${isOpen ? " sch-change-alerts-item--open" : ""}`}
              >
                <button
                  type="button"
                  className="sch-change-alerts-group-btn"
                  aria-expanded={isOpen}
                  onClick={() => handleToggleGroup(group)}
                >
                  <div className="sch-change-alerts-group-summary">
                    <span className="sch-change-alerts-group-main">
                      <span className="sch-change-alerts-date-range">{dateRange}</span>
                      <span className="sch-change-alerts-sep">·</span>
                      <span>{group.institutionName}</span>
                      <span className="sch-change-alerts-sep">·</span>
                      <span className="sch-change-alerts-teacher">{group.teacherName}</span>
                    </span>
                    <span className="sch-change-alerts-group-badges">
                      {summaryBadges.map(([type, count]) => (
                        <span
                          key={type}
                          className={`sch-change-alerts-type ${CHANGE_BADGE_CLASS[type] || "sch-change-alerts-type--custom"}`}
                        >
                          {CHANGE_LABELS[type] || type} {count}건
                        </span>
                      ))}
                      {group.reasonSummary ? (
                        <span className="sch-change-alerts-reason">
                          · 사유: {group.reasonSummary}
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <span className="sch-change-alerts-group-actions">
                    {hasUnread ? (
                      <span className="sch-change-alerts-unread-dot" aria-label="미확인"/>
                    ) : null}
                    <ChevronDown
                      size={18}
                      className={`sch-change-alerts-chevron${isOpen ? " sch-change-alerts-chevron--open" : ""}`}
                      aria-hidden
                    />
                  </span>
                </button>
                {isOpen ? (
                  <div className="sch-change-alerts-group-body">
                    {group.items.map(item => (
                      <ChangeAlertDetail key={item.id} item={item}/>
                    ))}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** 허브 카드용 미확인 건수 (관리자) */
export function useUnreadChangeAlertCount(enabled) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    countUnreadScheduleChangeNotifications()
      .then(n => { if (!cancelled) setCount(n); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [enabled]);

  return count;
}
