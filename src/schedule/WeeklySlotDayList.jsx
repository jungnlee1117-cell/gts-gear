import { History } from "lucide-react";
import {
  DAY_LABELS,
  classTypeLabel,
  fmtLocalDate,
  resolveInstitutionSlotPayType,
} from "./constants.js";
import {
  classGroupFromStoredLabel,
  formatSlotDateShort,
  formatSlotTime,
  slotMinutes,
} from "./weeklySlotDisplay.js";
import { weeklySlotStatus, weeklySlotStatusLabel } from "./weeklySlotVersion.js";

function classTypeTone(classType) {
  if (classType === "방과후") return "after-school";
  if (classType === "어린이집") return "daycare";
  if (classType === "센터") return "center";
  if (classType === "센터보조") return "center-assist";
  if (classType === "가정방문") return "home-visit";
  if (classType === "참관수업") return "observation";
  return "regular";
}

function compareSlots(a, b) {
  const day = Number(a.day_of_week) - Number(b.day_of_week);
  if (day !== 0) return day;
  return formatSlotTime(a.start_time).localeCompare(formatSlotTime(b.start_time));
}

/**
 * 시간표 탭과 같은 요일별 슬롯 행.
 * selectable이면 체크, 아니면 이력 버튼.
 */
export default function WeeklySlotDayList({
  slots = [],
  teacherName = () => "—",
  selectable = false,
  selectedIds,
  onToggle,
  onToggleDay,
  onHistory,
  emptyText = "담당 중인 수업이 없습니다.",
}) {
  const today = fmtLocalDate(new Date());
  const ordered = [...slots].sort(compareSlots);
  const groups = DAY_LABELS.map((day, dayIndex) => ({
    day,
    dayIndex,
    rows: ordered.filter((slot) => Number(slot.day_of_week) === dayIndex),
  })).filter((group) => group.rows.length > 0);

  if (!groups.length) {
    return <p className="sch-muted sch-teacher-slot-empty">{emptyText}</p>;
  }

  return (
    <div className="sch-regular-classes-day-list">
      {groups.map((group) => {
        const dayIds = group.rows.map((slot) => slot.id);
        const dayChecked = selectable && dayIds.every((id) => selectedIds?.has(id));
        return (
          <section
            key={group.dayIndex}
            className={`sch-regular-classes-day sch-regular-classes-day--${group.dayIndex}`}
          >
            <header className="sch-regular-classes-day-header">
              <div className="sch-regular-classes-day-title">
                {selectable ? (
                  <input
                    type="checkbox"
                    checked={dayChecked}
                    aria-label={`${group.day}요일 수업 전체 선택`}
                    onChange={() => onToggleDay?.(dayIds, !dayChecked)}
                  />
                ) : null}
                <span className="sch-regular-classes-day-badge">{group.day}</span>
                <strong>{group.day}요일 수업</strong>
              </div>
              <span>{group.rows.length}개 수업</span>
            </header>
            <div className="sch-regular-classes-table-wrap">
              <div className="sch-regular-classes-table-head" aria-hidden="true">
                {selectable ? <span/> : null}
                <span>시간</span>
                <span>유형</span>
                <span>반(연령)</span>
                <span>선생님</span>
                <span>적용 기간</span>
                <span>상태</span>
                {selectable ? null : <span>관리</span>}
              </div>
              <ul className="sch-regular-classes-list">
                {group.rows.map((slot) => {
                  const status = weeklySlotStatus(slot, today);
                  const payType = resolveInstitutionSlotPayType(slot);
                  const checked = Boolean(selectedIds?.has(slot.id));
                  return (
                    <li
                      key={slot.id}
                      className={`sch-regular-classes-item sch-regular-classes-item--row sch-regular-classes-item--${status}`}
                    >
                      {selectable ? (
                        <input
                          type="checkbox"
                          checked={checked}
                          aria-label={`${group.day} ${formatSlotTime(slot.start_time)} 수업 선택`}
                          onChange={() => onToggle?.(slot.id)}
                        />
                      ) : null}
                      <span className="sch-regular-classes-time-block">
                        <strong>{formatSlotTime(slot.start_time)}–{formatSlotTime(slot.end_time)}</strong>
                        <small>{slotMinutes(slot)}분</small>
                      </span>
                      <span className={`sch-regular-classes-type sch-regular-classes-type--${classTypeTone(payType)}`}>
                        {classTypeLabel(payType)}
                      </span>
                      <span className="sch-regular-classes-class-label">
                        {classGroupFromStoredLabel(slot.label) || "—"}
                      </span>
                      <span className="sch-regular-classes-teacher">
                        {teacherName(slot.teacher_id)}
                      </span>
                      <span className="sch-regular-classes-range">
                        {formatSlotDateShort(slot.effective_from)} ~ {slot.effective_to ? formatSlotDateShort(slot.effective_to) : "계속"}
                      </span>
                      <span className={`sch-regular-classes-status sch-regular-classes-status--${status}`}>
                        {weeklySlotStatusLabel(status)}
                      </span>
                      {selectable ? null : (
                        <div className="sch-regular-classes-actions">
                          <button
                            type="button"
                            className="sch-btn sch-btn--ghost sch-btn--sm"
                            title="변경 이력"
                            onClick={() => onHistory?.(slot)}
                          >
                            <History size={13}/> 이력
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        );
      })}
    </div>
  );
}
