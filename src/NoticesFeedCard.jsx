import { useState } from "react";
import { ChevronRight, Megaphone } from "lucide-react";

const PREVIEW_COUNT = 3;

function noticeDisplayCategory(notice) {
  if (notice.importance === "important") {
    return { label: "공고", tone: "notice" };
  }
  if (/(안내|알림)/.test(notice.title || "")) {
    return { label: "안내", tone: "info" };
  }
  return { label: "일반", tone: "normal" };
}

function formatNoticeDate(value) {
  if (!value) return "";
  const d = new Date(value);
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
}

function NoticeRow({ notice, onClick }) {
  const cat = noticeDisplayCategory(notice);
  return (
    <button type="button" className="hub-feed-row" onClick={() => onClick(notice)}>
      <span className="hub-feed-row__body">
        <span className="hub-feed-row__line">
          <span className={`hub-feed-tag hub-feed-tag--${cat.tone}`}>[{cat.label}]</span>
          <span className="hub-feed-row__title">{notice.title}</span>
        </span>
        <span className="hub-feed-row__meta">
          {formatNoticeDate(notice.created_at)}
          {notice.author_name ? ` / ${notice.author_name}` : ""}
        </span>
      </span>
      <ChevronRight size={16} className="hub-feed-row__chev" aria-hidden />
    </button>
  );
}

export default function NoticesFeedCard({
  notices,
  onSelect,
  canManage,
  onEdit,
  onDelete,
}) {
  const [showAll, setShowAll] = useState(false);
  const sorted = [...(notices || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const preview = sorted.slice(0, PREVIEW_COUNT);

  return (
    <>
      <article className="hub-panel-card">
        <header className="hub-panel-card__head">
          <span className="hub-panel-card__icon hub-panel-card__icon--outline">
            <Megaphone size={18} strokeWidth={2} aria-hidden />
          </span>
          <h2 className="hub-panel-card__title">공지사항</h2>
        </header>

        {sorted.length === 0 ? (
          <div className="hub-panel-card__empty">등록된 공지가 없습니다.</div>
        ) : (
          <div className="hub-feed-list">
            {preview.map(n => (
              <NoticeRow key={n.id} notice={n} onClick={onSelect} />
            ))}
          </div>
        )}

        {sorted.length > 0 && (
          <button type="button" className="hub-panel-card__footer-link" onClick={() => setShowAll(true)}>
            전체 보기 →
          </button>
        )}
      </article>

      {showAll && (
        <div className="hub-modal-backdrop" onClick={() => setShowAll(false)}>
          <div className="hub-modal" onClick={e => e.stopPropagation()}>
            <div className="hub-modal__head">
              <h3 className="hub-modal__title">공지사항 전체</h3>
              <button type="button" className="hub-modal__close" onClick={() => setShowAll(false)}>닫기</button>
            </div>
            <div className="hub-feed-list hub-feed-list--modal">
              {sorted.map(n => (
                <div key={n.id} className="hub-feed-row-wrap">
                  <NoticeRow notice={n} onClick={notice => { setShowAll(false); onSelect(notice); }} />
                  {canManage && (
                    <div className="hub-feed-row__admin">
                      <button type="button" onClick={() => { setShowAll(false); onEdit(n); }}>수정</button>
                      <button type="button" onClick={() => onDelete(n.id)}>삭제</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
