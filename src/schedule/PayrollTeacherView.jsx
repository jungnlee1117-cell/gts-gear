import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, Pencil } from "lucide-react";
import { DAY_LABELS, PAY_TYPES, PAYROLL_SUMMARY_TYPES, formatMinutes, formatWon, grossToNetPay, homeVisitColor, institutionColor, isHomeVisitPlanned, minutesBetween, yearMonthKey } from "./constants.js";
import PayrollMonthNotices from "./PayrollMonthNotices.jsx";
import { TeacherNoteDayEditor, TeacherNotesMonthList } from "./TeacherNotesPanel.jsx";
import { noteByDate, normalizeNoteDate } from "./teacherNotes.js";
import {
  findFixedGrossPay,
  findFixedMonthlySalary,
  formatTeacherAdditionalLine,
  resolveTeacherMonthlyGross,
  sumAdditionalPayments,
  withholdingTax333,
} from "./additionalPayments.js";
import AdditionalPaymentRequestsTeacherSection from "./AdditionalPaymentRequestsTeacherSection.jsx";
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
  fetchSubstituteAssignmentsForTeacher,
  fetchTeacherNotes,
  fetchTeachers,
  fetchWeeklySchedule,
  savePayrollEntry,
  upsertTeacherNote,
} from "./api.js";
import {
  bulkUpsertPayrollSlotsWithNotifications,
  upsertPayrollSlotWithNotification,
} from "./payrollSaveWithNotification.js";
import ChangeReasonField from "./ChangeReasonField.jsx";
import {
  isMakeupReason,
  isSubstituteReason,
  resolveChangeReason,
  validateChangeReason,
} from "./changeReasonOptions.js";
import { shouldNotifyScheduleChange } from "./scheduleChangeNotifications.js";
import { estimateTeacherPayByEntry, payRelevantEntries } from "./settlement.js";
import {
  ENTRY_STATUS,
  calendarPayrollBadgesForDate,
  collectUnconfirmedPlanned,
  countUnconfirmedDays,
  isDateConfirmable,
  PAYROLL_EARLY_CONFIRM_DAY,
  dayConfirmState,
  effectiveSlotStatusLabel,
  expandMonthSchedule,
  findEntryForPlanned,
  findMakeupEntriesForDate,
  findManualExtraEntriesForDate,
  formatKoMonthDay,
  plannedSlotDisplayLabel,
  getEffectiveSlotStatus,
  getMonthGrid,
  fmtLocalDate,
  isSameDay,
  isMakeupRescheduled,
  isSlotUnconfirmed,
  groupPayrollByTypeConfirmed,
  payrollCalendarDayMark,
} from "./payrollCalendar.js";
import { patternsForCalendarMonth } from "./homeVisitPatterns.js";
import { buildHomeVisitLegend, buildInstitutionLegend, resolveInstitutionDisplayName } from "./calendarLegend.js";
import {
  getKoreanHoliday,
  holidayShortLabel,
} from "./koreanHolidays.js";
import { filterExceptionsForInstitutions } from "./scheduleExceptions.js";
import PayrollDebugPanel from "./PayrollDebugPanel.jsx";
import { applySubstituteOverlaysToSchedule } from "./substituteSchedule.js";
import { isScheduleSuperAdmin } from "./managerScope.js";
import { useScheduleAuthReady } from "./ScheduleAuthContext.jsx";

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
  const canEditPayroll = !adminInspectMode || isScheduleSuperAdmin(me);
  const scheduleAuthReady = useScheduleAuthReady();
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
  const [allInstitutions, setAllInstitutions] = useState([]);
  const [entries, setEntries] = useState([]);
  const [exceptions, setExceptions] = useState([]);
  const [teacherNotes, setTeacherNotes] = useState([]);
  const [additionalPayments, setAdditionalPayments] = useState([]);
  const [rates, setRates] = useState([]);
  const [substituteAssignments, setSubstituteAssignments] = useState([]);
  const [finalizedIds, setFinalizedIds] = useState(new Set());
  const [teacherOptions, setTeacherOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [customEdit, setCustomEdit] = useState(null);
  const [extraEdit, setExtraEdit] = useState(null);
  const [bulkSkipModal, setBulkSkipModal] = useState(false);
  const [bulkSkipReason, setBulkSkipReason] = useState({ preset: "", custom: "" });
  const [bulkEditModal, setBulkEditModal] = useState(null); // { rows: [{ plannedKey, planned, minutes }] }
  const detailRef = useRef(null);

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

  useEffect(() => {
    fetchTeachers({ yearMonth })
      .then(rows => setTeacherOptions((rows || []).filter(t => t.role === "teacher")))
      .catch(console.error);
  }, [yearMonth]);

  const teachersById = useMemo(() => {
    const m = new Map();
    for (const t of teacherOptions) m.set(t.id, t);
    return m;
  }, [teacherOptions]);

  const load = useCallback(async () => {
    if (!teacherId || !scheduleAuthReady) return;
    setLoading(true);
    try {
      const [w, hv, insts, allInsts, ents, ex, notes, adds, rts, fin, subs] = await Promise.all([
        fetchWeeklySchedule(null, teacherId),
        fetchHomeVisitPatterns({ teacherId }),
        fetchInstitutions({ teacherScope: !adminInspectMode, activeOnly: true }),
        fetchInstitutions({ teacherScope: false, activeOnly: true }),
        fetchPayrollEntries({ teacherId, yearMonth }),
        fetchScheduleExceptions(null, rangeFrom, rangeTo),
        fetchTeacherNotes({ teacherId, fromDate: rangeFrom, toDate: rangeTo }),
        fetchAdditionalPayments({ teacherId, yearMonth }),
        fetchPayRates(teacherId),
        fetchFinalizedInstitutionIds(yearMonth),
        fetchSubstituteAssignmentsForTeacher(teacherId, rangeFrom, rangeTo),
      ]);
      setWeeklySlots(w);
      setHomeVisitPatterns(hv);
      if (adminInspectMode) {
        const byId = new Map();
        for (const slot of w || []) {
          if (slot.institutions?.id) byId.set(slot.institutions.id, slot.institutions);
        }
        setAssignedInstitutions([...byId.values()]);
      } else {
        setAssignedInstitutions(insts);
      }
      setAllInstitutions(allInsts);
      setEntries(ents);
      setExceptions(ex);
      setTeacherNotes(notes);
      setAdditionalPayments(adds);
      setRates(rts);
      setFinalizedIds(fin);
      setSubstituteAssignments(subs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [teacherId, scheduleAuthReady, adminInspectMode, yearMonth, rangeFrom, rangeTo]);

  useEffect(() => {
    if (!teacherId || !scheduleAuthReady) {
      if (!teacherId) setLoading(false);
      return;
    }
    load();
  }, [load, teacherId, scheduleAuthReady]);

  const monthHomeVisitPatterns = useMemo(
    () => patternsForCalendarMonth(homeVisitPatterns, rangeFrom, rangeTo),
    [homeVisitPatterns, rangeFrom, rangeTo],
  );

  const teacherInstitutionIds = useMemo(() => {
    const ids = new Set();
    for (const s of weeklySlots || []) {
      if (s.institution_id) ids.add(s.institution_id);
    }
    // 선생님 본인 화면: 담당 원 목록도 포함
    // 관리자 조회 화면: assignedInstitutions가 전체 원이라 주간 스케줄만 사용
    if (!adminInspectMode) {
      for (const i of assignedInstitutions || []) {
        if (i?.id) ids.add(i.id);
      }
    }
    return ids;
  }, [weeklySlots, assignedInstitutions, adminInspectMode]);

  const teacherExceptions = useMemo(
    () => filterExceptionsForInstitutions(exceptions, teacherInstitutionIds),
    [exceptions, teacherInstitutionIds],
  );

  const scheduleByDate = useMemo(
    () => expandMonthSchedule(weeklySlots, year, month, teacherExceptions, monthHomeVisitPatterns),
    [weeklySlots, year, month, teacherExceptions, monthHomeVisitPatterns],
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
      weeklySlots,
      scheduleByDate,
      assignedInstitutions,
    }),
    [weeklySlots, scheduleByDate, assignedInstitutions],
  );

  const byType = useMemo(
    () => groupPayrollByTypeConfirmed(entries, teacherId),
    [entries, teacherId],
  );

  const payEntries = useMemo(
    () => payRelevantEntries(entries, teacherId),
    [entries, teacherId],
  );

  const makeupPayEntries = useMemo(
    () => payEntries.filter(e => e.is_makeup),
    [payEntries],
  );

  const slotById = useMemo(() => {
    const map = {};
    for (const s of weeklySlots) map[s.id] = s;
    return map;
  }, [weeklySlots]);

  const lessonPay = useMemo(
    () => estimateTeacherPayByEntry(payEntries, rates, slotById, teacherId),
    [payEntries, rates, slotById, teacherId],
  );

  const makeupPay = useMemo(
    () => estimateTeacherPayByEntry(makeupPayEntries, rates, slotById, teacherId),
    [makeupPayEntries, rates, slotById, teacherId],
  );
  const fixedGrossPay = useMemo(
    () => findFixedGrossPay(teacherId, yearMonth),
    [teacherId, yearMonth],
  );
  const fixedMonthlySalary = useMemo(
    () => findFixedMonthlySalary(teacherId),
    [teacherId],
  );
  const displayAdditionalPayments = additionalPayments;
  const totalPay = useMemo(
    () => resolveTeacherMonthlyGross(
      teacherId, yearMonth, lessonPay, additionalPayments, teacherName,
    ),
    [teacherId, yearMonth, lessonPay, additionalPayments, teacherName],
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
  const selectedPlanned = displayScheduleByDate[selectedDateStr] || [];
  const selectedManualEntries = useMemo(
    () => findManualExtraEntriesForDate(entries, selectedDateStr, selectedPlanned),
    [entries, selectedDateStr, selectedPlanned],
  );
  const selectedMakeupArrivals = useMemo(
    () => findMakeupEntriesForDate(entries, selectedDateStr, teacherId),
    [entries, selectedDateStr, teacherId],
  );
  const selectedNote = noteByDate(teacherNotes, selectedDateStr);
  const selectedHoliday = getKoreanHoliday(selectedDateStr);
  const selectedDaySummary = useMemo(() => {
    let minutes = 0;
    let count = 0;
    for (const p of selectedPlanned) {
      const entry = findEntryForPlanned(entries, p);
      if (entry?.entry_status === ENTRY_STATUS.skipped) continue;
      // 보강으로 옮긴 수업은 원래 날짜에서 분 집계 제외 (보강일에 표시)
      if (isMakeupRescheduled(entry)) continue;
      count += 1;
      minutes += entry?.minutes ?? p.scheduledMinutes;
    }
    for (const e of selectedManualEntries) {
      if (e.entry_status === ENTRY_STATUS.skipped) continue;
      if (isMakeupRescheduled(e)) continue;
      minutes += e.minutes || 0;
      count += 1;
    }
    for (const e of selectedMakeupArrivals) {
      minutes += e.minutes || 0;
      count += 1;
    }
    return { count, minutes };
  }, [selectedPlanned, selectedManualEntries, selectedMakeupArrivals, entries]);

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

  const buildPayload = (planned, {
    status,
    minutes,
    note,
    substitute_teacher_id = null,
    is_makeup = false,
    makeup_date = null,
    makeup_start_time = null,
    makeup_end_time = null,
  }) => {
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
      substitute_teacher_id: substitute_teacher_id || null,
      is_makeup: Boolean(is_makeup),
      makeup_date: is_makeup && makeup_date ? String(makeup_date).slice(0, 10) : null,
      makeup_start_time: is_makeup && makeup_start_time
        ? (String(makeup_start_time).length === 5 ? `${makeup_start_time}:00` : makeup_start_time)
        : null,
      makeup_end_time: is_makeup && makeup_end_time
        ? (String(makeup_end_time).length === 5 ? `${makeup_end_time}:00` : makeup_end_time)
        : null,
    };
  };

  const bulkSavePlanned = async (plannedList, {
    status,
    minutesFor,
    changeReason,
    includeResolved = false,
  }) => {
    const targets = filterUnlocked(
      plannedList.filter(p => includeResolved || isSlotUnconfirmed(entries, p)),
    );
    if (!targets.length) {
      alert(includeResolved
        ? "처리할 수업이 없습니다."
        : "확정할 수업이 없습니다. (이미 확정·수정·수업 안 함 처리됨)");
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
        handlingExtra: changeReason ? { changeReason } : {},
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

  const plannedKeyOf = (planned) =>
    `${planned.source}-${planned.slot?.id || planned.patternId}-${planned.dateStr}`;

  const dayUnlockablePlanned = filterUnlocked(selectedPlanned);
  const daySkippedUnlockable = dayUnlockablePlanned.filter((p) => {
    const entry = findEntryForPlanned(entries, p);
    return getEffectiveSlotStatus(entry, p.dateStr) === ENTRY_STATUS.skipped;
  });
  const dayUnconfirmedUnlockable = dayUnlockablePlanned.filter(
    (p) => isSlotUnconfirmed(entries, p),
  );

  const handleDayConfirmAll = () => {
    const n = dayUnconfirmedUnlockable.length;
    if (!n) return alert("평소대로 확정할 미확인 수업이 없습니다.");
    if (!confirm(`이 날짜의 미확인 수업 ${n}개를 평소대로 확정할까요?`)) return;
    bulkSavePlanned(selectedPlanned, {
      status: ENTRY_STATUS.as_scheduled,
      minutesFor: p => p.scheduledMinutes,
    });
  };

  const handleSlotConfirm = (planned) => {
    bulkSavePlanned([planned], {
      status: ENTRY_STATUS.as_scheduled,
      minutesFor: p => p.scheduledMinutes,
    });
  };

  const handleDaySkipAll = () => {
    if (!dayUnlockablePlanned.length) {
      alert("휴강 처리할 수업이 없습니다.");
      return;
    }
    setBulkSkipReason({ preset: "", custom: "" });
    setBulkSkipModal(true);
  };

  const handleBulkSkipConfirm = async (e) => {
    e.preventDefault();
    const n = dayUnlockablePlanned.length;
    if (!n) return;
    if (!confirm(`이 날짜의 모든 수업(${n}개)을 휴강 처리하시겠습니까?`)) return;
    const reason = resolveChangeReason(bulkSkipReason.preset, bulkSkipReason.custom);
    setBulkSkipModal(false);
    await bulkSavePlanned(selectedPlanned, {
      status: ENTRY_STATUS.skipped,
      minutesFor: () => 0,
      changeReason: reason || "전체 휴강",
      includeResolved: true,
    });
  };

  const handleDaySkipCancelAll = async () => {
    const targets = daySkippedUnlockable;
    if (!targets.length) {
      alert("취소할 휴강 수업이 없습니다.");
      return;
    }
    if (!confirm(`전체 휴강 ${targets.length}건을 취소하고 미확인 상태로 되돌릴까요?`)) return;
    setSaving(true);
    try {
      for (const p of targets) {
        const existing = findEntryForPlanned(entries, p);
        if (existing?.id) await deletePayrollEntry(existing.id);
      }
      await load();
    } catch (err) {
      alert("취소 실패: " + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  const openBulkEdit = () => {
    if (!dayUnlockablePlanned.length) {
      alert("수정할 수업이 없습니다.");
      return;
    }
    setBulkEditModal({
      rows: dayUnlockablePlanned.map((planned) => {
        const entry = findEntryForPlanned(entries, planned);
        const minutes = entry?.entry_status && entry.entry_status !== ENTRY_STATUS.skipped
          ? (Number(entry.minutes) || planned.scheduledMinutes)
          : planned.scheduledMinutes;
        return {
          plannedKey: plannedKeyOf(planned),
          planned,
          minutes,
        };
      }),
      changeReasonPreset: "",
      changeReasonCustom: "",
    });
  };

  const handleBulkEditSave = async (e) => {
    e.preventDefault();
    if (!bulkEditModal?.rows?.length) return;
    const reasonErr = validateChangeReason(
      bulkEditModal.changeReasonPreset,
      bulkEditModal.changeReasonCustom,
    );
    if (reasonErr) return alert(reasonErr);
    for (const row of bulkEditModal.rows) {
      const mins = Number(row.minutes);
      if (!mins || mins <= 0) {
        return alert("모든 수업은 1분 이상이어야 합니다.");
      }
    }
    const changeReason = resolveChangeReason(
      bulkEditModal.changeReasonPreset,
      bulkEditModal.changeReasonCustom,
    );
    setSaving(true);
    try {
      const payloads = bulkEditModal.rows.map(({ planned, minutes }) => {
        const mins = Number(minutes);
        const isCustom = mins !== planned.scheduledMinutes;
        return {
          planned,
          payload: buildPayload(planned, {
            status: isCustom ? ENTRY_STATUS.custom : ENTRY_STATUS.as_scheduled,
            minutes: mins,
          }),
          handlingExtra: { changeReason },
        };
      });
      await bulkUpsertPayrollSlotsWithNotifications(payloads);
      setBulkEditModal(null);
      await load();
    } catch (err) {
      alert("저장 실패: " + (err.message || err));
    } finally {
      setSaving(false);
    }
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

  const handleNoteEdit = (note) => {
    handleNoteDateSelect(normalizeNoteDate(note.note_date));
    requestAnimationFrame(() => {
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const openCustom = (planned) => {
    const existing = findEntryForPlanned(entries, planned);
    let changeReasonPreset = "";
    if (existing?.substitute_teacher_id) changeReasonPreset = "대체수업";
    else if (existing?.is_makeup) changeReasonPreset = "보강수업";
    setCustomEdit({
      planned,
      minutes: existing?.entry_status === ENTRY_STATUS.custom
        || existing?.substitute_teacher_id
        || existing?.is_makeup
        ? (existing.minutes || planned.scheduledMinutes)
        : planned.scheduledMinutes,
      startTime: planned.startTime,
      endTime: planned.endTime,
      note: existing?.note || "",
      changeReasonPreset,
      changeReasonCustom: "",
      substituteTeacherId: existing?.substitute_teacher_id || "",
      makeupDate: existing?.makeup_date ? String(existing.makeup_date).slice(0, 10) : "",
      makeupStartTime: existing?.makeup_start_time
        ? String(existing.makeup_start_time).slice(0, 5)
        : planned.startTime,
      makeupEndTime: existing?.makeup_end_time
        ? String(existing.makeup_end_time).slice(0, 5)
        : planned.endTime,
    });
  };

  const customEditNeedsReason = useMemo(() => {
    if (!customEdit) return false;
    if (isSubstituteReason(customEdit.changeReasonPreset)
      || isMakeupReason(customEdit.changeReasonPreset)) {
      return true;
    }
    const savePayload = buildPayload(customEdit.planned, {
      status: ENTRY_STATUS.custom,
      minutes: Number(customEdit.minutes) || 0,
      note: customEdit.note,
    });
    const timeExtra = {
      startTime: customEdit.startTime,
      endTime: customEdit.endTime,
    };
    const skipPayload = buildPayload(customEdit.planned, {
      status: ENTRY_STATUS.skipped,
      minutes: 0,
      note: customEdit.note,
    });
    return shouldNotifyScheduleChange(customEdit.planned, savePayload, timeExtra)
      || shouldNotifyScheduleChange(customEdit.planned, skipPayload);
  }, [customEdit, entries, teacherId]);

  const handleCustomSave = async (e) => {
    e.preventDefault();
    if (!customEdit) return;
    if (isLocked(customEdit.planned.institutionId)) {
      return alert("정산 확정된 원은 수정할 수 없습니다.");
    }

    const isSub = isSubstituteReason(customEdit.changeReasonPreset);
    const isMk = isMakeupReason(customEdit.changeReasonPreset);

    if (isSub) {
      if (!customEdit.substituteTeacherId) return alert("대체 선생님을 선택해주세요.");
      if (customEdit.substituteTeacherId === teacherId) {
        return alert("본인은 대체 선생님으로 선택할 수 없습니다.");
      }
    }
    if (isMk) {
      if (!customEdit.makeupDate) return alert("보강 날짜를 입력해주세요.");
      if (!customEdit.makeupStartTime || !customEdit.makeupEndTime) {
        return alert("보강 시작·종료 시간을 입력해주세요.");
      }
      if (customEdit.makeupStartTime >= customEdit.makeupEndTime) {
        return alert("보강 종료 시간은 시작 시간보다 늦어야 합니다.");
      }
    }

    let mins = Number(customEdit.minutes);
    if (isMk) {
      mins = minutesBetween(customEdit.makeupStartTime, customEdit.makeupEndTime) || mins;
    }
    if (!mins || mins <= 0) return alert("1분 이상 입력해주세요.");

    const payload = buildPayload(customEdit.planned, {
      status: ENTRY_STATUS.custom,
      minutes: mins,
      note: customEdit.note,
      substitute_teacher_id: isSub ? customEdit.substituteTeacherId : null,
      is_makeup: isMk,
      makeup_date: isMk ? customEdit.makeupDate : null,
      makeup_start_time: isMk ? customEdit.makeupStartTime : null,
      makeup_end_time: isMk ? customEdit.makeupEndTime : null,
    });
    const handlingExtra = {
      startTime: isMk ? customEdit.makeupStartTime : customEdit.startTime,
      endTime: isMk ? customEdit.makeupEndTime : customEdit.endTime,
    };
    const needsReason = customEditNeedsReason
      || shouldNotifyScheduleChange(customEdit.planned, payload, handlingExtra);
    if (needsReason) {
      const reasonErr = validateChangeReason(
        customEdit.changeReasonPreset,
        customEdit.changeReasonCustom,
      );
      if (reasonErr) return alert(reasonErr);
      handlingExtra.changeReason = resolveChangeReason(
        customEdit.changeReasonPreset,
        customEdit.changeReasonCustom,
      );
    }
    setSaving(true);
    try {
      await upsertPayrollSlotWithNotification(customEdit.planned, payload, handlingExtra);
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
    const payload = buildPayload(customEdit.planned, {
      status: ENTRY_STATUS.skipped,
      minutes: 0,
      note: customEdit.note,
    });
    let handlingExtra = {};
    if (shouldNotifyScheduleChange(customEdit.planned, payload, handlingExtra)) {
      const reasonErr = validateChangeReason(
        customEdit.changeReasonPreset,
        customEdit.changeReasonCustom,
      );
      if (reasonErr) return alert(reasonErr);
      handlingExtra = {
        changeReason: resolveChangeReason(
          customEdit.changeReasonPreset,
          customEdit.changeReasonCustom,
        ),
      };
    }
    setSaving(true);
    try {
      await upsertPayrollSlotWithNotification(customEdit.planned, payload, handlingExtra);
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

  const selectedDayBusyRanges = useMemo(() => {
    return (selectedPlanned || [])
      .filter(p => p.startTime && p.endTime)
      .map(p => ({
        start: p.startTime,
        end: p.endTime,
        label: p.institutionName || p.studentName || p.payType || "수업",
      }));
  }, [selectedPlanned]);

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
        {adminInspectMode && canEditPayroll ? (
          <p className="sch-muted sch-payroll-admin-inspect-hint">슈퍼관리자 · 수업시간 등록·수정 가능</p>
        ) : null}
      </header>

      <PayrollMonthNotices exceptions={teacherExceptions} year={year} month={month}/>

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
                const state = dayConfirmState(planned, entries);
                const holiday = getKoreanHoliday(dateStr);
                const dayMark = inMonth
                  ? payrollCalendarDayMark(planned, entries, dateStr, {
                    isHoliday: !!holiday,
                    teacherId,
                  })
                  : null;
                const payrollBadges = inMonth && !holiday
                  ? calendarPayrollBadgesForDate(entries, dateStr)
                  : [];
                const classLines = dayMark?.kind === "confirmed" ? (dayMark.lines || []) : [];

                const markLabel = dayMark?.kind === "confirmed"
                  ? classLines.map((l) => l.label).join(", ")
                  : dayMark?.kind === "skipped"
                    ? "수업 안 함"
                    : "";

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
                      dayMark?.kind === "confirmed" && "sch-cal-cell--has-mark",
                      dayMark?.kind === "skipped" && "sch-cal-cell--has-skip",
                    ].filter(Boolean).join(" ")}
                    onClick={() => inMonth && setSelectedDate(new Date(date))}
                    aria-selected={isSelected}
                    aria-label={`${date.getMonth() + 1}월 ${date.getDate()}일${holiday ? ` ${holiday.name}` : ""}${markLabel ? ` ${markLabel}` : ""}`}
                  >
                    <span className="sch-cal-day-num">{date.getDate()}</span>
                    {dayMark?.kind === "skipped" ? (
                      <span className="sch-cal-payroll-mark sch-cal-payroll-mark--skip">
                        ❌
                      </span>
                    ) : null}
                    {payrollBadges.map(b => (
                      <span
                        key={b.kind}
                        className={`sch-cal-sub-badge sch-cal-sub-badge--${b.kind}`}
                      >
                        {b.label}
                      </span>
                    ))}
                    {holiday ? (
                      <span className="sch-cal-holiday-label" title={holiday.name}>
                        {holidayShortLabel(holiday.name)}
                      </span>
                    ) : classLines.length > 0 ? (
                      <span className="sch-cal-class-lines">
                        {classLines.map((line) => {
                          const color = line.colorKind === "home_visit"
                            ? homeVisitColor(line.colorId)
                            : institutionColor(line.colorId);
                          return (
                            <span
                              key={line.key}
                              className={[
                                "sch-cal-class-line",
                                line.colorKind === "makeup" && "sch-cal-class-line--makeup",
                                line.colorKind === "reschedule" && "sch-cal-class-line--reschedule",
                              ].filter(Boolean).join(" ")}
                              title={[line.label, line.sublabel].filter(Boolean).join(" · ")}
                              style={{
                                color,
                                background: `${color}22`,
                                borderColor: `${color}55`,
                              }}
                            >
                              <span className="sch-cal-class-line-main">{line.label}</span>
                              {line.sublabel ? (
                                <span className="sch-cal-class-line-sub">{line.sublabel}</span>
                              ) : null}
                            </span>
                          );
                        })}
                      </span>
                    ) : null}
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

          {canEditPayroll ? (
            <TeacherNotesMonthList
              notes={teacherNotes}
              year={year}
              month={month}
              selectedDateStr={selectedDateStr}
              onSelectDate={handleNoteDateSelect}
              onEdit={handleNoteEdit}
              onDelete={handleNoteDelete}
              editable={canEditPayroll}
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
            {selectedPlanned.length === 0 && selectedManualEntries.length === 0 && selectedMakeupArrivals.length === 0 ? (
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

                {selectedPlanned.length > 0 && selectedDateConfirmable && canEditPayroll && dayUnlockablePlanned.length > 0 ? (
                  <div className="sch-payroll-day-actions sch-payroll-day-actions--top">
                    {dayUnconfirmedUnlockable.length > 0 ? (
                      <button
                        type="button"
                        className="sch-btn sch-btn--primary sch-payroll-day-btn"
                        disabled={saving}
                        onClick={handleDayConfirmAll}
                      >
                        전체 평소대로
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="sch-btn sch-btn--ghost sch-payroll-day-btn"
                      disabled={saving}
                      onClick={openBulkEdit}
                    >
                      전체 수정
                    </button>
                    {daySkippedUnlockable.length < dayUnlockablePlanned.length ? (
                      <button
                        type="button"
                        className="sch-btn sch-btn--ghost sch-payroll-day-btn sch-payroll-day-btn--skip"
                        disabled={saving}
                        onClick={handleDaySkipAll}
                      >
                        전체 휴강
                      </button>
                    ) : null}
                    {daySkippedUnlockable.length > 0 ? (
                      <button
                        type="button"
                        className="sch-btn sch-btn--ghost sch-payroll-day-btn"
                        disabled={saving}
                        onClick={handleDaySkipCancelAll}
                      >
                        전체 휴강 취소
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {selectedPlanned.length > 0 ? (
                  <ul className="sch-payroll-slot-grid">
                    {selectedPlanned.map(planned => {
                    const entry = findEntryForPlanned(entries, planned);
                    const locked = !isHomeVisitPlanned(planned) && isLocked(planned.institutionId);
                    const color = isHomeVisitPlanned(planned)
                      ? homeVisitColor(planned.patternId)
                      : institutionColor(planned.institutionId);
                    const status = getEffectiveSlotStatus(entry, planned.dateStr);

                    return (
                      <li key={`${planned.source}-${planned.slot.id}-${planned.dateStr}`} className={[
                        "sch-payroll-slot-card",
                        locked && "sch-payroll-slot-card--locked",
                        planned.isSubstituteCovered && "sch-payroll-slot-card--substitute",
                        status && status !== ENTRY_STATUS.skipped && "sch-payroll-slot-card--done",
                        status === ENTRY_STATUS.skipped && "sch-payroll-slot-card--skipped",
                      ].filter(Boolean).join(" ")}>
                        <span className="sch-payroll-slot-card-accent" style={{ background: color }} aria-hidden/>
                        <div className="sch-payroll-slot-card-body">
                          <div className="sch-payroll-slot-card-head">
                            <span className="sch-payroll-slot-time">
                              {planned.startTime}–{planned.endTime}
                            </span>
                            <span className="sch-payroll-slot-type">{planned.payType}</span>
                          </div>
                          <div className="sch-payroll-slot-inst">
                            {plannedSlotDisplayLabel(planned)}
                          </div>
                          <div className={`sch-payroll-status sch-payroll-status--${status || "pending"}`}>
                            {effectiveSlotStatusLabel(planned, entry, { teachersById })}
                          </div>
                          {locked ? <span className="sch-lock-badge">정산 확정</span> : null}
                        </div>
                        {!locked && (selectedDateConfirmable || status) ? (
                          <div className="sch-payroll-slot-card-actions">
                            {!status && selectedDateConfirmable && canEditPayroll ? (
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
                            {status && canEditPayroll ? (
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

                {selectedManualEntries.length > 0 ? (
                  <>
                    <h4 className="sch-payroll-extra-day-title">직접 추가한 수업</h4>
                    <ul className="sch-payroll-slot-grid">
                      {selectedManualEntries.map(entry => {
                        const locked = entry.institution_id && isLocked(entry.institution_id);
                        const color = entry.institution_id
                          ? institutionColor(entry.institution_id)
                          : "#94a3b8";
                        const rescheduledOut = isMakeupRescheduled(entry)
                          && String(entry.makeup_date).slice(0, 10) !== selectedDateStr;
                        return (
                          <li
                            key={entry.id}
                            className={`sch-payroll-slot-card sch-payroll-slot-card--manual${locked ? " sch-payroll-slot-card--locked" : ""}${rescheduledOut ? " sch-payroll-slot-card--reschedule" : ""}`}
                          >
                            <span className="sch-payroll-slot-card-accent" style={{ background: color }} aria-hidden/>
                            <div className="sch-payroll-slot-card-body">
                              <div className="sch-payroll-slot-card-head">
                                <span className="sch-payroll-slot-time">{entry.minutes}분</span>
                                <span className="sch-payroll-slot-type">{entry.pay_type}</span>
                              </div>
                              <div className="sch-payroll-slot-inst">{manualEntryLabel(entry)}</div>
                              <div className={`sch-payroll-status ${rescheduledOut ? "sch-payroll-status--reschedule" : "sch-payroll-status--custom"}`}>
                                {rescheduledOut
                                  ? `수업변경 → ${formatKoMonthDay(entry.makeup_date)}`
                                  : `직접 추가 · ${entry.minutes}분`}
                              </div>
                              {entry.note ? (
                                <div className="sch-muted sch-payroll-slot-note">{entry.note}</div>
                              ) : null}
                              {locked ? <span className="sch-lock-badge">정산 확정</span> : null}
                            </div>
                            {!locked && canEditPayroll ? (
                              <div className="sch-payroll-slot-card-actions">
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

                {selectedMakeupArrivals.length > 0 ? (
                  <>
                    <h4 className="sch-payroll-extra-day-title">보강 수업</h4>
                    <ul className="sch-payroll-slot-grid">
                      {selectedMakeupArrivals.map(entry => {
                        const locked = entry.institution_id && isLocked(entry.institution_id);
                        const color = entry.institution_id
                          ? institutionColor(entry.institution_id)
                          : "#94a3b8";
                        const name = manualEntryLabel(entry);
                        const mins = Number(entry.minutes) || 0;
                        const timeLabel = entry.makeup_start_time && entry.makeup_end_time
                          ? `${String(entry.makeup_start_time).slice(0, 5)}–${String(entry.makeup_end_time).slice(0, 5)}`
                          : `${mins}분`;
                        return (
                          <li
                            key={`makeup-${entry.id}`}
                            className={`sch-payroll-slot-card sch-payroll-slot-card--makeup${locked ? " sch-payroll-slot-card--locked" : ""}`}
                          >
                            <span className="sch-payroll-slot-card-accent" style={{ background: color }} aria-hidden/>
                            <div className="sch-payroll-slot-card-body">
                              <div className="sch-payroll-slot-card-head">
                                <span className="sch-payroll-slot-time">{timeLabel}</span>
                                <span className="sch-payroll-slot-type">{entry.pay_type}</span>
                              </div>
                              <div className="sch-payroll-slot-inst">
                                (보강) {name} {mins}분
                              </div>
                              <div className="sch-payroll-status sch-payroll-status--makeup">
                                {formatKoMonthDay(entry.class_date)} 수업 보강
                              </div>
                              {entry.note ? (
                                <div className="sch-muted sch-payroll-slot-note">{entry.note}</div>
                              ) : null}
                              {locked ? <span className="sch-lock-badge">정산 확정</span> : null}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                ) : null}

                {selectedPlanned.length > 0 && selectedDayAllResolved && !(selectedDateConfirmable && canEditPayroll && dayUnlockablePlanned.length > 0) ? (
                  <p className="sch-muted sch-payroll-day-done">
                    {selectedHoliday ? "공휴일로 수업 없음 처리되었습니다." : "이 날 수업은 모두 확정되었습니다."}
                  </p>
                ) : !selectedDateConfirmable && selectedPlanned.length > 0 ? (
                  <p className="sch-muted">
                    {today.getDate() < PAYROLL_EARLY_CONFIRM_DAY
                      ? `미래 날짜는 당일이 되면 확정할 수 있습니다. 매월 ${PAYROLL_EARLY_CONFIRM_DAY}일 이후에는 이번 달 말일까지 미리 확정할 수 있습니다.`
                      : "다음 달 날짜는 해당 월이 되면 확정할 수 있습니다."}
                  </p>
                ) : null}
              </>
            )}
            <AdditionalPaymentRequestsTeacherSection
              teacherId={teacherId}
              teacherName={teacherName}
              yearMonth={yearMonth}
              defaultDate={selectedDateStr}
              institutions={allInstitutions.length ? allInstitutions : assignedInstitutions}
              rates={rates}
              busyRanges={selectedDayBusyRanges}
              skipPush={isScheduleSuperAdmin(me)}
              autoApproveExpense={isScheduleSuperAdmin(me)}
              reviewerId={me?.id || null}
              isInstitutionLocked={isLocked}
              onPayrollChanged={load}
              readOnly={adminInspectMode && !canEditPayroll}
            />
            {canEditPayroll ? (
              <TeacherNoteDayEditor
                noteDate={selectedDateStr}
                note={selectedNote}
                onSave={handleNoteSave}
                onDelete={handleNoteDelete}
                saving={noteSaving}
              />
            ) : null}
          </section>
        </>
      )}

      {!loading && isScheduleSuperAdmin(me) ? (
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
        {PAYROLL_SUMMARY_TYPES.map(t => {
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
            additionalPayments.length > 0 || displayAdditionalPayments.length > 0
              ? displayAdditionalPayments.map(p => formatTeacherAdditionalLine(p)).join("\n")
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
          {makeupPay > 0 ? (
            <p className="sch-payroll-pay-hint">
              보강 수업료 {formatWon(makeupPay)} 포함 (기본 단가와 동일)
            </p>
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
            <ChangeReasonField
              label="변동 사유"
              preset={customEdit.changeReasonPreset}
              customText={customEdit.changeReasonCustom}
              onPresetChange={preset => setCustomEdit(c => ({
                ...c,
                changeReasonPreset: preset,
                substituteTeacherId: isSubstituteReason(preset) ? c.substituteTeacherId : "",
                makeupDate: isMakeupReason(preset) ? c.makeupDate : "",
              }))}
              onCustomChange={text => setCustomEdit(c => ({ ...c, changeReasonCustom: text }))}
              required={customEditNeedsReason
                || isSubstituteReason(customEdit.changeReasonPreset)
                || isMakeupReason(customEdit.changeReasonPreset)}
            />
            {isSubstituteReason(customEdit.changeReasonPreset) ? (
              <label className="sch-field">
                <span>누가 수업했나요? *</span>
                <select
                  className="sch-select"
                  required
                  value={customEdit.substituteTeacherId}
                  onChange={e => setCustomEdit(c => ({ ...c, substituteTeacherId: e.target.value }))}
                >
                  <option value="">대체 선생님 선택</option>
                  {teacherOptions
                    .filter(t => t.id !== teacherId)
                    .map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                </select>
                <span className="sch-muted sch-field-hint">
                  선택 시 수업료는 대체 선생님 급여로 이동하고, 원래 선생님 급여에서는 제외됩니다.
                </span>
              </label>
            ) : null}
            {isMakeupReason(customEdit.changeReasonPreset) ? (
              <>
                <label className="sch-field">
                  <span>보강 날짜 *</span>
                  <input
                    type="date"
                    className="sch-input"
                    required
                    value={customEdit.makeupDate}
                    onChange={e => setCustomEdit(c => ({ ...c, makeupDate: e.target.value }))}
                  />
                </label>
                <div className="sch-time-row">
                  <label className="sch-field">
                    <span>보강 시작 *</span>
                    <input
                      type="time"
                      className="sch-input"
                      required
                      value={customEdit.makeupStartTime}
                      onChange={e => {
                        const start = e.target.value;
                        setCustomEdit(c => ({
                          ...c,
                          makeupStartTime: start,
                          minutes: c.makeupEndTime
                            ? minutesBetween(start, c.makeupEndTime)
                            : c.minutes,
                        }));
                      }}
                    />
                  </label>
                  <label className="sch-field">
                    <span>보강 종료 *</span>
                    <input
                      type="time"
                      className="sch-input"
                      required
                      value={customEdit.makeupEndTime}
                      onChange={e => {
                        const end = e.target.value;
                        setCustomEdit(c => ({
                          ...c,
                          makeupEndTime: end,
                          minutes: c.makeupStartTime
                            ? minutesBetween(c.makeupStartTime, end)
                            : c.minutes,
                        }));
                      }}
                    />
                  </label>
                </div>
                <p className="sch-muted sch-field-hint">
                  원래 날짜에는 「수업변경 → 보강일」이, 보강 날짜에는 「(보강) 기관 N분」과 원래 날짜 안내가 표시됩니다.
                </p>
              </>
            ) : null}
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

      {bulkSkipModal ? (
        <div className="sch-modal-overlay" onClick={() => setBulkSkipModal(false)}>
          <form
            className="sch-modal sch-form"
            onClick={e => e.stopPropagation()}
            onSubmit={handleBulkSkipConfirm}
          >
            <h3>전체 휴강</h3>
            <p className="sch-muted">
              이 날짜의 모든 수업({dayUnlockablePlanned.length}개)을 &apos;수업 안 함&apos;으로 처리합니다.
              이미 확정된 수업도 함께 휴강 처리됩니다.
            </p>
            <ChangeReasonField
              label="휴강 사유"
              required={false}
              preset={bulkSkipReason.preset}
              customText={bulkSkipReason.custom}
              onPresetChange={preset => setBulkSkipReason(r => ({ ...r, preset }))}
              onCustomChange={text => setBulkSkipReason(r => ({ ...r, custom: text }))}
            />
            <div className="sch-form-actions sch-form-actions--stack">
              <button type="submit" className="sch-btn sch-btn--primary" disabled={saving}>
                휴강 처리
              </button>
              <button
                type="button"
                className="sch-btn sch-btn--ghost"
                onClick={() => setBulkSkipModal(false)}
              >
                닫기
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {bulkEditModal ? (
        <div className="sch-modal-overlay" onClick={() => setBulkEditModal(null)}>
          <form
            className="sch-modal sch-form sch-payroll-bulk-edit-modal"
            onClick={e => e.stopPropagation()}
            onSubmit={handleBulkEditSave}
          >
            <h3>전체 수정</h3>
            <p className="sch-muted">
              {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일 수업 분을 한 번에 수정합니다.
            </p>
            <div className="sch-chip-row">
              {QUICK_MINUTES.map((m) => (
                <button
                  key={m}
                  type="button"
                  className="sch-chip"
                  onClick={() => setBulkEditModal((modal) => ({
                    ...modal,
                    rows: modal.rows.map((row) => ({ ...row, minutes: m })),
                  }))}
                >
                  전체 {m}분
                </button>
              ))}
            </div>
            <ul className="sch-payroll-bulk-edit-list">
              {bulkEditModal.rows.map((row, idx) => (
                <li key={row.plannedKey} className="sch-payroll-bulk-edit-row">
                  <div className="sch-payroll-bulk-edit-meta">
                    <strong>{plannedSlotDisplayLabel(row.planned)}</strong>
                    <span>
                      {row.planned.startTime}–{row.planned.endTime}
                      {" · "}
                      {row.planned.payType}
                      {" · 기본 "}
                      {row.planned.scheduledMinutes}분
                    </span>
                  </div>
                  <label className="sch-field sch-field--inline">
                    <span>분</span>
                    <input
                      type="number"
                      className="sch-input sch-input--narrow"
                      min={1}
                      value={row.minutes}
                      onChange={(e) => {
                        const value = e.target.value;
                        setBulkEditModal((modal) => ({
                          ...modal,
                          rows: modal.rows.map((r, i) => (
                            i === idx ? { ...r, minutes: value } : r
                          )),
                        }));
                      }}
                    />
                  </label>
                </li>
              ))}
            </ul>
            <ChangeReasonField
              label="변동 사유"
              preset={bulkEditModal.changeReasonPreset}
              customText={bulkEditModal.changeReasonCustom}
              onPresetChange={(preset) => setBulkEditModal((m) => ({
                ...m,
                changeReasonPreset: preset,
              }))}
              onCustomChange={(text) => setBulkEditModal((m) => ({
                ...m,
                changeReasonCustom: text,
              }))}
            />
            <div className="sch-form-actions sch-form-actions--stack">
              <button type="submit" className="sch-btn sch-btn--primary" disabled={saving}>
                {saving ? "저장 중..." : "일괄 저장"}
              </button>
              <button
                type="button"
                className="sch-btn sch-btn--ghost"
                onClick={() => setBulkEditModal(null)}
              >
                닫기
              </button>
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
                placeholder="원 이름 검색 (전체 기관)"
                value={extraEdit.institution_name}
                onChange={e => {
                  const name = e.target.value;
                  const pool = allInstitutions.length ? allInstitutions : assignedInstitutions;
                  const inst = pool.find(i => i.name === name)
                    || institutionLegend.find(i => i.name === name);
                  setExtraEdit(c => ({
                    ...c,
                    institution_name: name,
                    institution_id: inst?.id || "",
                  }));
                }}
              />
              <datalist id="payroll-inst-list">
                {(allInstitutions.length ? allInstitutions : assignedInstitutions).map(i => (
                  <option key={i.id} value={i.name} />
                ))}
              </datalist>
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
