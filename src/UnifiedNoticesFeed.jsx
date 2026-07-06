import { useMemo, useState } from "react";
import { Megaphone } from "lucide-react";
import {
  UNIFIED_NOTICE_TYPE_LABELS,
  UNIFIED_NOTICE_TYPE_TONES,
  formatDdayLabel,
} from "./unifiedNotices.js";

const DEFAULT_PREVIEW_COUNT = 5;

function isCreatedToday(createdAt) {
  if (!createdAt) return false;
  const d = new Date(createdAt);
  const now = new Date();
  return d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate();
}

function FeedRow({ item, onClick }) {
  const tone = UNIFIED_NOTICE_TYPE_TONES[item.type] || "general";
  const label = UNIFIED_NOTICE_TYPE_LABELS[item.type] || "일반";
  const dday = item.eventDate
    ? formatDdayLabel(item.eventDate)
    : (item.type === "urgent" && isCreatedToday(item.createdAt) ? "오늘" : "");

  return (
    <button type="button" className="hub-unified-row" onClick={() => onClick(item)}>
      <span className="hub-unified-row__main">
        <span className="hub-unified-row__top">
          <span className={`hub-feed-tag hub-feed-tag--${tone}`}>{label}</span>
          <span className="hub-unified-row__title">{item.title}</span>
        </span>
        {item.subtitle ? (
          <span className="hub-unified-row__sub">{item.subtitle}</span>
        ) : null}
      </span>
      {dday ? <span className="hub-unified-row__dday">{dday}</span> : null}
    </button>
  );
}

function ExceptionDetailModal({ item, onClose }) {
  if (!item?.raw) return null;
  const ex = item.raw;
  return (
    <div className="hub-modal-backdrop" onClick={onClose}>
      <div className="hub-modal hub-modal--sm" onClick={e => e.stopPropagation()}>
        <div className="hub-modal__head">
          <h3 className="hub-modal__title">{UNIFIED_NOTICE_TYPE_LABELS[item.type]} 안내</h3>
          <button type="button" className="hub-modal__close" onClick={onClose}>닫기</button>
        </div>
        <div className="hub-event-detail">
          {ex.institutions?.name ? (
            <p className="hub-event-detail__inst">{ex.institutions.name}</p>
          ) : null}
          <p className="hub-event-detail__text">{item.title}</p>
          <p className="hub-event-detail__meta">{item.subtitle}</p>
          {ex.note?.trim() && ex.note.trim() !== item.title ? (
            <p className="hub-event-detail__note">{ex.note.trim()}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function UnifiedNoticesFeed({
  items,
  loading = false,
  previewCount = DEFAULT_PREVIEW_COUNT,
  onSelectNotice,
  onViewAll,
  canManage = false,
  onEditNotice,
  onDeleteNotice,
  compact = false,
}) {
  const [showAll, setShowAll] = useState(false);
  const [detailException, setDetailException] = useState(null);

  const preview = useMemo(
    () => (items || []).slice(0, previewCount),
    [items, previewCount],
  );

  const handleRowClick = (item) => {
    if (item.source === "notice") {
      onSelectNotice?.(item.raw);
      return;
    }
    setDetailException(item);
  };

  const handleViewAll = () => {
    if (onViewAll) {
      onViewAll();
      return;
    }
    setShowAll(true);
  };

  return (
    <>
      <article className={`hub-panel-card hub-panel-card--unified${compact ? " hub-panel-card--compact" : ""}`}>
        <header className="hub-panel-card__head hub-panel-card__head--split">
          <div className="hub-panel-card__head-left">
            <span className="hub-panel-card__icon hub-panel-card__icon--outline">
              <Megaphone size={18} strokeWidth={2} aria-hidden/>
            </span>
            <h2 className="hub-panel-card__title">공지사항</h2>
          </div>
          {(items?.length || 0) > 0 ? (
            <button type="button" className="hub-panel-card__view-all" onClick={handleViewAll}>
              전체 보기 &gt;
            </button>
          ) : null}
        </header>

        {loading ? (
          <div className="hub-panel-card__empty hub-panel-card__empty--compact">공지를 불러오는 중...</div>
        ) : (items?.length || 0) === 0 ? (
          <div className="hub-panel-card__empty hub-panel-card__empty--compact">등록된 공지가 없습니다.</div>
        ) : (
          <div className="hub-feed-list hub-feed-list--unified">
            {preview.map(item => (
              <FeedRow key={item.id} item={item} onClick={handleRowClick}/>
            ))}
          </div>
        )}
      </article>

      {showAll && (
        <div className="hub-modal-backdrop" onClick={() => setShowAll(false)}>
          <div className="hub-modal" onClick={e => e.stopPropagation()}>
            <div className="hub-modal__head">
              <h3 className="hub-modal__title">공지사항 전체</h3>
              <button type="button" className="hub-modal__close" onClick={() => setShowAll(false)}>닫기</button>
            </div>
            <div className="hub-feed-list hub-feed-list--modal hub-feed-list--unified">
              {(items || []).map(item => (
                <div key={item.id} className="hub-feed-row-wrap">
                  <FeedRow
                    item={item}
                    onClick={feedItem => {
                      setShowAll(false);
                      handleRowClick(feedItem);
                    }}
                  />
                  {canManage && item.source === "notice" ? (
                    <div className="hub-feed-row__admin">
                      <button type="button" onClick={() => { setShowAll(false); onEditNotice?.(item.raw); }}>수정</button>
                      <button type="button" onClick={() => onDeleteNotice?.(item.raw.id)}>삭제</button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {detailException ? (
        <ExceptionDetailModal item={detailException} onClose={() => setDetailException(null)}/>
      ) : null}
    </>
  );
}
