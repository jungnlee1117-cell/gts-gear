import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Megaphone } from "lucide-react";
import { fetchScheduleExceptions } from "./schedule/api.js";
import { EXCEPTION_LABELS, yearMonthLastDay } from "./schedule/constants.js";
import {
  filterExceptionsForMonth,
  formatExceptionNotice,
} from "./schedule/scheduleExceptions.js";

const PREVIEW_COUNT = 3;

function eventTone(type) {
  if (type === "cancelled") return "cancelled";
  if (type === "event") return "event";
  return "other";
}

function EventRow({ item, onClick }) {
  const tone = eventTone(item.exception_type);
  const label = EXCEPTION_LABELS[item.exception_type] || item.exception_type;
  const text = formatExceptionNotice(item);

  return (
    <button type="button" className="hub-feed-row" onClick={() => onClick(item)}>
      <span className="hub-feed-row__body">
        <span className="hub-feed-row__line">
          <span className={`hub-feed-tag hub-feed-tag--${tone}`}>{label}</span>
          <span className="hub-feed-row__title">{text}</span>
        </span>
        {item.institutions?.name ? (
          <span className="hub-feed-row__meta">{item.institutions.name}</span>
        ) : null}
      </span>
      <ChevronRight size={16} className="hub-feed-row__chev" aria-hidden />
    </button>
  );
}

function EventDetailModal({ item, onClose }) {
  if (!item) return null;
  const label = EXCEPTION_LABELS[item.exception_type] || item.exception_type;

  return (
    <div className="hub-modal-backdrop" onClick={onClose}>
      <div className="hub-modal hub-modal--sm" onClick={e => e.stopPropagation()}>
        <div className="hub-modal__head">
          <h3 className="hub-modal__title">{label} 안내</h3>
          <button type="button" className="hub-modal__close" onClick={onClose}>닫기</button>
        </div>
        <div className="hub-event-detail">
          {item.institutions?.name ? (
            <p className="hub-event-detail__inst">{item.institutions.name}</p>
          ) : null}
          <p className="hub-event-detail__text">{formatExceptionNotice(item)}</p>
          {item.note?.trim() ? (
            <p className="hub-event-detail__note">{item.note.trim()}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function GearInstitutionEventsSection() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const [exceptions, setExceptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
    const monthStart = `${monthKey}-01`;
    const monthEnd = yearMonthLastDay(monthKey);

    fetchScheduleExceptions(null, monthStart, monthEnd)
      .then(rows => {
        if (!cancelled) setExceptions(rows || []);
      })
      .catch(() => {
        if (!cancelled) setExceptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [year, month]);

  const items = useMemo(
    () => filterExceptionsForMonth(exceptions, year, month),
    [exceptions, year, month],
  );

  const preview = items.slice(0, PREVIEW_COUNT);

  return (
    <>
      <article className="hub-panel-card">
        <header className="hub-panel-card__head">
          <span className="hub-panel-card__icon hub-panel-card__icon--green">
            <Megaphone size={18} strokeWidth={2.2} aria-hidden />
          </span>
          <h2 className="hub-panel-card__title">원 행사·휴원 안내</h2>
        </header>

        {loading ? (
          <div className="hub-panel-card__empty">안내를 불러오는 중...</div>
        ) : items.length === 0 ? (
          <div className="hub-panel-card__empty">이번 달 등록된 행사·휴원 안내가 없습니다.</div>
        ) : (
          <div className="hub-feed-list">
            {preview.map(ex => (
              <EventRow key={ex.id} item={ex} onClick={setDetail} />
            ))}
          </div>
        )}

        {items.length > 0 && (
          <button type="button" className="hub-panel-card__footer-link" onClick={() => setShowAll(true)}>
            전체 일정 보기 →
          </button>
        )}
      </article>

      {showAll && (
        <div className="hub-modal-backdrop" onClick={() => setShowAll(false)}>
          <div className="hub-modal" onClick={e => e.stopPropagation()}>
            <div className="hub-modal__head">
              <h3 className="hub-modal__title">{year}년 {month + 1}월 행사·휴원</h3>
              <button type="button" className="hub-modal__close" onClick={() => setShowAll(false)}>닫기</button>
            </div>
            <div className="hub-feed-list hub-feed-list--modal">
              {items.map(ex => (
                <EventRow key={ex.id} item={ex} onClick={item => { setShowAll(false); setDetail(item); }} />
              ))}
            </div>
          </div>
        </div>
      )}

      {detail && <EventDetailModal item={detail} onClose={() => setDetail(null)} />}
    </>
  );
}
