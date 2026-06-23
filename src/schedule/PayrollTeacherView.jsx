import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Pencil } from "lucide-react";
import { DAY_LABELS, PAY_TYPES, formatMinutes, formatWon, grossToNetPay, homeVisitColor, institutionColor, isHomeVisitPlanned, minutesBetween, yearMonthKey } from "./constants.js";
import PayrollMonthNotices from "./PayrollMonthNotices.jsx";
import { TeacherNoteDayEditor, TeacherNotesMonthList } from "./TeacherNotesPanel.jsx";
import { noteByDate } from "./teacherNotes.js";
import {
  findFixedGrossPay,
  findFixedMonthlySalary,
  formatTeacherAdditionalLine,
  resolveTeacherMonthlyGross,
  sumAdditionalPayments,
  withholdingTax333,
} from "./additionalPayments.js";
import {
  deletePayrollEntry,
  deleteTeacherNote,
  fetchAdditionalPayments,
  fetchFinalizedInstitutionIds,
  fetchHomeVisitPatterns,
  fetchInstitutions,
  fetchPayRates,
  fetchPayrollEntries,
  fetchScheduleExceptions,
  fetchTeacherNotes,
  fetchWeeklySchedule,
  savePayrollEntry,
  upsertTeacherNote,
} from "./api.js";
import {
  bulkUpsertPayrollSlotsWithNotifications,
  createManualExtraEntryWithNotification,
  upsertPayrollSlotWithNotification,
} from "./payrollSaveWithNotification.js";
import { estimateTeacherPayByEntry } from "./settlement.js";
import {
  ENTRY_STATUS,
  collectUnconfirmedPlanned,
  countUnconfirmedDays,
  isDateConfirmable,
  PAYROLL_EARLY_CONFIRM_DAY,
  dayConfirmState,
  effectiveSlotStatusLabel,
  expandMonthSchedule,
  findEntryForPlanned,
  findManualExtraEntriesForDate,
  plannedSlotDisplayLabel,
  getEffectiveSlotStatus,
  getMonthGrid,
  fmtLocalDate,
  isSameDay,
  isSlotUnconfirmed,
  groupPayrollByTypeConfirmed,
  uniqueCalendarMarkersForDate,
} from "./payrollCalendar.js";
import { patternsForCalendarMonth } from "./homeVisitPatterns.js";
import { buildHomeVisitLegend, buildInstitutionLegend, resolveInstitutionDisplayName } from "./calendarLegend.js";
import {
  getKoreanHoliday,
  holidayShortLabel,
} from "./koreanHolidays.js";
import PayrollDebugPanel from "./PayrollDebugPanel.jsx";
import CalendarDayStatusIcon, { calendarDayStatusKind } from "./CalendarDayStatusIcon.jsx";
import { isScheduleSuperAdmin } from "./managerScope.js";

const QUICK_MINUTES = [30, 40, 45, 50, 60, 90];

