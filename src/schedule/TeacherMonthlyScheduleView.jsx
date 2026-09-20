import { useCallback, useEffect, useMemo, useState } from "react";
import { Car, Check, ChevronLeft, MapPin, Pencil } from "lucide-react";
import {
  classTypeLabel,
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
  deletePayrollEntry,
  fetchFinalizedInstitutionIds,
  fetchHomeVisitPatterns,
  fetchInstitutions,
  fetchPayrollEntries,
  fetchScheduleExceptions,
  fetchSubstituteAssignmentsForTeacher,
  fetchSubstituteLessons,
  fetchOneoffLessons,
  fetchTeachers,
  fetchWeeklySchedule,
} from "./api.js";
import MonthExceptionNotice from "./MonthExceptionNotice.jsx";
import CalendarEventBadges from "./CalendarEventBadges.jsx";
import {
  exceptionsForDate,
  formatExceptionNotice,
  buildExceptionsByDateMap,
  filterExceptionsForInstitutions,
} from "./scheduleExceptions.js";
import {
  getKoreanHoliday,
  hasHolidayDataForYear,
  holidayShortLabel,
} from "./koreanHolidays.js";
import {
  buildScheduleCalendarDayLines,
  effectiveSlotStatusLabel,
  ENTRY_STATUS,
  expandMonthSchedule,
  findEntryForPlanned,
  getEffectiveSlotStatus,
  isDateConfirmable,
  PAYROLL_EARLY_CONFIRM_DAY,
  plannedSlotDisplayLabel,
} from "./payrollCalendar.js";
import PayrollSlotCustomModal from "./PayrollSlotCustomModal.jsx";
import {
  buildCustomEditState,
  confirmPayrollSlotAsScheduled,
  customEditNeedsChangeReason,
  saveCustomPayrollSlot,
  skipPayrollSlot,
} from "./payrollSlotPayload.js";
import ClassIncidentSlotForm from "./ClassIncidentSlotForm.jsx";
import { fetchClassIncidentReports, reportsByPayrollEntryId } from "./classIncidentReports.js";
import { patternsForCalendarMonth } from "./homeVisitPatterns.js";
import { buildHomeVisitLegend, buildInstitutionLegend } from "./calendarLegend.js";
import CalendarClassLines from "./CalendarClassLines.jsx";
import CalendarDayStatusIcon, { calendarDayStatusKind } from "./CalendarDayStatusIcon.jsx";
import { applySubstituteOverlaysToSchedule } from "./substituteSchedule.js";
import { applySubstituteLessonsToSchedule, calendarSubstituteBadge } from "./substituteLessons.js";
import { isScheduleSuperAdmin } from "./managerScope.js";
import { isScheduleAdmin } from "./roles.js";
import SubstituteLessonModal from "./SubstituteLessonModal.jsx";
import { cancelSubstituteLesson } from "./substituteLessonService.js";
import OneoffLessonModal from "./OneoffLessonModal.jsx";
import { deleteOneoffLessonRecord } from "./oneoffLessonService.js";
import {
  mergeOneoffLessonsIntoSchedule,
  ONEOFF_LESSON_COLOR,
} from "./oneoffLessons.js";
import { useScheduleAuthReady } from "./ScheduleAuthContext.jsx";

const TODAY = new Date();

