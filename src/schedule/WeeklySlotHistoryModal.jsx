import { useMemo } from "react";
import { fmtLocalDate } from "./constants.js";
import {
  formatSlotChangedAt,
  formatSlotDateShort,
  slotChangeSummary,
} from "./weeklySlotDisplay.js";
import {
  historyRowsForSlot,
  weeklySlotStatus,
  weeklySlotStatusLabel,
} from "./weeklySlotVersion.js";

/** 시간표 탭의 수업 변경 이력과 같은 시리즈 조회. */
export default function WeeklySlotHistoryModal({
  slot,
  slots = [],
  institutionName = "",
  teacherName = () => "—",
  onClose,
}) {
  const rows = useMemo(
    () => historyRowsForSlot(slots, slot),
    [slots, slot],
  );
  const today = fmtLocalDate(new Date());

  if (!slot) return null;

  return (
    <div className="sch-modal-overlay" onClick={onClose}>
      <section className="sch-modal sch-modal--wide" onClick={(event) => event.stopPropagation()}>
        <div className="sch-section-header-row">
          <div>
            <h3>수업 변경 이력</h3>
            <p className="sch-muted">
              {institutionName || slot.institutions?.name || "기관"}
            </p>
          </div>
          <button type="button" className="sch-btn sch-btn--ghost" onClick={onClose}>닫기</button>
        </div>
        <div className="sch-regular-classes-history-list">
          {rows.map((row, index) => {
            const status = weeklySlotStatus(row, today);
            const previous = rows[index + 1] || null;
            return (
              <article key={row.id} className="sch-regular-classes-history-row">
                <div>
                  <strong>{index === 0 ? "최근 기록" : `이전 기록 ${index}`}</strong>
                  <span className={`sch-regular-classes-status sch-regular-classes-status--${status}`}>
                    {weeklySlotStatusLabel(status)}
                  </span>
                </div>
                {previous ? (
                  <div className="sch-regular-classes-history-compare">
                    <div>
                      <span>변경 전</span>
                      <p>{slotChangeSummary(previous, teacherName)}</p>
                    </div>
                    <span className="sch-regular-classes-history-arrow" aria-hidden="true">→</span>
                    <div>
                      <span>변경 후</span>
                      <p>{slotChangeSummary(row, teacherName)}</p>
                    </div>
                  </div>
                ) : (
                  <p className="sch-regular-classes-history-first">
                    최초 등록 · {slotChangeSummary(row, teacherName)}
                  </p>
                )}
                <dl className="sch-regular-classes-history-details">
                  <div>
                    <dt>적용 기간</dt>
                    <dd>{formatSlotDateShort(row.effective_from)} ~ {row.effective_to ? formatSlotDateShort(row.effective_to) : "계속"}</dd>
                  </div>
                  <div>
                    <dt>변경 사유</dt>
                    <dd>{row.change_reason || (previous ? "수업 조건 변경" : "최초 등록")}</dd>
                  </div>
                  <div>
                    <dt>처리자</dt>
                    <dd>{row.changed_by ? teacherName(row.changed_by) : "기존 등록 자료"}</dd>
                  </div>
                  <div>
                    <dt>처리 일시</dt>
                    <dd>{formatSlotChangedAt(row.updated_at || row.created_at)}</dd>
                  </div>
                </dl>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
