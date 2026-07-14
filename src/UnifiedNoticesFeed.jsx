import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Megaphone } from "lucide-react";
import {
  UNIFIED_NOTICE_TYPE_LABELS,
  UNIFIED_NOTICE_TYPE_TONES,
  formatDdayLabel,
} from "./unifiedNotices.js";
import { EXCEPTION_LABELS } from "./schedule/constants.js";
import {
  deleteScheduleException,
  fetchInstitutions,
  saveScheduleException,
} from "./schedule/api.js";

const DEFAULT_PREVIEW_COUNT = 5;
const TABLE_PAGE_SIZE = 8;

function isCreatedToday(createdAt) {
  if (!createdAt) return false;
  const d = new Date(createdAt);
  const now = new Date();
  return d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate();
}

function fmtDateWeekday(d) {
  if (!d) return "-";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "-";
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}.${m}.${day} (${days[dt.getDay()]})`;
}

function noticeAuthor(item) {
  if (item.source === "notice" && item.raw?.author_name) return item.raw.author_name;
  if (item.source === "exception" && item.raw?.institutions?.name) return item.raw.institutions.name;
  return "시스템";
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

function ExceptionEditModal({ exception, onClose, onSaved }) {
  const [institutions, setInstitutions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    id: exception?.id,
    institution_id: exception?.institution_id || "",
    start_date: exception?.exception_date || "",
    end_date: exception?.end_date && exception?.end_date !== exception?.exception_date
      ? exception.end_date
      : "",
    exception_type: exception?.exception_type || "event",
    note: exception?.note || "",
  });

  useEffect(() => {
    let cancelled = false;
    fetchInstitutions()
      .then((rows) => { if (!cancelled) setInstitutions(rows || []); })
      .catch(() => { if (!cancelled) setInstitutions([]); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!exception) return;
    setForm({
      id: exception.id,
      institution_id: exception.institution_id || "",
      start_date: exception.exception_date || "",
      end_date: exception.end_date && exception.end_date !== exception.exception_date
        ? exception.end_date
        : "",
      exception_type: exception.exception_type || "event",
      note: exception.note || "",
    });
  }, [exception]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.institution_id) return alert("원을 선택해주세요.");
    if (!form.start_date) return alert("시작일을 입력해주세요.");
    if (!form.note.trim()) return alert("내용을 입력해주세요.");
    const end = form.end_date || form.start_date;
    if (end < form.start_date) return alert("종료일은 시작일 이후여야 합니다.");
    setSaving(true);
    try {
      const payload = {
        id: form.id,
        institution_id: form.institution_id,
        exception_date: form.start_date,
        end_date: form.end_date && form.end_date !== form.start_date ? form.end_date : null,
        exception_type: form.exception_type,
        note: form.note.trim(),
      };
      await saveScheduleException(payload);
      onSaved?.();
      onClose();
    } catch (err) {
      alert(err?.message || "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (!exception) return null;

  return (
    <div className="hub-modal-backdrop" onClick={onClose}>
      <div className="hub-modal hub-modal--sm" onClick={e => e.stopPropagation()}>
        <div className="hub-modal__head">
          <h3 className="hub-modal__title">행사·휴원 수정</h3>
          <button type="button" className="hub-modal__close" onClick={onClose}>닫기</button>
        </div>
        <form className="hub-exception-edit" onSubmit={submit}>
          <label className="hub-exception-edit__field">
            <span>원 *</span>
            <select
              required
              value={form.institution_id}
              onChange={e => setForm(f => ({ ...f, institution_id: e.target.value }))}
            >
              <option value="">원 선택</option>
              {institutions.map(inst => (
                <option key={inst.id} value={inst.id}>{inst.name}</option>
              ))}
            </select>
          </label>
          <div className="hub-exception-edit__row">
            <label className="hub-exception-edit__field">
              <span>시작일 *</span>
              <input
                type="date"
                required
                value={form.start_date}
                onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
              />
            </label>
            <label className="hub-exception-edit__field">
              <span>종료일</span>
              <input
                type="date"
                value={form.end_date}
                min={form.start_date || undefined}
                onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
              />
            </label>
          </div>
          <label className="hub-exception-edit__field">
            <span>유형 *</span>
            <select
              value={form.exception_type}
              onChange={e => setForm(f => ({ ...f, exception_type: e.target.value }))}
            >
              {Object.entries(EXCEPTION_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
          <label className="hub-exception-edit__field">
            <span>내용 *</span>
            <input
              type="text"
              required
              placeholder="예: 여름방학, 현장학습, 원 휴원"
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
            />
          </label>
          <div className="hub-exception-edit__actions">
            <button type="button" className="hub-modal__close" onClick={onClose} disabled={saving}>취소</button>
            <button type="submit" className="admin-notice-compose-btn" disabled={saving}>
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ExceptionDetailModal({ item, onClose, canManage, onEdit, onDelete }) {
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
        {canManage ? (
          <div className="hub-feed-row__admin" style={{ padding: "0 4px 4px", marginTop: 12 }}>
            <button type="button" onClick={() => { onClose(); onEdit?.(ex); }}>✏️ 수정</button>
            <button type="button" onClick={() => {
              if (confirm("이 안내를 삭제할까요?")) onDelete?.(ex.id);
            }}>🗑️ 삭제</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TableBadge({ type }) {
  const tone = UNIFIED_NOTICE_TYPE_TONES[type] || "general";
  const label = UNIFIED_NOTICE_TYPE_LABELS[type] || "일반";
  return <span className={`admin-notice-badge admin-notice-badge--${tone}`}>{label}</span>;
}

function ManageActions({ item, onEditNotice, onDeleteNotice, onEditException, onDeleteException }) {
  if (item.source === "notice") {
    return (
      <>
        <button
          type="button"
          className="admin-notice-action-btn"
          title="수정"
          aria-label="수정"
          onClick={() => onEditNotice?.(item.raw)}
        >
          ✏️
        </button>
        <button
          type="button"
          className="admin-notice-action-btn"
          title="삭제"
          aria-label="삭제"
          onClick={() => {
            if (confirm("이 공지를 삭제할까요?")) onDeleteNotice?.(item.raw.id);
          }}
        >
          🗑️
        </button>
      </>
    );
  }
  if (item.source === "exception") {
    return (
      <>
        <button
          type="button"
          className="admin-notice-action-btn"
          title="수정"
          aria-label="수정"
          onClick={() => onEditException?.(item.raw)}
        >
          ✏️
        </button>
        <button
          type="button"
          className="admin-notice-action-btn"
          title="삭제"
          aria-label="삭제"
          onClick={() => onDeleteException?.(item.raw.id)}
        >
          🗑️
        </button>
      </>
    );
  }
  return null;
}

function FeedManageActions({ item, onEditNotice, onDeleteNotice, onEditException, onDeleteException, beforeAction }) {
  if (item.source === "notice") {
    return (
      <div className="hub-feed-row__admin">
        <button type="button" onClick={() => { beforeAction?.(); onEditNotice?.(item.raw); }}>✏️ 수정</button>
        <button type="button" onClick={() => {
          if (confirm("이 공지를 삭제할까요?")) onDeleteNotice?.(item.raw.id);
        }}>🗑️ 삭제</button>
      </div>
    );
  }
  if (item.source === "exception") {
    return (
      <div className="hub-feed-row__admin">
        <button type="button" onClick={() => { beforeAction?.(); onEditException?.(item.raw); }}>✏️ 수정</button>
        <button type="button" onClick={() => onDeleteException?.(item.raw.id)}>🗑️ 삭제</button>
      </div>
    );
  }
  return null;
}

export default function UnifiedNoticesFeed({
  items,
  loading = false,
  previewCount = DEFAULT_PREVIEW_COUNT,
  onSelectNotice,
  onViewAll,
  onCompose,
  canManage = false,
  onEditNotice,
  onDeleteNotice,
  onExceptionMutated,
  compact = false,
  variant = "feed",
}) {
  const [showAll, setShowAll] = useState(false);
  const [detailException, setDetailException] = useState(null);
  const [editException, setEditException] = useState(null);
  const [page, setPage] = useState(1);

  const isTable = variant === "table";

  const preview = useMemo(
    () => (items || []).slice(0, previewCount),
    [items, previewCount],
  );

  const totalPages = Math.max(1, Math.ceil((items?.length || 0) / TABLE_PAGE_SIZE));
  const tableRows = useMemo(() => {
    const list = items || [];
    const start = (page - 1) * TABLE_PAGE_SIZE;
    return list.slice(start, start + TABLE_PAGE_SIZE);
  }, [items, page]);

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

  const handleDeleteException = async (id) => {
    if (!confirm("이 안내를 삭제할까요?")) return;
    try {
      await deleteScheduleException(id);
      setDetailException(null);
      onExceptionMutated?.();
    } catch (err) {
      alert(err?.message || "삭제에 실패했습니다.");
    }
  };

  const manage = canManage && Boolean(onEditNotice || onDeleteNotice || onExceptionMutated);
  const showRowActions = (item) =>
    manage && (item.source === "notice" || item.source === "exception");

  const exceptionModals = (
    <>
      {detailException ? (
        <ExceptionDetailModal
          item={detailException}
          onClose={() => setDetailException(null)}
          canManage={manage}
          onEdit={setEditException}
          onDelete={handleDeleteException}
        />
      ) : null}
      {editException ? (
        <ExceptionEditModal
          exception={editException}
          onClose={() => setEditException(null)}
          onSaved={onExceptionMutated}
        />
      ) : null}
    </>
  );

  if (isTable) {
    return (
      <>
        <article className="hub-panel-card hub-panel-card--unified admin-notice-table-card">
          <header className="hub-panel-card__head hub-panel-card__head--split">
            <div className="hub-panel-card__head-left">
              <span className="hub-panel-card__icon hub-panel-card__icon--outline">
                <Megaphone size={18} strokeWidth={2} aria-hidden/>
              </span>
              <h2 className="hub-panel-card__title">공지사항</h2>
            </div>
            <div className="admin-notice-table-actions">
              <button type="button" className="hub-panel-card__view-all" onClick={handleViewAll}>
                전체 보기 &gt;
              </button>
              {canManage && onCompose ? (
                <button type="button" className="admin-notice-compose-btn" onClick={onCompose}>
                  + 공지 작성
                </button>
              ) : null}
            </div>
          </header>

          {loading ? (
            <div className="hub-panel-card__empty">공지를 불러오는 중...</div>
          ) : (items?.length || 0) === 0 ? (
            <div className="hub-panel-card__empty">등록된 공지가 없습니다.</div>
          ) : (
            <>
              <div className="admin-notice-table-wrap">
                <div className={`admin-notice-table-head${manage ? " admin-notice-table-head--manage" : ""}`}>
                  <span>중요도</span>
                  <span>제목</span>
                  <span>작성 정보</span>
                  <span>{manage ? "관리" : ""}</span>
                </div>
                {tableRows.map(item => (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    className={`admin-notice-table-row${manage ? " admin-notice-table-row--manage" : ""}`}
                    onClick={() => handleRowClick(item)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleRowClick(item); } }}
                  >
                    <span className="admin-notice-table-row__badge"><TableBadge type={item.type}/></span>
                    <span className="admin-notice-table-row__title">
                      {item.pinned ? <span className="admin-notice-pin" aria-hidden>📌</span> : null}
                      {item.title}
                    </span>
                    <div className="admin-notice-table-row__metas">
                      <span className="admin-notice-table-row__meta">{noticeAuthor(item)}</span>
                      <span className="admin-notice-table-row__meta">{fmtDateWeekday(item.createdAt)}</span>
                    </div>
                    {showRowActions(item) ? (
                      <span className="admin-notice-table-row__actions" onClick={(e) => e.stopPropagation()}>
                        <ManageActions
                          item={item}
                          onEditNotice={onEditNotice}
                          onDeleteNotice={onDeleteNotice}
                          onEditException={setEditException}
                          onDeleteException={handleDeleteException}
                        />
                      </span>
                    ) : (
                      <span className="admin-notice-table-row__chev"><ChevronRight size={16} aria-hidden/></span>
                    )}
                  </div>
                ))}
              </div>
              {totalPages > 1 ? (
                <div className="admin-notice-pager">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                    <button
                      key={n}
                      type="button"
                      className={`admin-notice-pager__btn${page === n ? " is-active" : ""}`}
                      onClick={() => setPage(n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              ) : null}
            </>
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
                    {showRowActions(item) ? (
                      <FeedManageActions
                        item={item}
                        onEditNotice={onEditNotice}
                        onDeleteNotice={onDeleteNotice}
                        onEditException={setEditException}
                        onDeleteException={handleDeleteException}
                        beforeAction={() => setShowAll(false)}
                      />
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {exceptionModals}
      </>
    );
  }

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
                  {showRowActions(item) ? (
                    <FeedManageActions
                      item={item}
                      onEditNotice={onEditNotice}
                      onDeleteNotice={onDeleteNotice}
                      onEditException={setEditException}
                      onDeleteException={handleDeleteException}
                      beforeAction={() => setShowAll(false)}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {exceptionModals}
    </>
  );
}
