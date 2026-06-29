import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, MapPin, Car } from "lucide-react";
import {
  DAY_LABELS,
  fmtLocalDate,
  getMonthGrid,
  homeVisitColor,
  institutionColor,
  isHomeVisitPlanned,
  isSameDay,
  resolveInstitutionSlotPayType,
  yearMonthKey,
} from "./constants.js";
import {
  deleteTeacherNote,
  fetchHomeVisitPatterns,
  fetchInstitutions,
  fetchPayrollEntries,
  fetchScheduleExceptions,
  fetchSubstituteAssignmentsForTeacher,
  fetchTeacherNotes,
  fetchWeeklySchedule,
  upsertTeacherNote,
} from "./api.js";
import MonthExceptionNotice from "./MonthExceptionNotice.jsx";
import { TeacherNoteDayEditor, TeacherNotesMonthList } from "./TeacherNotesPanel.jsx";
import { exceptionsForDate, formatExceptionNotice } from "./scheduleExceptions.js";
import { noteByDate } from "./teacherNotes.js";
import {
  getKoreanHoliday,
  hasHolidayDataForYear,
  holidayShortLabel,
} from "./koreanHolidays.js";
import { expandMonthSchedule, uniqueCalendarMarkersForDate } from "./payrollCalendar.js";
import { patternsForCalendarMonth } from "./homeVisitPatterns.js";
import { buildHomeVisitLegend, buildInstitutionLegend } from "./calendarLegend.js";
import { plannedSlotDisplayLabel } from "./payrollCalendar.js";
import CalendarDayStatusIcon, { calendarDayStatusKind } from "./CalendarDayStatusIcon.jsx";
import { applySubstituteOverlaysToSchedule } from "./substituteSchedule.js";

const TODAY = new Date();

