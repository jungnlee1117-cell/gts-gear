import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  DAY_LABELS,
  fmtLocalDate,
  getMonthGrid,
  isSameDay,
  yearMonthKey,
} from "./constants.js";
import { isDateConfirmable } from "./payrollCalendar.js";
import { ClassIncidentReplies, ClassIncidentStatusBadge } from "./ClassIncidentSlotForm.jsx";
import { ClassIncidentCategoryBadge, ClassIncidentStructuredLine } from "./ClassIncidentCategoryFields.jsx";
import { formatIncidentDate, formatIncidentWhen } from "./classIncidentReports.js";
import { isSafetyIncident, sortIncidentRowsForAdmin } from "./classIncidentCategories.js";

function names(people) {
  return people.length ? people.map((person) => person.name).join(", ") : "없음";
}

function entryLabel(row) {
  const pay = row.payroll_entries?.pay_type;
  const mins = row.payroll_entries?.minutes;
  const parts = [];
  if (pay) parts.push(pay);
  if (mins != null) parts.push(`${mins}분`);
  return parts.join(" · ");
}

export default function ClassIncidentCheckCalendar({
  yearMonth,
  selectedDate,
  onChangeMonth,
  onSelectDate,
  checkByDate,
  incidentMap,
  me,
  onReview,
  onIncidentChanged,
  savingId,
}) {
  const { year, month } = (() => {
    const [y, m] = String(yearMonth || "").split("-").map(Number);
    return { year: y || new Date().getFullYear(), month: (m || 1) - 1 };
  })();
  const grid = getMonthGrid(year, month);
  const today = new Date();
  const todayStr = fmtLocalDate(today);
  const selectedCheck = checkByDate.get(selectedDate) || { checked: [], unchecked: [] };
  const selectedIncidents = sortIncidentRowsForAdmin(incidentMap.get(selectedDate) || []);

  return (
    <section className="sch-incident-calendar" aria-label="수업 체크·특이사항 달력">
      <div className="sch-month-nav">
        <button
          type="button"
          className="sch-btn sch-btn--ghost"
          onClick={() => onChangeMonth(-1)}
          aria-label="이전 달"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="sch-month-label">{year}년 {month + 1}월</span>
        <button
          type="button"
          className="sch-btn sch-btn--ghost"
          onClick={() => onChangeMonth(1)}
          aria-label="다음 달"
        >
          <ChevronRight size={16} />
        </button>
        <button
          type="button"
          className="sch-btn sch-btn--ghost sch-btn--today"
          onClick={() => onChangeMonth(0, yearMonthKey(today))}
        >
          오늘
        </button>
      </div>

      <div className="sch-cal-legend sch-incident-calendar-legend">
        <span className="sch-cal-legend-item">
          <span className="sch-incident-dot sch-incident-dot--unchecked" />
          미체크 있음
        </span>
        <span className="sch-cal-legend-item">
          <span className="sch-incident-dot sch-incident-dot--report" />
          특이사항
        </span>
        <span className="sch-cal-legend-item">
          <span className="sch-incident-dot sch-incident-dot--safety" />
          안전사고
        </span>
      </div>

      <div className="sch-cal-grid sch-incident-cal-grid" role="grid" aria-label={`${year}년 ${month + 1}월 체크 현황`}>
        <div className="sch-cal-head-row" role="row">
          {DAY_LABELS.map((label, index) => (
            <div
              key={label}
              className={`sch-cal-head-cell${index === 0 || index === 6 ? " sch-cal-head-cell--weekend" : ""}`}
              role="columnheader"
            >
              {label}
            </div>
          ))}
        </div>
        <div className="sch-cal-body">
          {grid.map(({ date, inMonth }) => {
            const dateStr = fmtLocalDate(date);
            const dayCheck = checkByDate.get(dateStr) || { checked: [], unchecked: [] };
            const reports = incidentMap.get(dateStr) || [];
            const showUnchecked = inMonth
              && isDateConfirmable(dateStr, today)
              && dayCheck.unchecked.length > 0;
            const showReports = inMonth && reports.length > 0;
            const showSafety = showReports && reports.some(isSafetyIncident);
            return (
              <button
                key={dateStr}
                type="button"
                role="gridcell"
                className={[
                  "sch-cal-cell",
                  !inMonth && "sch-cal-cell--muted",
                  isSameDay(date, today) && "sch-cal-cell--today",
                  dateStr === selectedDate && "sch-cal-cell--selected",
                  showUnchecked && "sch-incident-cal-cell--unchecked",
                  showSafety && "sch-incident-cal-cell--safety",
                ].filter(Boolean).join(" ")}
                onClick={() => {
                  if (!inMonth) {
                    onChangeMonth(0, yearMonthKey(date), dateStr);
                    return;
                  }
                  onSelectDate(dateStr);
                }}
                aria-label={`${date.getMonth() + 1}월 ${date.getDate()}일${showUnchecked ? ` 미체크 ${dayCheck.unchecked.length}명` : ""}${showReports ? ` 특이사항 ${reports.length}건` : ""}${showSafety ? " 안전사고" : ""}`}
                aria-selected={dateStr === selectedDate}
              >
                <span className="sch-cal-day-num">{date.getDate()}</span>
                {inMonth && (showUnchecked || showReports) ? (
                  <span className="sch-incident-cal-dots" aria-hidden>
                    {showUnchecked ? <i className="sch-incident-dot sch-incident-dot--unchecked" /> : null}
                    {showReports && !showSafety ? <i className="sch-incident-dot sch-incident-dot--report" /> : null}
                    {showSafety ? <i className="sch-incident-dot sch-incident-dot--safety" /> : null}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="sch-incident-day-panel">
        <h3 className="sch-incident-day-title">
          {selectedDate.replaceAll("-", ".")} 체크 현황
          {selectedDate === todayStr ? " · 오늘" : ""}
        </h3>
        <div className="sch-incident-check-groups">
          <p className="sch-incident-check-line is-done">
            <strong>체크완료</strong>
            <span>{names(selectedCheck.checked)}</span>
          </p>
          <p className="sch-incident-check-line is-pending">
            <strong>미체크</strong>
            <span>{names(selectedCheck.unchecked)}</span>
          </p>
        </div>

        <h4 className="sch-incident-day-subtitle">그날 특이사항 {selectedIncidents.length}건</h4>
        {selectedIncidents.length === 0 ? (
          <p className="sch-muted">이 날짜에 등록된 특이사항이 없습니다.</p>
        ) : (
          <ul className="sch-incident-list sch-incident-day-list">
            {selectedIncidents.map((row) => (
              <li key={row.id} className={`sch-incident-card${isSafetyIncident(row) ? " sch-incident-card--safety" : ""}`}>
                <div className="sch-incident-card-head">
                  <span className="sch-incident-card-main">
                    <span className="sch-incident-card-title">
                      {row.teachers?.name || "선생님"}
                      {row.institutions?.name ? ` · ${row.institutions.name}` : ""}
                    </span>
                    <span className="sch-incident-card-sub">
                      {[formatIncidentDate(row.class_date), entryLabel(row)].filter(Boolean).join(" · ")}
                    </span>
                    <ClassIncidentStructuredLine row={row} />
                    <p className="sch-incident-body">{row.body}</p>
                    <p className="sch-muted">
                      작성 {formatIncidentWhen(row.created_at)}
                      {row.reviewed_at ? ` · 확인 ${formatIncidentWhen(row.reviewed_at)}` : ""}
                    </p>
                  </span>
                  <span className="sch-incident-card-badges">
                    <ClassIncidentCategoryBadge
                      category={row.incident_category}
                      subtype={row.incident_subtype}
                    />
                    <ClassIncidentStatusBadge status={row.status} />
                  </span>
                </div>
                <div className="sch-incident-card-body">
                  <ClassIncidentReplies
                    report={row}
                    me={me}
                    canReply
                    onChanged={onIncidentChanged}
                  />
                  {row.status === "needs_review" ? (
                    <button
                      type="button"
                      className="sch-btn sch-btn--primary sch-btn--sm"
                      disabled={savingId === row.id}
                      onClick={() => onReview(row.id)}
                    >
                      {savingId === row.id ? "처리 중..." : "확인함"}
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
