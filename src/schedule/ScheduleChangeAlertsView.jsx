import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, ChevronLeft, CheckCheck } from "lucide-react";
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

const TYPE_FILTERS = [
  { id: "all", label: "전체" },
  ...PAY_TYPES.map(t => ({ id: t, label: t })),
  { id: "personal", label: "개인레슨" },
];

function formatAlertDate(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${y}년 ${m}월 ${d}일 (${DAY_LABELS[dt.getDay()]})`;
}

function formatCreatedAt(iso) {
  if (!iso) return "";
  const dt = new Date(iso);
  return `${dt.getFullYear()}.${dt.getMonth() + 1}.${dt.getDate()} ${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
}

const CHANGE_LABELS = {
  skipped: "수업 안 함",
  custom: "시간·분 수정",
  extra_added: "스케줄 외 추가",
};

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

export default function ScheduleChangeAlertsView({ onBack }) {
  const today = new Date();
  const [yearMonth, setYearMonth] = useState(yearMonthKey(today));
  const [typeFilter, setTypeFilter] = useState("all");
  const [items, setItems] = useState([]);
  const [monthTotal, setMonthTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);

  const [y, m] = yearMonth.split("-").map(Number);
  const monthLabel = `${y}년 ${m}월`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, total] = await Promise.all([
        fetchScheduleChangeNotifications({ yearMonth }),
        countScheduleChangeNotifications({ yearMonth }),
      ]);
      setItems(rows);
      setMonthTotal(total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [yearMonth]);

  useEffect(() => { load(); }, [load]);

  const filteredItems = useMemo(
    () => items.filter(item => matchesTypeFilter(item, typeFilter)),
    [items, typeFilter],
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

  const handleMarkRead = async (item) => {
    if (item.is_read) return;
    try {
      const updated = await markScheduleChangeNotificationRead(item.id);
      setItems(prev => prev.map(r => (r.id === item.id ? { ...r, ...updated } : r)));
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
        공휴일 자동 처리는 포함되지 않습니다. 한 번 생성된 내역은 삭제되지 않습니다.
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
          : `${monthLabel} 변동 ${monthTotal}건 · 표시 ${filteredItems.length}건`}
      </p>

      {loading ? (
        <p className="sch-muted">불러오는 중…</p>
      ) : filteredItems.length === 0 ? (
        <div className="sch-change-alerts-empty">
          <Bell size={28} strokeWidth={1.5}/>
          <p>
            {items.length === 0
              ? `${monthLabel}에 변동 내역이 없습니다.`
              : "선택한 유형의 변동 내역이 없습니다."}
          </p>
        </div>
      ) : (
        <ul className="sch-change-alerts-list">
          {filteredItems.map(item => {
            const payType = resolveNotificationPayType(item);
            return (
              <li
                key={item.id}
                className={`sch-change-alerts-item${item.is_read ? "" : " sch-change-alerts-item--unread"}`}
              >
                <button
                  type="button"
                  className="sch-change-alerts-item-btn"
                  onClick={() => handleMarkRead(item)}
                >
                  <div className="sch-change-alerts-item-head">
                    <span className="sch-change-alerts-teacher">
                      {item.teachers?.name || "강사"}
                    </span>
                    {payType ? (
                      <span className="sch-change-alerts-pay-type">{payType}</span>
                    ) : null}
                    <span className={`sch-change-alerts-type sch-change-alerts-type--${item.change_type}`}>
                      {CHANGE_LABELS[item.change_type] || item.change_type}
                    </span>
                    {!item.is_read ? (
                      <span className="sch-change-alerts-unread-dot" aria-label="미확인"/>
                    ) : null}
                  </div>
                  <div className="sch-change-alerts-meta">
                    <span>{formatAlertDate(item.class_date)}</span>
                    <span className="sch-change-alerts-sep">·</span>
                    <span>{institutionLabel(item)}</span>
                    <span className="sch-change-alerts-sep">·</span>
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
                  </div>
                  {!item.is_read ? (
                    <span className="sch-change-alerts-hint">탭하여 확인</span>
                  ) : null}
                </button>
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