export default function PayrollTeacherView({
  me,
  subjectTeacher = null,
  initialYearMonth = null,
  adminInspectMode = false,
  onBack = null,
}) {
  const teacherId = subjectTeacher?.id ?? me.id;
  const teacherName = subjectTeacher?.name ?? me.name;
  const today = new Date();
  const todayStr = fmtLocalDate(today);
  const [yearMonth, setYearMonth] = useState(initialYearMonth ?? yearMonthKey());
  const [monthBase, setMonthBase] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [weeklySlots, setWeeklySlots] = useState([]);
  const [homeVisitPatterns, setHomeVisitPatterns] = useState([]);
  const [assignedInstitutions, setAssignedInstitutions] = useState([]);
  const [entries, setEntries] = useState([]);
  const [exceptions, setExceptions] = useState([]);
  const [teacherNotes, setTeacherNotes] = useState([]);
  const [additionalPayments, setAdditionalPayments] = useState([]);
  const [rates, setRates] = useState([]);
  const [finalizedIds, setFinalizedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [customEdit, setCustomEdit] = useState(null);
  const [extraEdit, setExtraEdit] = useState(null);
  const detailRef = useRef(null);
  const [extraForm, setExtraForm] = useState({
    class_date: todayStr,
    institution_id: "",
    pay_type: "방과후",
    minutes: 40,
    note: "",
  });

  const year = monthBase.getFullYear();
  const month = monthBase.getMonth();
  const monthLabel = `${year}년 ${month + 1}월`;
  const gridCells = useMemo(() => getMonthGrid(year, month), [year, month]);

  const rangeFrom = fmtLocalDate(gridCells[0].date);
  const rangeTo = fmtLocalDate(gridCells[gridCells.length - 1].date);

  useEffect(() => {
    const [y, m] = yearMonth.split("-").map(Number);
    setMonthBase(new Date(y, m - 1, 1));
  }, [yearMonth]);

  useEffect(() => {
    if (initialYearMonth) setYearMonth(initialYearMonth);
  }, [initialYearMonth]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [w, hv, insts, ents, ex, notes, adds, rts, fin] = await Promise.all([
        fetchWeeklySchedule(null, teacherId),
        fetchHomeVisitPatterns({ teacherId }),
        fetchInstitutions({ teacherScope: !adminInspectMode, activeOnly: true }),
        fetchPayrollEntries({ teacherId, yearMonth }),
        fetchScheduleExceptions(null, rangeFrom, rangeTo),
        fetchTeacherNotes({ teacherId, fromDate: rangeFrom, toDate: rangeTo }),
        fetchAdditionalPayments({ teacherId, yearMonth }),
        fetchPayRates(teacherId),
        fetchFinalizedInstitutionIds(yearMonth),
      ]);
      setWeeklySlots(w);
      setHomeVisitPatterns(hv);
      setAssignedInstitutions(insts);
      setEntries(ents);
      setExceptions(ex);
      setTeacherNotes(notes);
      setAdditionalPayments(adds);
      setRates(rts);
      setFinalizedIds(fin);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [teacherId, adminInspectMode, yearMonth, rangeFrom, rangeTo]);

  useEffect(() => { load(); }, [load]);

  const monthHomeVisitPatterns = useMemo(
    () => patternsForCalendarMonth(homeVisitPatterns, rangeFrom, rangeTo),
    [homeVisitPatterns, rangeFrom, rangeTo],
  );

  const scheduleByDate = useMemo(
    () => expandMonthSchedule(weeklySlots, year, month, exceptions, monthHomeVisitPatterns),
    [weeklySlots, year, month, exceptions, monthHomeVisitPatterns],
  );

  const homeVisitLegend = useMemo(
    () => buildHomeVisitLegend(monthHomeVisitPatterns),
    [monthHomeVisitPatterns],
  );

  const institutionLegend = useMemo(
    () => buildInstitutionLegend({
      weeklySlots,
      scheduleByDate,
      assignedInstitutions,
    }),
    [weeklySlots, scheduleByDate, assignedInstitutions],
  );

  const byType = useMemo(() => groupPayrollByTypeConfirmed(entries), [entries]);
  const slotById = useMemo(() => {
    const map = {};
    for (const s of weeklySlots) map[s.id] = s;
    return map;
  }, [weeklySlots]);
  const lessonPay = useMemo(
    () => estimateTeacherPayByEntry(entries.filter(e => e.minutes > 0), rates, slotById),
    [entries, rates, slotById],
  );
  const fixedGrossPay = useMemo(
    () => findFixedGrossPay(teacherId, yearMonth),
    [teacherId, yearMonth],
  );
  const fixedMonthlySalary = useMemo(
    () => findFixedMonthlySalary(teacherId),
    [teacherId],
  );
  const totalPay = useMemo(
    () => resolveTeacherMonthlyGross(teacherId, yearMonth, lessonPay, additionalPayments),
    [teacherId, yearMonth, lessonPay, additionalPayments],
  );
  const additionalTotal = useMemo(
    () => sumAdditionalPayments(additionalPayments),
    [additionalPayments],
  );
  const unconfirmedDays = useMemo(
    () => countUnconfirmedDays(scheduleByDate, entries, today),
    [scheduleByDate, entries, todayStr],
  );

  const selectedDateStr = fmtLocalDate(selectedDate);
  const selectedPlanned = scheduleByDate[selectedDateStr] || [];
  const selectedManualEntries = useMemo(
    () => findManualExtraEntriesForDate(entries, selectedDateStr, selectedPlanned),
    [entries, selectedDateStr, selectedPlanned],
  );
  const selectedNote = noteByDate(teacherNotes, selectedDateStr);
  const selectedHoliday = getKoreanHoliday(selectedDateStr);
  const selectedDaySummary = useMemo(() => {
    let minutes = 0;
    let count = selectedPlanned.length;
    for (const p of selectedPlanned) {
      const entry = findEntryForPlanned(entries, p);
      if (entry?.entry_status === ENTRY_STATUS.skipped) continue;
      minutes += entry?.minutes ?? p.scheduledMinutes;
    }
    for (const e of selectedManualEntries) {
      if (e.entry_status === ENTRY_STATUS.skipped) continue;
      minutes += e.minutes || 0;
      count += 1;
    }
    return { count, minutes };
  }, [selectedPlanned, selectedManualEntries, entries]);

  const isLocked = (institutionId) =>
    institutionId && finalizedIds.has(institutionId);

  const filterUnlocked = (plannedList) =>
    plannedList.filter(p => !isLocked(p.institutionId));

  const shiftMonth = (delta) => {
    const d = new Date(monthBase.getFullYear(), monthBase.getMonth() + delta, 1);
    setMonthBase(d);
    setYearMonth(yearMonthKey(d));
  };

  const goToday = () => {
    const now = new Date();
    setMonthBase(new Date(now.getFullYear(), now.getMonth(), 1));
    setYearMonth(yearMonthKey(now));
    setSelectedDate(now);
  };

  const buildPayload = (planned, { status, minutes, note }) => {
    const existing = findEntryForPlanned(entries, planned);
    return {
      id: existing?.id,
      teacher_id: teacherId,
      institution_id: planned.institutionId || null,
      class_date: planned.dateStr,
      pay_type: planned.payType,
      minutes: status === ENTRY_STATUS.skipped ? 0 : Number(minutes),
      entry_status: status,
      schedule_slot_id: isHomeVisitPlanned(planned) ? null : planned.slot.id,
      home_visit_pattern_id: planned.patternId || null,
      note: note?.trim() || null,
    };
  };

  const bulkSavePlanned = async (plannedList, { status, minutesFor }) => {
    const targets = filterUnlocked(plannedList.filter(p => isSlotUnconfirmed(entries, p)));
    if (!targets.length) {
      alert("확정할 수업이 없습니다. (이미 확정·수정·수업 안 함 처리됨)");
      return;
    }
    if (targets.some(p => isLocked(p.institutionId))) {
      alert("정산 확정된 원의 수업은 수정할 수 없습니다.");
      return;
    }

    setSaving(true);
    try {
      const payloads = targets.map(p => ({
        planned: p,
        payload: buildPayload(p, {
          status,
          minutes: minutesFor ? minutesFor(p) : p.scheduledMinutes,
          note: status === ENTRY_STATUS.skipped ? null : undefined,
        }),
      }));
      await bulkUpsertPayrollSlotsWithNotifications(payloads);
      setCustomEdit(null);
      await load();
    } catch (err) {
      alert("저장 실패: " + (err.message || "알 수 없는 오류"));
    } finally {
      setSaving(false);
    }
  };

  const handleDayConfirmAll = () => {
    bulkSavePlanned(selectedPlanned, {
      status: ENTRY_STATUS.as_scheduled,
      minutesFor: p => p.scheduledMinutes,
    });
  };

  const handleDaySkipAll = () => {
    if (!confirm("미확인 수업을 모두 '수업 안 함'으로 처리할까요?\n(이미 수정·확정된 수업은 유지됩니다)")) return;
    bulkSavePlanned(selectedPlanned, { status: ENTRY_STATUS.skipped, minutesFor: () => 0 });
  };

  const handleMonthConfirmAll = () => {
    const targets = collectUnconfirmedPlanned(scheduleByDate, entries, { today });
    const unlocked = filterUnlocked(targets);
    if (!unlocked.length) return alert("이번 달에 일괄 확정할 수업이 없습니다.");
    if (!confirm(`이번 달 미확인 수업 ${unlocked.length}건을 평소대로 일괄 확정할까요?`)) return;
    bulkSavePlanned(unlocked, {
      status: ENTRY_STATUS.as_scheduled,
      minutesFor: p => p.scheduledMinutes,
    });
  };

  const handleMonthEdit = () => {
    const targets = collectUnconfirmedPlanned(scheduleByDate, entries, { today });
    const unlocked = filterUnlocked(targets);
    if (unlocked.length) {
      const [y, m, d] = unlocked[0].dateStr.split("-").map(Number);
      setSelectedDate(new Date(y, m - 1, d));
    }
    requestAnimationFrame(() => {
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const handleNoteSave = async ({ note_date, content, id }) => {
    setNoteSaving(true);
    try {
      await upsertTeacherNote({ id, teacher_id: teacherId, note_date, content });
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

  const openCustom = (planned) => {
    const existing = findEntryForPlanned(entries, planned);
    setCustomEdit({
      planned,
      minutes: existing?.entry_status === ENTRY_STATUS.custom
        ? existing.minutes
        : planned.scheduledMinutes,
      startTime: planned.startTime,
      endTime: planned.endTime,
      note: existing?.note || "",
    });
  };

  const handleCustomSave = async (e) => {
    e.preventDefault();
    if (!customEdit) return;
    if (isLocked(customEdit.planned.institutionId)) {
      return alert("정산 확정된 원은 수정할 수 없습니다.");
    }
    const mins = Number(customEdit.minutes);
    if (!mins || mins <= 0) return alert("1분 이상 입력해주세요.");
    setSaving(true);
    try {
      await upsertPayrollSlotWithNotification(
        customEdit.planned,
        buildPayload(customEdit.planned, {
          status: ENTRY_STATUS.custom,
          minutes: mins,
          note: customEdit.note,
        }),
        {
          startTime: customEdit.startTime,
          endTime: customEdit.endTime,
        },
      );
      setCustomEdit(null);
      await load();
    } catch (err) {
      alert("저장 실패: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSlotSkip = async () => {
    if (!customEdit) return;
    if (isLocked(customEdit.planned.institutionId)) {
      return alert("정산 확정된 원은 수정할 수 없습니다.");
    }
    setSaving(true);
    try {
      await upsertPayrollSlotWithNotification(
        customEdit.planned,
        buildPayload(customEdit.planned, {
          status: ENTRY_STATUS.skipped,
          minutes: 0,
          note: customEdit.note,
        }),
      );
      setCustomEdit(null);
      await load();
    } catch (err) {
      alert("저장 실패: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSlotReset = async (planned) => {
    const existing = findEntryForPlanned(entries, planned);
    if (!existing?.id) return;
    if (isLocked(planned.institutionId)) return alert("정산 확정된 원은 수정할 수 없습니다.");
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

  const handleExtraSubmit = async (e) => {
    e.preventDefault();
    const mins = Number(extraForm.minutes);
    if (!mins || mins <= 0) return alert("1분 이상 입력해주세요.");
    if (extraForm.institution_id && isLocked(extraForm.institution_id)) {
      return alert("정산 확정된 원은 추가할 수 없습니다.");
    }
    const institutionName = extraForm.institution_id
      ? institutionLegend.find(i => i.id === extraForm.institution_id)?.name
      : "";
    setSaving(true);
    try {
      await createManualExtraEntryWithNotification({
        teacher_id: teacherId,
        institution_id: extraForm.institution_id || null,
        class_date: extraForm.class_date,
        pay_type: extraForm.pay_type,
        minutes: mins,
        entry_status: ENTRY_STATUS.custom,
        note: extraForm.note || null,
      }, { institutionName });
      setExtraForm(f => ({ ...f, minutes: 40, note: "", institution_id: "" }));
      await load();
    } catch (err) {
      alert("저장 실패: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const openExtraEdit = (entry) => {
    setExtraEdit({
      id: entry.id,
      class_date: entry.class_date,
      institution_id: entry.institution_id || "",
      institution_name: entry.institutions?.name || "",
      pay_type: entry.pay_type,
      minutes: entry.minutes,
      note: entry.note || "",
    });
  };

  const handleExtraEditSave = async (e) => {
    e.preventDefault();
    if (!extraEdit) return;
    if (extraEdit.institution_id && isLocked(extraEdit.institution_id)) {
      return alert("정산 확정된 원은 수정할 수 없습니다.");
    }
    const mins = Number(extraEdit.minutes);
    if (!mins || mins <= 0) return alert("1분 이상 입력해주세요.");
    setSaving(true);
    try {
      await savePayrollEntry({
        id: extraEdit.id,
        teacher_id: teacherId,
        institution_id: extraEdit.institution_id || null,
        class_date: extraEdit.class_date,
        pay_type: extraEdit.pay_type,
        minutes: mins,
        entry_status: ENTRY_STATUS.custom,
        schedule_slot_id: null,
        home_visit_pattern_id: null,
        note: extraEdit.note?.trim() || null,
      });
      setExtraEdit(null);
      await load();
    } catch (err) {
      alert("저장 실패: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleExtraDelete = async (entry) => {
    if (entry.institution_id && isLocked(entry.institution_id)) {
      return alert("정산 확정된 원은 삭제할 수 없습니다.");
    }
    if (!confirm("직접 추가한 이 수업을 삭제할까요?")) return;
    setSaving(true);
    try {
      await deletePayrollEntry(entry.id);
      if (extraEdit?.id === entry.id) setExtraEdit(null);
      await load();
    } catch (err) {
      alert("삭제 실패: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const manualEntryLabel = (entry) => {
    if (entry.institutions?.name) return entry.institutions.name;
    if (!entry.institution_id) return "개인레슨";
    return resolveInstitutionDisplayName(
      { institutionId: entry.institution_id },
      institutionLegend,
    ) || "원 미지정";
  };

  const dayHasUnlockable = selectedPlanned.some(
    p => !isLocked(p.institutionId) && isSlotUnconfirmed(entries, p),
  );
  const selectedDateConfirmable = isDateConfirmable(selectedDateStr, today);
  const selectedDayState = dayConfirmState(selectedPlanned, entries);
  const selectedDayAllResolved = selectedDayState !== "pending" && selectedDayState !== "partial";

  return (
    <div className={`sch-view sch-payroll-view${adminInspectMode ? " sch-payroll-view--admin-inspect" : ""}`}>
      <header className={`sch-view-header sch-view-header--center${adminInspectMode ? " sch-view-header--admin-inspect" : ""}`}>
        {adminInspectMode && onBack ? (
          <button type="button" className="sch-back-btn sch-payroll-admin-inspect-back" onClick={onBack}>
            <ChevronLeft size={18}/> 강사별 입력 현황
          </button>
        ) : null}
        <h2 className="sch-view-title">
          {adminInspectMode ? `${teacherName} 선생님 · ${year}년 ${month + 1}월` : "내 수업과 급여"}
        </h2>
      </header>

      <PayrollMonthNotices exceptions={exceptions} year={year} month={month}/>

      <div className="sch-month-nav sch-month-nav--payroll">
        <button type="button" className="sch-btn sch-btn--ghost" onClick={() => shiftMonth(-1)}>←</button>
        <span className="sch-month-label">{monthLabel}</span>
        <button type="button" className="sch-btn sch-btn--ghost" onClick={() => shiftMonth(1)}>→</button>
        <button type="button" className="sch-btn sch-btn--ghost sch-btn--today" onClick={goToday}>오늘</button>
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

      {loading ? <p className="sch-muted">불러오는 중...</p> : (
        <>
          <div className="sch-cal-grid" role="grid" aria-label={`${monthLabel} 수업 입력`}>
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
                const isToday = isSameDay(date, today);
                const isSelected = isSameDay(date, selectedDate);
                const planned = inMonth ? (scheduleByDate[dateStr] || []) : [];
                const instIds = getKoreanHoliday(dateStr)
                  ? []
                  : uniqueCalendarMarkersForDate(planned);
                const state = dayConfirmState(planned, entries);
                const holiday = getKoreanHoliday(dateStr);
                const statusKind = calendarDayStatusKind(planned, entries, { isHoliday: !!holiday });

                return (
                  <button
                    key={dateStr}
                    type="button"
                    role="gridcell"
                    disabled={!inMonth}
                    className={[
                      "sch-cal-cell",
                      !inMonth && "sch-cal-cell--muted",
                      isToday && "sch-cal-cell--today",
                      isSelected && "sch-cal-cell--selected",
                      holiday && "sch-cal-cell--holiday",
                      !holiday && state === "done" && "sch-cal-cell--confirmed",
                      !holiday && state === "partial" && "sch-cal-cell--partial",
                      !holiday && state === "pending" && planned.length > 0 && "sch-cal-cell--pending",
                      !holiday && state === "all_skipped" && "sch-cal-cell--skipped",
                      !holiday && state === "mixed" && "sch-cal-cell--mixed",
                    ].filter(Boolean).join(" ")}
                    onClick={() => inMonth && setSelectedDate(new Date(date))}
                    aria-selected={isSelected}
                    aria-label={`${date.getMonth() + 1}월 ${date.getDate()}일${holiday ? ` ${holiday.name}` : ""}${statusKind === "unconfirmed" ? " 미확인" : statusKind === "confirmed" ? " 등록완료" : ""}`}
                  >
                    {inMonth ? <CalendarDayStatusIcon kind={statusKind} /> : null}
                    <span className="sch-cal-day-num">{date.getDate()}</span>
                    {holiday ? (
                      <span className="sch-cal-holiday-label" title={holiday.name}>
                        {holidayShortLabel(holiday.name)}
                      </span>
                    ) : (
                      <span className="sch-cal-dots">
                        {instIds.map(marker => (
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

          <div className="sch-payroll-bulk-bar">
            <button
              type="button"
              className="sch-payroll-bulk-btn sch-payroll-bulk-btn--edit"
              disabled={saving || loading}
              onClick={handleMonthEdit}
            >
              수정
            </button>
            <button
              type="button"
              className="sch-payroll-bulk-btn sch-payroll-bulk-btn--confirm"
              disabled={saving || loading}
              onClick={handleMonthConfirmAll}
            >
              수업등록완료
            </button>
          </div>

          {!adminInspectMode ? (
            <TeacherNotesMonthList
              notes={teacherNotes}
              year={year}
              month={month}
              selectedDateStr={selectedDateStr}
              onSelectDate={handleNoteDateSelect}
            />
          ) : null}

          <section ref={detailRef} className="sch-cal-detail sch-payroll-detail">
            <h3 className="sch-cal-detail-title">
              {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일 ({DAY_LABELS[selectedDate.getDay()]})
            </h3>
            {selectedHoliday ? (
              <p className="sch-holiday-banner">
                공휴일 · {selectedHoliday.name} — 기본 수업 없음
                <span className="sch-holiday-banner-hint">실제 수업했다면 각 타임에서 수정해 주세요.</span>
              </p>
            ) : null}
            {selectedPlanned.length === 0 && selectedManualEntries.length === 0 ? (
              <p className="sch-muted">이 날짜에 예정된 수업이 없습니다.</p>
            ) : (
              <>
                {selectedDaySummary.count > 0 ? (
                  <p className="sch-payroll-day-summary">
                    {selectedDateStr === todayStr ? "오늘 " : ""}
                    총 {selectedDaySummary.count}개 수업, {selectedDaySummary.minutes.toLocaleString("ko-KR")}분
                    {selectedDaySummary.minutes > 0 ? " 진행" : ""}
                  </p>
                ) : null}
                {selectedPlanned.length > 0 ? (
                  <ul className="sch-payroll-slot-list sch-payroll-slot-list--compact">
                    {selectedPlanned.map(planned => {
                    const entry = findEntryForPlanned(entries, planned);
                    const locked = !isHomeVisitPlanned(planned) && isLocked(planned.institutionId);
                    const color = isHomeVisitPlanned(planned)
                      ? homeVisitColor(planned.patternId)
                      : institutionColor(planned.institutionId);
                    const status = getEffectiveSlotStatus(entry, planned.dateStr);

                    return (
                      <li key={`${planned.source}-${planned.slot.id}-${planned.dateStr}`} className={`sch-payroll-slot-row${locked ? " sch-payroll-slot-row--locked" : ""}`}>
                        <span className="sch-cal-detail-bar" style={{ background: color }}/>
                        <div className="sch-payroll-slot-row-body">
                          <div className="sch-payroll-slot-time">
                            {planned.startTime}–{planned.endTime}
                            <span className="sch-payroll-slot-type">{planned.payType}</span>
                          </div>
                          <div className="sch-payroll-slot-inst">
                            {plannedSlotDisplayLabel(planned)}
                          </div>
                          <div className={`sch-payroll-status sch-payroll-status--${status || "pending"}`}>
                            {effectiveSlotStatusLabel(planned, entry)}
                          </div>
                          {locked ? <span className="sch-lock-badge">정산 확정</span> : null}
                        </div>
                        {!locked && (selectedDateConfirmable || status) ? (
                          <div className="sch-payroll-slot-row-actions">
                            <button
                              type="button"
                              className="sch-payroll-edit-btn"
                              disabled={saving}
                              onClick={() => openCustom(planned)}
                            >
                              <Pencil size={13}/> 수정
                            </button>
                            {status ? (
                              !adminInspectMode ? (
                                <button
                                  type="button"
                                  className="sch-btn sch-btn--ghost sch-payroll-edit-btn sch-payroll-edit-btn--muted"
                                  disabled={saving}
                                  onClick={() => handleSlotReset(planned)}
                                >
                                  되돌리기
                                </button>
                              ) : null
                            ) : null}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                  </ul>
                ) : null}

                {selectedManualEntries.length > 0 ? (
                  <>
                    <h4 className="sch-payroll-extra-day-title">직접 추가한 수업</h4>
                    <ul className="sch-payroll-slot-list sch-payroll-slot-list--compact">
                      {selectedManualEntries.map(entry => {
                        const locked = entry.institution_id && isLocked(entry.institution_id);
                        const color = entry.institution_id
                          ? institutionColor(entry.institution_id)
                          : "#94a3b8";
                        return (
                          <li
                            key={entry.id}
                            className={`sch-payroll-slot-row sch-payroll-slot-row--manual${locked ? " sch-payroll-slot-row--locked" : ""}`}
                          >
                            <span className="sch-cal-detail-bar" style={{ background: color }}/>
                            <div className="sch-payroll-slot-row-body">
                              <div className="sch-payroll-slot-time">
                                {entry.minutes}분
                                <span className="sch-payroll-slot-type">{entry.pay_type}</span>
                              </div>
                              <div className="sch-payroll-slot-inst">{manualEntryLabel(entry)}</div>
                              <div className="sch-payroll-status sch-payroll-status--custom">
                                직접 추가 · {entry.minutes}분
                              </div>
                              {entry.note ? (
                                <div className="sch-muted sch-payroll-slot-note">{entry.note}</div>
                              ) : null}
                              {locked ? <span className="sch-lock-badge">정산 확정</span> : null}
                            </div>
                            {!locked && !adminInspectMode ? (
                              <div className="sch-payroll-slot-row-actions">
                                <button
                                  type="button"
                                  className="sch-payroll-edit-btn"
                                  disabled={saving}
                                  onClick={() => openExtraEdit(entry)}
                                >
                                  <Pencil size={13}/> 수정
                                </button>
                                <button
                                  type="button"
                                  className="sch-btn sch-btn--ghost sch-payroll-edit-btn sch-payroll-edit-btn--muted"
                                  disabled={saving}
                                  onClick={() => handleExtraDelete(entry)}
                                >
                                  삭제
                                </button>
                              </div>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </>
                ) : null}

                {selectedPlanned.length > 0 && selectedDateConfirmable && dayHasUnlockable && !adminInspectMode ? (
                  <div className="sch-payroll-day-actions">
                    <button
                      type="button"
                      className="sch-btn sch-btn--primary sch-payroll-day-btn"
                      disabled={saving}
                      onClick={handleDayConfirmAll}
                    >
                      {selectedDateStr <= todayStr
                        ? "오늘 전체 평소대로 진행했어요"
                        : "이 날 전체 평소대로 진행했어요"}
                    </button>
                    <button
                      type="button"
                      className="sch-btn sch-btn--ghost sch-payroll-day-btn sch-payroll-day-btn--skip"
                      disabled={saving}
                      onClick={handleDaySkipAll}
                    >
                      {selectedDateStr <= todayStr ? "오늘 전체 안 함" : "이 날 전체 안 함"}
                    </button>
                  </div>
                ) : selectedPlanned.length > 0 && selectedDayAllResolved ? (
                  <p className="sch-muted sch-payroll-day-done">
                    {selectedHoliday ? "공휴일로 수업 없음 처리되었습니다." : "이 날 수업은 모두 확정되었습니다."}
                  </p>
                ) : !selectedDateConfirmable ? (
                  <p className="sch-muted">
                    {today.getDate() < PAYROLL_EARLY_CONFIRM_DAY
                      ? `미래 날짜는 당일이 되면 확정할 수 있습니다. 매월 ${PAYROLL_EARLY_CONFIRM_DAY}일 이후에는 이번 달 말일까지 미리 확정할 수 있습니다.`
                      : "다음 달 날짜는 해당 월이 되면 확정할 수 있습니다."}
                  </p>
                ) : null}
              </>
            )}
            {!adminInspectMode ? (
              <TeacherNoteDayEditor
                noteDate={selectedDateStr}
                note={selectedNote}
                onSave={handleNoteSave}
                onDelete={handleNoteDelete}
                saving={noteSaving}
              />
            ) : null}
          </section>

          {!adminInspectMode ? (
          <details className="sch-payroll-extra">
            <summary>스케줄에 없는 수업 (개인레슨 등) 직접 추가</summary>
            <form className="sch-form sch-form--mobile" onSubmit={handleExtraSubmit}>
              <label className="sch-field">
                <span>날짜</span>
                <input type="date" className="sch-input" value={extraForm.class_date}
                  onChange={e => setExtraForm(f => ({ ...f, class_date: e.target.value }))}/>
              </label>
              <label className="sch-field">
                <span>원 (선택 — 개인레슨은 비워두세요)</span>
                <input type="text" className="sch-input" list="payroll-inst-list" placeholder="원 이름 검색"
                  onChange={e => {
                    const inst = institutionLegend.find(i => i.name === e.target.value);
                    setExtraForm(f => ({ ...f, institution_id: inst?.id || "" }));
                  }}/>
                <datalist id="payroll-inst-list">
                  {institutionLegend.map(i => <option key={i.id} value={i.name}/>)}
                </datalist>
              </label>
              <div className="sch-chip-row">
                {PAY_TYPES.map(t => (
                  <button key={t} type="button"
                    className={`sch-chip${extraForm.pay_type === t ? " active" : ""}`}
                    onClick={() => setExtraForm(f => ({ ...f, pay_type: t }))}>{t}</button>
                ))}
              </div>
              <label className="sch-field">
                <span>분</span>
                <input type="number" className="sch-input" min={1} value={extraForm.minutes}
                  onChange={e => setExtraForm(f => ({ ...f, minutes: e.target.value }))}/>
              </label>
              <button type="submit" className="sch-btn sch-btn--primary sch-btn--block" disabled={saving}>추가</button>
            </form>
          </details>
          ) : null}
        </>
      )}

      {!loading && !adminInspectMode && isScheduleSuperAdmin(me) ? (
        <PayrollDebugPanel
          weeklySlots={weeklySlots}
          homeVisitPatterns={monthHomeVisitPatterns}
          entries={entries}
          exceptions={exceptions}
          year={year}
          month={month}
        />
      ) : null}

      <div className="sch-payroll-stats-strip" role="group" aria-label="수업시간 요약">
        {PAY_TYPES.map(t => {
          const mins = byType[t] || 0;
          return (
            <div key={t} className="sch-payroll-stat">
              <div className="sch-payroll-stat-label">{t}</div>
              <div className="sch-payroll-stat-value">{formatMinutes(mins)}</div>
              {mins > 0 ? (
                <div className="sch-payroll-stat-sub">({mins.toLocaleString("ko-KR")}분)</div>
              ) : null}
            </div>
          );
        })}
        <div className={`sch-payroll-stat${unconfirmedDays > 0 ? " sch-payroll-stat--alert" : ""}`}>
          <div className="sch-payroll-stat-label">미확인 일수</div>
          <div className="sch-payroll-stat-value">{unconfirmedDays}일</div>
        </div>
        <div
          className={`sch-payroll-stat sch-payroll-stat--additional${additionalTotal > 0 ? " sch-payroll-stat--additional-active" : ""}`}
          title={
            additionalPayments.length > 0
              ? additionalPayments.map(p => formatTeacherAdditionalLine(p)).join("\n")
              : undefined
          }
        >
          <div className="sch-payroll-stat-label">
            {fixedMonthlySalary ? "추가지급 (고정급 외)" : "추가지급"}
          </div>
          <div className="sch-payroll-stat-value">
            {additionalTotal > 0
              ? `+${additionalTotal.toLocaleString("ko-KR")}원`
              : "0원"}
          </div>
        </div>
        {fixedMonthlySalary ? (
          <div className="sch-payroll-stat sch-payroll-stat--additional-active">
            <div className="sch-payroll-stat-label">월 고정급</div>
            <div className="sch-payroll-stat-value">
              {fixedMonthlySalary.baseGross.toLocaleString("ko-KR")}원
            </div>
          </div>
        ) : null}
      </div>

      <div className="sch-payroll-pay-cards">
        <div className="sch-payroll-pay-card">
          <div className="sch-payroll-pay-label">예상 급여</div>
          <div className="sch-payroll-pay-value">{formatWon(totalPay)}</div>
          {fixedGrossPay ? (
            <p className="sch-payroll-pay-hint">{fixedGrossPay.reason} · 스케줄·분 계산과 무관</p>
          ) : fixedMonthlySalary ? (
            <p className="sch-payroll-pay-hint">
              {fixedMonthlySalary.label} {formatWon(fixedMonthlySalary.baseGross)}
              {additionalTotal > 0 ? ` + 추가지급 ${formatWon(additionalTotal)}` : ""}
            </p>
          ) : lessonPay !== totalPay ? (
            <p className="sch-payroll-pay-hint">수업료 {formatWon(lessonPay)} + 추가지급</p>
          ) : null}
        </div>
        <div className="sch-payroll-pay-card">
          <div className="sch-payroll-pay-label">3.3% 세금 제외 후 실수령액</div>
          <div className="sch-payroll-pay-value">{formatWon(grossToNetPay(totalPay))}</div>
          <p className="sch-payroll-pay-hint">
            {fixedMonthlySalary
              ? `원천징수 ${formatWon(withholdingTax333(totalPay))} (고정급+추가지급 합계의 3.3%)`
              : "사업소득세 3.3% 원천징수 후 예상 금액 (수업료+추가지급)"}
          </p>
        </div>
      </div>

      {customEdit ? (
        <div className="sch-modal-overlay" onClick={() => setCustomEdit(null)}>
          <form className="sch-modal sch-form" onClick={e => e.stopPropagation()} onSubmit={handleCustomSave}>
            <h3>수업 수정</h3>
            <p className="sch-muted">
              {plannedSlotDisplayLabel(customEdit.planned)}
              {" · "}{customEdit.planned.payType} · {customEdit.planned.dateStr}
            </p>
            <div className="sch-chip-row">
              {QUICK_MINUTES.map(m => (
                <button key={m} type="button"
                  className={`sch-chip${Number(customEdit.minutes) === m ? " active" : ""}`}
                  onClick={() => setCustomEdit(c => ({ ...c, minutes: m }))}>
                  {m}분
                </button>
              ))}
            </div>
            <label className="sch-field">
              <span>수업 시간 (분)</span>
              <input type="number" className="sch-input" min={1} required
                value={customEdit.minutes}
                onChange={e => setCustomEdit(c => ({ ...c, minutes: e.target.value }))}/>
            </label>
            <div className="sch-time-row">
              <label className="sch-field">
                <span>시작 (참고)</span>
                <input type="time" className="sch-input" value={customEdit.startTime}
                  onChange={e => {
                    const start = e.target.value;
                    setCustomEdit(c => ({
                      ...c,
                      startTime: start,
                      minutes: c.endTime ? minutesBetween(start, c.endTime) : c.minutes,
                    }));
                  }}/>
              </label>
              <label className="sch-field">
                <span>종료 (참고)</span>
                <input type="time" className="sch-input" value={customEdit.endTime}
                  onChange={e => {
                    const end = e.target.value;
                    setCustomEdit(c => ({
                      ...c,
                      endTime: end,
                      minutes: c.startTime ? minutesBetween(c.startTime, end) : c.minutes,
                    }));
                  }}/>
              </label>
            </div>
            <label className="sch-field">
              <span>메모 (선택)</span>
              <input type="text" className="sch-input" value={customEdit.note}
                onChange={e => setCustomEdit(c => ({ ...c, note: e.target.value }))}/>
            </label>
            <div className="sch-form-actions sch-form-actions--stack">
              <button type="submit" className="sch-btn sch-btn--primary" disabled={saving}>저장</button>
              <button type="button" className="sch-btn sch-btn--ghost" disabled={saving}
                onClick={handleSlotSkip}>이 수업 안 함</button>
              <button type="button" className="sch-btn sch-btn--ghost" onClick={() => setCustomEdit(null)}>취소</button>
            </div>
          </form>
        </div>
      ) : null}

      {extraEdit ? (
        <div className="sch-modal-overlay" onClick={() => setExtraEdit(null)}>
          <form className="sch-modal sch-form" onClick={e => e.stopPropagation()} onSubmit={handleExtraEditSave}>
            <h3>직접 추가 수업 수정</h3>
            <p className="sch-muted">{extraEdit.class_date}</p>
            <label className="sch-field">
              <span>원 (선택 — 개인레슨은 비워두세요)</span>
              <input
                type="text"
                className="sch-input"
                list="payroll-inst-list"
                placeholder="원 이름 검색"
                value={extraEdit.institution_name}
                onChange={e => {
                  const name = e.target.value;
                  const inst = institutionLegend.find(i => i.name === name);
                  setExtraEdit(c => ({
                    ...c,
                    institution_name: name,
                    institution_id: inst?.id || "",
                  }));
                }}
              />
            </label>
            <div className="sch-chip-row">
              {PAY_TYPES.map(t => (
                <button
                  key={t}
                  type="button"
                  className={`sch-chip${extraEdit.pay_type === t ? " active" : ""}`}
                  onClick={() => setExtraEdit(c => ({ ...c, pay_type: t }))}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="sch-chip-row">
              {QUICK_MINUTES.map(m => (
                <button
                  key={m}
                  type="button"
                  className={`sch-chip${Number(extraEdit.minutes) === m ? " active" : ""}`}
                  onClick={() => setExtraEdit(c => ({ ...c, minutes: m }))}
                >
                  {m}분
                </button>
              ))}
            </div>
            <label className="sch-field">
              <span>분</span>
              <input
                type="number"
                className="sch-input"
                min={1}
                required
                value={extraEdit.minutes}
                onChange={e => setExtraEdit(c => ({ ...c, minutes: e.target.value }))}
              />
            </label>
            <label className="sch-field">
              <span>메모 (선택)</span>
              <input
                type="text"
                className="sch-input"
                value={extraEdit.note}
                onChange={e => setExtraEdit(c => ({ ...c, note: e.target.value }))}
              />
            </label>
            <div className="sch-form-actions sch-form-actions--stack">
              <button type="submit" className="sch-btn sch-btn--primary" disabled={saving}>저장</button>
              <button type="button" className="sch-btn sch-btn--ghost" onClick={() => setExtraEdit(null)}>취소</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