export default function TeacherMonthlyScheduleView({
  me,
  onBack,
  targetTeacherId = null,
  targetTeacherName = null,
  embedded = false,
}) {
  const teacherId = targetTeacherId || me?.id;
  const scheduleAuthReady = useScheduleAuthReady();
  const [monthBase, setMonthBase] = useState(() => new Date(TODAY.getFullYear(), TODAY.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(() => new Date(TODAY));
  const [slots, setSlots] = useState([]);
  const [homeVisitPatterns, setHomeVisitPatterns] = useState([]);
  const [assignedInstitutions, setAssignedInstitutions] = useState([]);
  const [entries, setEntries] = useState([]);
  const [exceptions, setExceptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailSlot, setDetailSlot] = useState(null);
  const [detailHomeVisit, setDetailHomeVisit] = useState(null);
  const [substituteAssignments, setSubstituteAssignments] = useState([]);
  const [substituteLessons, setSubstituteLessons] = useState([]);
  const [substituteModalOpen, setSubstituteModalOpen] = useState(false);
  const [substitutePlanned, setSubstitutePlanned] = useState(null);
  const [oneoffLessons, setOneoffLessons] = useState([]);
  const [oneoffModalOpen, setOneoffModalOpen] = useState(false);
  const [editingOneoffLesson, setEditingOneoffLesson] = useState(null);
  const [detailOneoff, setDetailOneoff] = useState(null);
  const [incidentReports, setIncidentReports] = useState([]);
  const [finalizedIds, setFinalizedIds] = useState(() => new Set());
  const [teacherOptions, setTeacherOptions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [customEdit, setCustomEdit] = useState(null);

  const superAdmin = isScheduleSuperAdmin(me);
  const canManageSchedule = isScheduleAdmin(me);
  const viewingOwn = Boolean(teacherId && me?.id && teacherId === me.id);
  const canEditPayroll = viewingOwn;

  const year = monthBase.getFullYear();
  const month = monthBase.getMonth();
  const monthLabel = `${year}년 ${month + 1}월`;
  const yearMonth = yearMonthKey(monthBase);

  const gridCells = useMemo(() => getMonthGrid(year, month), [year, month]);

  const rangeFrom = fmtLocalDate(gridCells[0].date);
  const rangeTo = fmtLocalDate(gridCells[gridCells.length - 1].date);

  const load = useCallback(async () => {
    if (!teacherId || !scheduleAuthReady) return;
    setLoading(true);
    try {
      const settled = await Promise.allSettled([
        fetchWeeklySchedule(null, teacherId),
        fetchHomeVisitPatterns({ teacherId }),
        teacherId === me.id
          ? fetchInstitutions({ teacherScope: true })
          : Promise.resolve([]),
        fetchScheduleExceptions(null, rangeFrom, rangeTo),
        fetchPayrollEntries({ teacherId, yearMonth }),
        fetchSubstituteAssignmentsForTeacher(teacherId, rangeFrom, rangeTo),
        fetchSubstituteLessons({ fromDate: rangeFrom, toDate: rangeTo, teacherId }),
        fetchOneoffLessons({ fromDate: rangeFrom, toDate: rangeTo, teacherId }),
        fetchClassIncidentReports({ teacherId, fromDate: rangeFrom, toDate: rangeTo }),
        fetchFinalizedInstitutionIds(yearMonth),
      ]);
      const labels = [
        "weeklySchedule",
        "homeVisitPatterns",
        "institutions",
        "exceptions",
        "payrollEntries",
        "substituteAssignments",
        "substituteLessons",
        "oneoffLessons",
        "incidentReports",
        "finalizedIds",
      ];
      const val = (i, fallback = []) => {
        const r = settled[i];
        if (r.status === "fulfilled") return r.value;
        console.error(`Monthly schedule fetch ${labels[i]} failed:`, r.reason);
        return fallback;
      };

      const w = val(0);
      const hv = val(1);
      const insts = val(2);
      const ex = val(3);
      const ents = val(4);
      const subs = val(5);
      const subLessons = val(6);
      const oneoffs = val(7);
      const incidents = val(8, { rows: [] });
      const fin = val(9, new Set());

      setSlots(w);
      setHomeVisitPatterns(hv);
      if (teacherId === me.id) {
        setAssignedInstitutions(insts);
      } else {
        const byId = new Map();
        for (const slot of w) {
          if (slot.institutions?.id) byId.set(slot.institutions.id, slot.institutions);
        }
        setAssignedInstitutions([...byId.values()]);
      }
      setExceptions(ex);
      setEntries(ents);
      setSubstituteAssignments(subs);
      setSubstituteLessons(subLessons);
      setOneoffLessons(oneoffs);
      setIncidentReports(incidents?.rows || []);
      setFinalizedIds(fin instanceof Set ? fin : new Set(fin || []));
    } finally {
      setLoading(false);
    }
  }, [teacherId, scheduleAuthReady, me.id, rangeFrom, rangeTo, yearMonth]);

  useEffect(() => {
    if (!teacherId || !scheduleAuthReady) {
      if (!teacherId) setLoading(false);
      return;
    }
    load();
  }, [load, teacherId, scheduleAuthReady]);

  useEffect(() => {
    if (!canEditPayroll) {
      setTeacherOptions([]);
      return;
    }
    fetchTeachers({ yearMonth })
      .then((rows) => setTeacherOptions((rows || []).filter((t) => t.role === "teacher")))
      .catch(console.error);
  }, [canEditPayroll, yearMonth]);

  const monthHomeVisitPatterns = useMemo(
    () => patternsForCalendarMonth(homeVisitPatterns, rangeFrom, rangeTo),
    [homeVisitPatterns, rangeFrom, rangeTo],
  );

  const teacherInstitutionIds = useMemo(
    () => new Set(slots.map(s => s.institution_id).filter(Boolean)),
    [slots],
  );

  const teacherExceptions = useMemo(
    () => filterExceptionsForInstitutions(exceptions, teacherInstitutionIds),
    [exceptions, teacherInstitutionIds],
  );

  const scheduleByDate = useMemo(
    () => expandMonthSchedule(slots, year, month, teacherExceptions, monthHomeVisitPatterns),
    [slots, year, month, teacherExceptions, monthHomeVisitPatterns],
  );

  const institutionMap = useMemo(
    () => Object.fromEntries(assignedInstitutions.map(i => [i.id, i])),
    [assignedInstitutions],
  );

  const displayScheduleByDate = useMemo(() => {
    const withTempSubs = applySubstituteOverlaysToSchedule(
      scheduleByDate,
      substituteAssignments,
      { showSubstituteDetails: canManageSchedule },
    );
    const withSubstitutes = applySubstituteLessonsToSchedule(withTempSubs, substituteLessons, {
      viewerTeacherId: teacherId,
      institutionMap,
      showSubstituteDetails: canManageSchedule,
    });
    return mergeOneoffLessonsIntoSchedule(withSubstitutes, oneoffLessons, { teacherId });
  }, [
    scheduleByDate,
    substituteAssignments,
    substituteLessons,
    oneoffLessons,
    teacherId,
    institutionMap,
    canManageSchedule,
  ]);

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

  const exceptionsByDate = useMemo(
    () => buildExceptionsByDateMap(teacherExceptions, rangeFrom, rangeTo),
    [teacherExceptions, rangeFrom, rangeTo],
  );

  const selectedDayExceptions = useMemo(
    () => exceptionsForDate(teacherExceptions, selectedDateStr),
    [teacherExceptions, selectedDateStr],
  );
  const selectedHoliday = getKoreanHoliday(selectedDateStr);
  const selectedPlanned = displayScheduleByDate[selectedDateStr] || [];
  const teachersById = useMemo(() => {
    const map = new Map();
    for (const t of teacherOptions) map.set(t.id, t);
    return map;
  }, [teacherOptions]);
  const incidentByEntryId = useMemo(
    () => reportsByPayrollEntryId(incidentReports),
    [incidentReports],
  );
  const selectedDateConfirmable = isDateConfirmable(selectedDateStr, TODAY);
  const isLocked = (institutionId) => Boolean(institutionId && finalizedIds.has(institutionId));
  const slotLocked = (planned) => !isHomeVisitPlanned(planned) && isLocked(planned.institutionId);
  const customEditNeedsReason = useMemo(() => {
    if (!customEdit) return false;
    return customEditNeedsChangeReason(
      customEdit,
      findEntryForPlanned(entries, customEdit.planned),
      teacherId,
    );
  }, [customEdit, entries, teacherId]);
  const checkablePlanned = selectedPlanned.filter((p) => !p.isOneoffLesson);
  const dayUnconfirmedUnlockable = checkablePlanned.filter((planned) => {
    if (slotLocked(planned)) return false;
    const status = getEffectiveSlotStatus(findEntryForPlanned(entries, planned), planned.dateStr);
    return !status;
  });

  const openPlannedDetail = (planned) => {
    if (planned.isOneoffLesson) {
      setDetailOneoff(planned.oneoffLesson);
      setDetailSlot(null);
      setDetailHomeVisit(null);
      return;
    }
    if (isHomeVisitPlanned(planned)) {
      setDetailHomeVisit(planned);
      setDetailSlot(null);
      setDetailOneoff(null);
      return;
    }
    setDetailSlot({ ...planned.slot, planned });
    setDetailHomeVisit(null);
    setDetailOneoff(null);
  };

  const handleSlotConfirm = async (planned) => {
    if (slotLocked(planned)) return alert("정산 확정된 원은 수정할 수 없습니다.");
    setSaving(true);
    try {
      await confirmPayrollSlotAsScheduled(planned, {
        existingEntry: findEntryForPlanned(entries, planned),
        teacherId,
      });
      await load();
    } catch (err) {
      alert("저장 실패: " + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  const handleDayConfirmAll = async () => {
    const n = dayUnconfirmedUnlockable.length;
    if (!n) return alert("평소대로 확정할 미확인 수업이 없습니다.");
    if (!confirm(`이 날짜의 미확인 수업 ${n}개를 평소대로 확정할까요?`)) return;
    setSaving(true);
    try {
      for (const planned of dayUnconfirmedUnlockable) {
        await confirmPayrollSlotAsScheduled(planned, {
          existingEntry: findEntryForPlanned(entries, planned),
          teacherId,
        });
      }
      await load();
    } catch (err) {
      alert("저장 실패: " + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  const openCustom = (planned) => {
    setCustomEdit(buildCustomEditState(planned, findEntryForPlanned(entries, planned)));
  };

  const handleCustomSave = async (e) => {
    e.preventDefault();
    if (!customEdit) return;
    if (slotLocked(customEdit.planned)) {
      return alert("정산 확정된 원은 수정할 수 없습니다.");
    }
    setSaving(true);
    try {
      await saveCustomPayrollSlot(customEdit, {
        existingEntry: findEntryForPlanned(entries, customEdit.planned),
        teacherId,
      });
      setCustomEdit(null);
      await load();
    } catch (err) {
      alert("저장 실패: " + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  const handleSlotSkip = async () => {
    if (!customEdit) return;
    if (slotLocked(customEdit.planned)) {
      return alert("정산 확정된 원은 수정할 수 없습니다.");
    }
    setSaving(true);
    try {
      await skipPayrollSlot(customEdit, {
        existingEntry: findEntryForPlanned(entries, customEdit.planned),
        teacherId,
      });
      setCustomEdit(null);
      await load();
    } catch (err) {
      alert("저장 실패: " + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  const handleSlotReset = async (planned) => {
    const existing = findEntryForPlanned(entries, planned);
    if (!existing?.id) return;
    if (slotLocked(planned)) return alert("정산 확정된 원은 수정할 수 없습니다.");
    if (!confirm("이 수업을 미확인 상태로 되돌릴까요?")) return;
    setSaving(true);
    try {
      await deletePayrollEntry(existing.id);
      await load();
    } catch (err) {
      alert("삭제 실패: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const shiftMonth = (delta) => {
    setMonthBase(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const goToday = () => {
    const now = new Date();
    setMonthBase(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(now);
  };

  const openOneoffModal = (lesson = null) => {
    setEditingOneoffLesson(lesson);
    setOneoffModalOpen(true);
  };

  const handleDeleteOneoff = async (lesson) => {
    if (!lesson?.id) return;
    if (!confirm("이 일회성 수업을 삭제할까요?")) return;
    try {
      await deleteOneoffLessonRecord(lesson);
      setDetailOneoff(null);
      await load();
    } catch (err) {
      alert("일회성 수업 삭제 실패: " + err.message);
    }
  };

  const handleCalendarDateSelect = (date, { inMonth, holiday }) => {
    setSelectedDate(new Date(date));
    if (canManageSchedule && inMonth && !holiday) {
      openOneoffModal(null);
    }
  };

  const openSubstituteModal = (planned = null) => {
    setSubstitutePlanned(planned);
    setSubstituteModalOpen(true);
  };

  const handleCancelSubstitute = async (lesson) => {
    if (!lesson?.id) return;
    if (!confirm("이 대체수업을 취소할까요? 급여 항목도 되돌립니다.")) return;
    try {
      await cancelSubstituteLesson(lesson);
      setDetailSlot(null);
      await load();
    } catch (err) {
      alert("대체수업 취소 실패: " + err.message);
    }
  };

  return (
    <div className={`sch-view${embedded ? " sch-view--embedded-calendar" : ""}`}>
      {!embedded ? (
        <header className="sch-view-header">
          <button type="button" className="sch-back-btn" onClick={onBack}>
            <ChevronLeft size={18}/> 스케줄 관리
          </button>
          <h2 className="sch-view-title">선생님 월별 일정</h2>
        </header>
      ) : targetTeacherName ? (
        <p className="sch-unified-teacher-banner">
          <strong>{targetTeacherName}</strong> 선생님 월별 일정
        </p>
      ) : null}

      <section className="sch-monthly-calendar-block" aria-label="월별 달력">
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

      {institutionLegend.length > 0 || homeVisitLegend.length > 0 || oneoffLessons.length > 0 ? (
        <div className="sch-cal-legend">
          {oneoffLessons.length > 0 ? (
            <span className="sch-cal-legend-item">
              <span className="sch-cal-dot sch-cal-dot--oneoff"/>
              일회성 수업
            </span>
          ) : null}
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

      {loading ? (
        <p className="sch-muted">달력을 불러오는 중...</p>
      ) : (
        <div className="sch-cal-grid sch-cal-grid--class-lines" role="grid" aria-label={`${monthLabel} 일정`}>
          <div className="sch-cal-head-row" role="row">
            {DAY_LABELS.map((label, i) => (
              <div
                key={label}
                className={[
                  "sch-cal-head-cell",
                  (i === 0 || i === 6) && "sch-cal-head-cell--weekend",
                ].filter(Boolean).join(" ")}
                role="columnheader"
              >
                {label}
              </div>
            ))}
          </div>
          <div className="sch-cal-body">
            {gridCells.map(({ date, inMonth }) => {
                const dateStr = fmtLocalDate(date);
                const isToday = isSameDay(date, TODAY);
                const isSelected = isSameDay(date, selectedDate);
                const holiday = getKoreanHoliday(dateStr);
                const dayEvents = inMonth ? (exceptionsByDate[dateStr] || []) : [];
                const planned = inMonth ? (displayScheduleByDate[dateStr] || []) : [];
                const classLines = inMonth && !holiday
                  ? buildScheduleCalendarDayLines(planned, entries)
                  : [];
                const subBadge = inMonth
                  ? calendarSubstituteBadge(substituteLessons, teacherId, dateStr)
                  : null;
                const statusKind = calendarDayStatusKind(planned, entries, { isHoliday: !!holiday });
                const classLineLabel = classLines.map((l) => l.label).join(", ");

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
                      dayEvents.length > 0 && "sch-cal-cell--has-events",
                      classLines.length > 0 && "sch-cal-cell--has-mark",
                    ].filter(Boolean).join(" ")}
                    onClick={() => handleCalendarDateSelect(date, { inMonth, holiday })}
                    aria-label={`${date.getMonth() + 1}월 ${date.getDate()}일${holiday ? ` ${holiday.name}` : ""}${classLineLabel ? ` ${classLineLabel}` : ""}${statusKind === "unconfirmed" ? " 미확인" : statusKind === "confirmed" ? " 등록완료" : ""}`}
                    aria-selected={isSelected}
                  >
                    {inMonth ? <CalendarDayStatusIcon kind={statusKind} /> : null}
                    <span className="sch-cal-day-num">{date.getDate()}</span>
                    {subBadge ? (
                      <span className={`sch-cal-sub-badge sch-cal-sub-badge--${subBadge.kind}`}>
                        {subBadge.label}
                      </span>
                    ) : null}
                    {holiday ? (
                      <span className="sch-cal-holiday-label" title={holiday.name}>
                        {holidayShortLabel(holiday.name)}
                      </span>
                    ) : null}
                    {!holiday && classLines.length > 0 ? <CalendarClassLines lines={classLines} /> : null}
                    {dayEvents.length > 0 ? (
                      <CalendarEventBadges events={dayEvents} maxVisible={2} compact/>
                    ) : null}
                  </button>
                );
              })}
          </div>
        </div>
      )}
      </section>

      {loading ? null : (
        <>
          <MonthExceptionNotice exceptions={teacherExceptions} year={year} month={month}/>

          <section className="sch-cal-detail" aria-live="polite">
            <h3 className="sch-cal-detail-title">
              {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일 ({DAY_LABELS[selectedDow]})
            </h3>
            {canManageSchedule && !selectedHoliday ? (
              <button
                type="button"
                className="sch-btn sch-btn--primary sch-btn--sm sch-cal-sub-register-btn"
                onClick={() => openOneoffModal(null)}
              >
                일회성 수업 등록
              </button>
            ) : null}
            {superAdmin && !selectedHoliday ? (
              <button
                type="button"
                className="sch-btn sch-btn--primary sch-btn--sm sch-cal-sub-register-btn"
                onClick={() => openSubstituteModal(selectedPlanned[0] || null)}
              >
                대체수업 등록
              </button>
            ) : null}
            {canEditPayroll && !selectedHoliday && selectedDateConfirmable && dayUnconfirmedUnlockable.length > 0 ? (
              <button
                type="button"
                className="sch-btn sch-btn--ghost sch-btn--sm sch-cal-sub-register-btn"
                disabled={saving}
                onClick={handleDayConfirmAll}
              >
                전체 평소대로
              </button>
            ) : null}
            {canEditPayroll && !selectedHoliday && checkablePlanned.length > 0 ? (
              <p className="sch-muted sch-cal-detail-hint">완료·수정은 급여/정산과 같은 기록입니다.</p>
            ) : null}
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
            ) : !selectedHoliday && !viewingOwn ? (
              <ul className="sch-cal-detail-list">
                {selectedPlanned.map((planned) => {
                  const isHome = isHomeVisitPlanned(planned);
                  const isOneoff = planned.isOneoffLesson;
                  const color = isOneoff
                    ? ONEOFF_LESSON_COLOR
                    : isHome
                      ? homeVisitColor(planned.patternId)
                      : institutionColor(planned.institutionId);
                  const itemKey = isOneoff
                    ? `oneoff-${planned.oneoffLesson.id}`
                    : `${planned.source}-${planned.slot.id}-${planned.dateStr}`;
                  return (
                    <li key={itemKey}>
                      <button
                        type="button"
                        className={[
                          "sch-cal-detail-item",
                          planned.isSubstituteCovered && "sch-cal-detail-item--substitute",
                          planned.isSubstituteCancelled && "sch-cal-detail-item--cancelled",
                          planned.isSubstituteCover && "sch-cal-detail-item--substitute-cover",
                          isOneoff && "sch-cal-detail-item--oneoff",
                        ].filter(Boolean).join(" ")}
                        onClick={() => openPlannedDetail(planned)}
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
            ) : !selectedHoliday ? (
              <ul className="sch-payroll-slot-grid sch-payroll-slot-grid--stacked">
                {selectedPlanned.map((planned) => {
                  const isHome = isHomeVisitPlanned(planned);
                  const isOneoff = planned.isOneoffLesson;
                  const color = isOneoff
                    ? ONEOFF_LESSON_COLOR
                    : isHome
                      ? homeVisitColor(planned.patternId)
                      : institutionColor(planned.institutionId);
                  const itemKey = isOneoff
                    ? `oneoff-${planned.oneoffLesson.id}`
                    : `${planned.source}-${planned.slot.id}-${planned.dateStr}`;

                  if (isOneoff) {
                    return (
                      <li key={itemKey}>
                        <button
                          type="button"
                          className={[
                            "sch-cal-detail-item",
                            "sch-cal-detail-item--oneoff",
                          ].filter(Boolean).join(" ")}
                          onClick={() => openPlannedDetail(planned)}
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
                  }

                  const entry = findEntryForPlanned(entries, planned);
                  const locked = slotLocked(planned);
                  const status = getEffectiveSlotStatus(entry, planned.dateStr);
                  return (
                    <li
                      key={itemKey}
                      className={[
                        "sch-payroll-slot-card",
                        locked && "sch-payroll-slot-card--locked",
                        planned.isSubstituteCovered && "sch-payroll-slot-card--substitute",
                        status && status !== ENTRY_STATUS.skipped && "sch-payroll-slot-card--done",
                        status === ENTRY_STATUS.skipped && "sch-payroll-slot-card--skipped",
                      ].filter(Boolean).join(" ")}
                    >
                      <span className="sch-payroll-slot-card-accent" style={{ background: color }} aria-hidden/>
                      <div className="sch-payroll-slot-card-body">
                        <button
                          type="button"
                          className="sch-cal-detail-slot-open"
                          onClick={() => openPlannedDetail(planned)}
                        >
                          <div className="sch-payroll-slot-card-head">
                            <span className="sch-payroll-slot-time">
                              {planned.startTime}–{planned.endTime}
                            </span>
                            <span className="sch-payroll-slot-type">{classTypeLabel(planned.payType)}</span>
                          </div>
                          <div className="sch-payroll-slot-inst">
                            {plannedSlotDisplayLabel(planned)}
                          </div>
                          <div className={`sch-payroll-status sch-payroll-status--${status || "pending"}`}>
                            {effectiveSlotStatusLabel(planned, entry, { teachersById })}
                          </div>
                          {locked ? <span className="sch-lock-badge">정산 확정</span> : null}
                        </button>
                        <ClassIncidentSlotForm
                          entry={entry}
                          report={entry?.id ? incidentByEntryId.get(entry.id) : null}
                          me={me}
                          canEditBody={canEditPayroll}
                          isAdmin={canManageSchedule && viewingOwn}
                          onChanged={load}
                        />
                      </div>
                      {canEditPayroll && !locked && (selectedDateConfirmable || status) ? (
                        <div className="sch-payroll-slot-card-actions">
                          {!status && selectedDateConfirmable ? (
                            <button
                              type="button"
                              className="sch-payroll-confirm-btn"
                              disabled={saving}
                              onClick={() => handleSlotConfirm(planned)}
                            >
                              <Check size={13}/> 완료
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="sch-payroll-edit-btn"
                            disabled={saving}
                            onClick={() => openCustom(planned)}
                          >
                            <Pencil size={13}/> 수정
                          </button>
                          {status ? (
                            <button
                              type="button"
                              className="sch-btn sch-btn--ghost sch-payroll-edit-btn sch-payroll-edit-btn--muted"
                              disabled={saving}
                              onClick={() => handleSlotReset(planned)}
                            >
                              되돌리기
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {!selectedHoliday && canEditPayroll && checkablePlanned.length > 0 && !selectedDateConfirmable ? (
              <p className="sch-muted">
                {TODAY.getDate() < PAYROLL_EARLY_CONFIRM_DAY
                  ? `미래 날짜는 당일이 되면 확정할 수 있습니다. 매월 ${PAYROLL_EARLY_CONFIRM_DAY}일 이후에는 이번 달 말일까지 미리 확정할 수 있습니다.`
                  : "다음 달 날짜는 해당 월이 되면 확정할 수 있습니다."}
              </p>
            ) : null}
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

      {detailOneoff ? (
        <div className="sch-modal-overlay" onClick={() => setDetailOneoff(null)}>
          <div className="sch-modal" onClick={e => e.stopPropagation()}>
            <h3>{detailOneoff.institutions?.name || "일회성 수업"}</h3>
            <p className="sch-muted">
              {String(detailOneoff.start_time || "").slice(0, 5)}–{String(detailOneoff.end_time || "").slice(0, 5)}
              {detailOneoff.link_payroll ? " · 급여 반영" : ""}
            </p>
            <p className="sch-sub-status sch-sub-status--oneoff">일회성 수업</p>
            {detailOneoff.memo ? <p>{detailOneoff.memo}</p> : null}
            {detailOneoff.pay_amount != null ? (
              <p className="sch-muted">수업료 {Number(detailOneoff.pay_amount).toLocaleString()}원</p>
            ) : null}
            <div className="sch-form-actions">
              {canManageSchedule ? (
                <>
                  <button
                    type="button"
                    className="sch-btn sch-btn--primary"
                    onClick={() => {
                      openOneoffModal(detailOneoff);
                      setDetailOneoff(null);
                    }}
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    className="sch-btn sch-btn--danger"
                    onClick={() => handleDeleteOneoff(detailOneoff)}
                  >
                    삭제
                  </button>
                </>
              ) : null}
              <button type="button" className="sch-btn sch-btn--ghost" onClick={() => setDetailOneoff(null)}>닫기</button>
            </div>
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
            {detailSlot.planned?.isSubstituteCancelled ? (
              <p className="sch-sub-status sch-sub-status--cancelled">휴강 🔴 — 대체수업 등록됨</p>
            ) : null}
            {detailSlot.planned?.isSubstituteCover ? (
              <p className="sch-sub-status sch-sub-status--cover">대체수업 🟡</p>
            ) : null}
            {detailSlot.institutions?.address ? (
              <p><MapPin size={14}/> {detailSlot.institutions.address}</p>
            ) : null}
            {detailSlot.institutions?.parking_info ? (
              <p><Car size={14}/> {detailSlot.institutions.parking_info}</p>
            ) : null}
            <div className="sch-form-actions">
              {superAdmin && detailSlot.planned?.substituteLesson ? (
                <button
                  type="button"
                  className="sch-btn sch-btn--danger"
                  onClick={() => handleCancelSubstitute(detailSlot.planned.substituteLesson)}
                >
                  대체수업 취소
                </button>
              ) : null}
              {superAdmin && !detailSlot.planned?.isSubstituteCancelled ? (
                <button
                  type="button"
                  className="sch-btn sch-btn--primary"
                  onClick={() => {
                    openSubstituteModal(detailSlot.planned || {
                      slot: detailSlot,
                      institutionId: detailSlot.institution_id,
                      institutionName: detailSlot.institutions?.name,
                      payType: resolveInstitutionSlotPayType(detailSlot),
                      startTime: detailSlot.start_time?.slice(0, 5),
                      endTime: detailSlot.end_time?.slice(0, 5),
                      scheduledMinutes: 0,
                      dateStr: selectedDateStr,
                    });
                    setDetailSlot(null);
                  }}
                >
                  대체수업 등록
                </button>
              ) : null}
              <button type="button" className="sch-btn sch-btn--ghost" onClick={() => setDetailSlot(null)}>닫기</button>
            </div>
          </div>
        </div>
      ) : null}

      <OneoffLessonModal
        open={oneoffModalOpen}
        onClose={() => {
          setOneoffModalOpen(false);
          setEditingOneoffLesson(null);
        }}
        me={me}
        teacherId={teacherId}
        teacherName={targetTeacherName || me?.name}
        lessonDate={selectedDateStr}
        editingLesson={editingOneoffLesson}
        onSaved={load}
      />

      <SubstituteLessonModal
        open={substituteModalOpen}
        onClose={() => setSubstituteModalOpen(false)}
        me={me}
        planned={substitutePlanned}
        originalTeacherId={teacherId}
        originalTeacherName={targetTeacherName || me?.name}
        lessonDate={selectedDateStr}
        onSaved={load}
      />

      <PayrollSlotCustomModal
        customEdit={customEdit}
        setCustomEdit={setCustomEdit}
        teacherId={teacherId}
        teacherOptions={teacherOptions}
        saving={saving}
        needsReason={customEditNeedsReason}
        onSave={handleCustomSave}
        onSkip={handleSlotSkip}
        onClose={() => setCustomEdit(null)}
      />
    </div>
  );
}