export default function TeacherMonthlyScheduleView({ me, onBack }) {
  const [monthBase, setMonthBase] = useState(() => new Date(TODAY.getFullYear(), TODAY.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(() => new Date(TODAY));
  const [slots, setSlots] = useState([]);
  const [homeVisitPatterns, setHomeVisitPatterns] = useState([]);
  const [assignedInstitutions, setAssignedInstitutions] = useState([]);
  const [entries, setEntries] = useState([]);
  const [exceptions, setExceptions] = useState([]);
  const [teacherNotes, setTeacherNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [noteSaving, setNoteSaving] = useState(false);
  const [detailSlot, setDetailSlot] = useState(null);
  const [detailHomeVisit, setDetailHomeVisit] = useState(null);
  const [substituteAssignments, setSubstituteAssignments] = useState([]);

  const year = monthBase.getFullYear();
  const month = monthBase.getMonth();
  const monthLabel = `${year}년 ${month + 1}월`;
  const yearMonth = yearMonthKey(monthBase);

  const gridCells = useMemo(() => getMonthGrid(year, month), [year, month]);

  const rangeFrom = fmtLocalDate(gridCells[0].date);
  const rangeTo = fmtLocalDate(gridCells[gridCells.length - 1].date);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [w, hv, insts, ex, notes, ents, subs] = await Promise.all([
        fetchWeeklySchedule(null, me.id),
        fetchHomeVisitPatterns({ teacherId: me.id }),
        fetchInstitutions({ teacherScope: true }),
        fetchScheduleExceptions(null, rangeFrom, rangeTo),
        fetchTeacherNotes({ teacherId: me.id, fromDate: rangeFrom, toDate: rangeTo }),
        fetchPayrollEntries({ teacherId: me.id, yearMonth }),
        fetchSubstituteAssignmentsForTeacher(me.id, rangeFrom, rangeTo),
      ]);
      setSlots(w);
      setHomeVisitPatterns(hv);
      setAssignedInstitutions(insts);
      setExceptions(ex);
      setTeacherNotes(notes);
      setEntries(ents);
      setSubstituteAssignments(subs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [me.id, rangeFrom, rangeTo, yearMonth]);

  useEffect(() => { load(); }, [load]);

  const monthHomeVisitPatterns = useMemo(
    () => patternsForCalendarMonth(homeVisitPatterns, rangeFrom, rangeTo),
    [homeVisitPatterns, rangeFrom, rangeTo],
  );

  const scheduleByDate = useMemo(
    () => expandMonthSchedule(slots, year, month, exceptions, monthHomeVisitPatterns),
    [slots, year, month, exceptions, monthHomeVisitPatterns],
  );

  const displayScheduleByDate = useMemo(
    () => applySubstituteOverlaysToSchedule(scheduleByDate, substituteAssignments),
    [scheduleByDate, substituteAssignments],
  );

  const homeVisitLegend = useMemo(
    () => buildHomeVisitLegend(monthHomeVisitPatterns),
    [monthHomeVisitPatterns],
  );

  const institutionLegend = useMemo(
    () => buildInstitutionLegend({
      weeklySlots: slots,
      scheduleByDate,
      assignedInstitutions,
    }),
    [slots, scheduleByDate, assignedInstitutions],
  );

  const selectedDateStr = fmtLocalDate(selectedDate);
  const selectedDow = selectedDate.getDay();
  const selectedDayExceptions = useMemo(
    () => exceptionsForDate(exceptions, selectedDateStr),
    [exceptions, selectedDateStr],
  );
  const selectedNote = noteByDate(teacherNotes, selectedDateStr);
  const selectedHoliday = getKoreanHoliday(selectedDateStr);
  const selectedPlanned = displayScheduleByDate[selectedDateStr] || [];

  const shiftMonth = (delta) => {
    setMonthBase(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const goToday = () => {
    const now = new Date();
    setMonthBase(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(now);
  };

  const handleNoteSave = async ({ note_date, content, id }) => {
    setNoteSaving(true);
    try {
      await upsertTeacherNote({ id, teacher_id: me.id, note_date, content });
      await load();
    } catch (err) {
      alert("메모 저장 실패: " + err.message);
    } finally {
      setNoteSaving(false);
    }
  };

  const handleNoteDelete = async (id) => {
    if (!confirm("이 날짜 메모를 삭제할까요?")) return;
    setNoteSaving(true);
    try {
      await deleteTeacherNote(id);
      await load();
    } catch (err) {
      alert("메모 삭제 실패: " + err.message);
    } finally {
      setNoteSaving(false);
    }
  };

  const handleNoteDateSelect = (dateStr) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    setSelectedDate(new Date(y, m - 1, d));
  };

  const uniqueInstitutionsForCell = (date) => {
    const dateStr = fmtLocalDate(date);
    if (getKoreanHoliday(dateStr)) return [];
    return uniqueCalendarMarkersForDate(scheduleByDate[dateStr] || []);
  };

  return (
    <div className="sch-view">
      <header className="sch-view-header">
        <button type="button" className="sch-back-btn" onClick={onBack}>
          <ChevronLeft size={18}/> 스케줄 관리
        </button>
        <h2 className="sch-view-title">선생님 월별 일정</h2>
      </header>

      <div className="sch-month-nav">
        <button type="button" className="sch-btn sch-btn--ghost" onClick={() => shiftMonth(-1)} aria-label="이전 달">
          ←
        </button>
        <span className="sch-month-label">{monthLabel}</span>
        <button type="button" className="sch-btn sch-btn--ghost" onClick={() => shiftMonth(1)} aria-label="다음 달">
          →
        </button>
        <button type="button" className="sch-btn sch-btn--ghost sch-btn--today" onClick={goToday}>
          오늘
        </button>
      </div>

      {institutionLegend.length > 0 || homeVisitLegend.length > 0 ? (
        <div className="sch-cal-legend">
          {institutionLegend.map(({ id, name, color }) => (
            <span key={id} className="sch-cal-legend-item">
              <span className="sch-cal-dot" style={{ background: color }}/>
              {name}
            </span>
          ))}
          {homeVisitLegend.map(({ id, name, color }) => (
            <span key={id} className="sch-cal-legend-item">
              <span className="sch-cal-dot sch-cal-dot--home-visit" style={{ background: color }}/>
              가정방문 · {name}
            </span>
          ))}
        </div>
      ) : null}

      {!hasHolidayDataForYear(year) ? (
        <p className="sch-muted sch-holiday-data-warn">
          {year}년 공휴일 데이터가 없습니다. koreanHolidays.js에 해당 연도 목록을 추가해 주세요.
        </p>
      ) : null}

      {loading ? <p className="sch-muted">불러오는 중...</p> : (
        <>
          <div className="sch-cal-grid" role="grid" aria-label={`${monthLabel} 일정`}>
            <div className="sch-cal-head-row" role="row">
              {DAY_LABELS.map(label => (
                <div key={label} className="sch-cal-head-cell" role="columnheader">{label}</div>
              ))}
            </div>
            <div className="sch-cal-body">
              {gridCells.map(({ date, inMonth }) => {
                const dateStr = fmtLocalDate(date);
                const isToday = isSameDay(date, TODAY);
                const isSelected = isSameDay(date, selectedDate);
                const holiday = getKoreanHoliday(dateStr);
                const markers = uniqueInstitutionsForCell(date);
                const planned = inMonth ? (scheduleByDate[dateStr] || []) : [];
                const statusKind = calendarDayStatusKind(planned, entries, { isHoliday: !!holiday });

                return (
                  <button
                    key={dateStr}
                    type="button"
                    role="gridcell"
                    className={[
                      "sch-cal-cell",
                      !inMonth && "sch-cal-cell--muted",
                      isToday && "sch-cal-cell--today",
                      isSelected && "sch-cal-cell--selected",
                      holiday && "sch-cal-cell--holiday",
                    ].filter(Boolean).join(" ")}
                    onClick={() => setSelectedDate(new Date(date))}
                    aria-label={`${date.getMonth() + 1}월 ${date.getDate()}일${holiday ? ` ${holiday.name}` : ""}${statusKind === "unconfirmed" ? " 미확인" : statusKind === "confirmed" ? " 등록완료" : ""}`}
                    aria-selected={isSelected}
                  >
                    {inMonth ? <CalendarDayStatusIcon kind={statusKind} /> : null}
                    <span className="sch-cal-day-num">{date.getDate()}</span>
                    {holiday ? (
                      <span className="sch-cal-holiday-label" title={holiday.name}>
                        {holidayShortLabel(holiday.name)}
                      </span>
                    ) : (
                      <span className="sch-cal-dots">
                        {markers.map(marker => (
                          <span
                            key={marker.key}
                            className={[
                              "sch-cal-dot",
                              marker.type === "home_visit" && "sch-cal-dot--home-visit",
                            ].filter(Boolean).join(" ")}
                            style={{
                              background: marker.type === "home_visit"
                                ? homeVisitColor(marker.id)
                                : institutionColor(marker.id),
                            }}
                            title={marker.type === "home_visit" ? `가정방문 · ${marker.label}` : undefined}
                          />
                        ))}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <MonthExceptionNotice exceptions={exceptions} year={year} month={month}/>

          <TeacherNotesMonthList
            notes={teacherNotes}
            year={year}
            month={month}
            selectedDateStr={selectedDateStr}
            onSelectDate={handleNoteDateSelect}
          />

          <section className="sch-cal-detail" aria-live="polite">
            <h3 className="sch-cal-detail-title">
              {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일 ({DAY_LABELS[selectedDow]})
            </h3>
            {selectedDayExceptions.length > 0 ? (
              <ul className="sch-month-notices-list sch-month-notices-list--inline">
                {selectedDayExceptions.map(ex => (
                  <li key={ex.id} className="sch-month-notices-item">
                    {ex.institutions?.name ? (
                      <span className="sch-month-notices-inst">{ex.institutions.name}</span>
                    ) : null}
                    <span>{formatExceptionNotice(ex)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {selectedHoliday ? (
              <p className="sch-holiday-banner">공휴일 · {selectedHoliday.name} — 수업 없음</p>
            ) : null}
            {!selectedHoliday && selectedPlanned.length === 0 ? (
              <p className="sch-muted">이 날짜에 등록된 수업이 없습니다.</p>
            ) : !selectedHoliday ? (
              <ul className="sch-cal-detail-list">
                {selectedPlanned.map(planned => {
                  const isHome = isHomeVisitPlanned(planned);
                  const color = isHome
                    ? homeVisitColor(planned.patternId)
                    : institutionColor(planned.institutionId);
                  return (
                    <li key={`${planned.source}-${planned.slot.id}-${planned.dateStr}`}>
                      <button
                        type="button"
                        className={[
                          "sch-cal-detail-item",
                          planned.isSubstituteCovered && "sch-cal-detail-item--substitute",
                        ].filter(Boolean).join(" ")}
                        onClick={() => {
                          if (isHome) {
                            setDetailHomeVisit(planned);
                            setDetailSlot(null);
                          } else {
                            setDetailSlot(planned.slot);
                            setDetailHomeVisit(null);
                          }
                        }}
                      >
                        <span className="sch-cal-detail-bar" style={{ background: color }}/>
                        <span className="sch-cal-detail-time">
                          {planned.startTime}–{planned.endTime}
                        </span>
                        <span className="sch-cal-detail-main">
                          <span className="sch-cal-detail-inst">
                            {plannedSlotDisplayLabel(planned)}
                          </span>
                          <span className="sch-cal-detail-type">{planned.payType}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            <TeacherNoteDayEditor
              noteDate={selectedDateStr}
              note={selectedNote}
              onSave={handleNoteSave}
              onDelete={handleNoteDelete}
              saving={noteSaving}
            />
          </section>
        </>
      )}

      {detailHomeVisit ? (
        <div className="sch-modal-overlay" onClick={() => setDetailHomeVisit(null)}>
          <div className="sch-modal" onClick={e => e.stopPropagation()}>
            <h3>가정방문 · {detailHomeVisit.studentName}</h3>
            <p className="sch-muted">
              {detailHomeVisit.payType} · {detailHomeVisit.startTime}–{detailHomeVisit.endTime}
            </p>
            {detailHomeVisit.location ? (
              <p><MapPin size={14}/> {detailHomeVisit.location}</p>
            ) : null}
            <button type="button" className="sch-btn sch-btn--primary" onClick={() => setDetailHomeVisit(null)}>닫기</button>
          </div>
        </div>
      ) : null}

      {detailSlot ? (
        <div className="sch-modal-overlay" onClick={() => setDetailSlot(null)}>
          <div className="sch-modal" onClick={e => e.stopPropagation()}>
            <h3>{detailSlot.institutions?.name}</h3>
            <p className="sch-muted">
              {resolveInstitutionSlotPayType(detailSlot)} · {detailSlot.start_time?.slice(0, 5)}–{detailSlot.end_time?.slice(0, 5)}
            </p>
            {detailSlot.institutions?.address ? (
              <p><MapPin size={14}/> {detailSlot.institutions.address}</p>
            ) : null}
            {detailSlot.institutions?.parking_info ? (
              <p><Car size={14}/> {detailSlot.institutions.parking_info}</p>
            ) : null}
            <button type="button" className="sch-btn sch-btn--primary" onClick={() => setDetailSlot(null)}>닫기</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
