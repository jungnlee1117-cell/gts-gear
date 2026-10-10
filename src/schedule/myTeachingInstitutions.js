import {
  fmtLocalDate,
  minutesBetween,
  resolveInstitutionSlotPayType,
} from "./constants.js";
import { parseTimeChangeNote } from "./changeReasonOptions.js";
import {
  computeSettlement,
  entryPayAmount,
  estimateTeacherPayByEntry,
  institutionSessionUnitPrice,
  isRevenueShareRate,
  payRelevantEntries,
  pickRateRowForDate,
} from "./settlement.js";

function slotOccursOnDate(slot, dateStr, weekday) {
  if (!slot || Number(slot.day_of_week) !== weekday) return false;
  const from = slot.effective_from ? String(slot.effective_from).slice(0, 10) : null;
  const to = slot.effective_to ? String(slot.effective_to).slice(0, 10) : null;
  if (from && dateStr < from) return false;
  if (to && dateStr > to) return false;
  return true;
}

/** 이번 달에 실제로 요일과 적용 기간이 겹치는 본인 슬롯 날짜. */
export function listOwnSlotDatesInMonth(slots, yearMonth, teacherId) {
  const prefix = String(yearMonth || "").slice(0, 7);
  const [y, m] = prefix.split("-").map(Number);
  if (!y || !m) return [];
  const last = new Date(y, m, 0).getDate();
  const rows = [];
  for (let day = 1; day <= last; day += 1) {
    const date = new Date(y, m - 1, day);
    const dateStr = fmtLocalDate(date);
    const weekday = date.getDay();
    for (const slot of slots || []) {
      if (teacherId && slot.teacher_id !== teacherId) continue;
      if (!slot.institution_id) continue;
      if (!slotOccursOnDate(slot, dateStr, weekday)) continue;
      rows.push({
        slot,
        dateStr,
        minutes: minutesBetween(slot.start_time, slot.end_time),
        payType: resolveInstitutionSlotPayType(slot),
      });
    }
  }
  return rows;
}

function monthEntries(entries, teacherId, institutionId, yearMonth) {
  const prefix = String(yearMonth || "").slice(0, 7);
  return payRelevantEntries(entries, teacherId).filter((entry) => (
    entry.institution_id === institutionId
    && String(entry.class_date || "").slice(0, 7) === prefix
  ));
}

function previewAmount(entry, rates, sessionRates) {
  const rate = pickRateRowForDate(
    rates,
    entry.teacher_id,
    entry.pay_type,
    entry.class_date,
    entry.institution_id,
  );
  if (!isRevenueShareRate(rate)) return 0;
  return entryPayAmount(entry, rates, {}, sessionRates);
}

export function buildTeachingInstitutionRows({
  slots = [],
  entries = [],
  yearMonth,
  teacherId,
  managedIds = new Set(),
  namesById = new Map(),
  rates = [],
  sessionRates = [],
}) {
  const grouped = new Map();
  for (const occ of listOwnSlotDatesInMonth(slots, yearMonth, teacherId)) {
    const institutionId = occ.slot.institution_id;
    if (managedIds.has(institutionId)) continue;
    if (!grouped.has(institutionId)) {
      grouped.set(institutionId, {
        institutionId,
        name: namesById.get(institutionId) || occ.slot.institutions?.name || "원",
        classCount: 0,
        scheduledMinutes: 0,
      });
    }
    const row = grouped.get(institutionId);
    row.classCount += 1;
    row.scheduledMinutes += occ.minutes;
  }

  return [...grouped.values()]
    .map((row) => {
      const detail = buildTeachingInstitutionDetail({
        slots,
        entries,
        yearMonth,
        teacherId,
        institutionId: row.institutionId,
        rates,
        sessionRates,
      });
      return {
        ...row,
        confirmedMinutes: detail.confirmedMinutes,
        estimatedPay: detail.estimatedPay,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

export function buildTeachingInstitutionDetail({
  slots = [],
  entries = [],
  yearMonth,
  teacherId,
  institutionId,
  rates = [],
  sessionRates = [],
}) {
  const ownSlots = (slots || []).filter((slot) => (
    slot.teacher_id === teacherId && slot.institution_id === institutionId
  ));
  const occurrences = listOwnSlotDatesInMonth(ownSlots, yearMonth, teacherId);
  const payroll = monthEntries(entries, teacherId, institutionId, yearMonth);
  const covered = new Set(
    payroll
      .filter((entry) => entry.schedule_slot_id && Number(entry.minutes) > 0)
      .map((entry) => `${entry.schedule_slot_id}|${String(entry.class_date).slice(0, 10)}`),
  );

  const slotIds = new Set();
  const slotRows = [];
  for (const occ of occurrences) {
    if (slotIds.has(occ.slot.id)) continue;
    slotIds.add(occ.slot.id);
    slotRows.push(occ.slot);
  }

  const payrollRows = payroll.map((entry) => ({
    id: entry.id,
    date: String(entry.class_date).slice(0, 10),
    payType: entry.pay_type,
    minutes: Number(entry.minutes) || 0,
    amount: entryPayAmount(entry, rates, {}, sessionRates),
    substitute: Boolean(entry.substitute_teacher_id)
      && entry.substitute_teacher_id === teacherId
      && entry.teacher_id !== teacherId,
  })).sort((a, b) => a.date.localeCompare(b.date));

  const unconfirmed = [];
  for (const occ of occurrences) {
    if (covered.has(`${occ.slot.id}|${occ.dateStr}`)) continue;
    const previewEntry = {
      teacher_id: teacherId,
      institution_id: institutionId,
      schedule_slot_id: occ.slot.id,
      class_date: occ.dateStr,
      pay_type: occ.payType,
      minutes: occ.minutes,
      entry_status: "as_scheduled",
    };
    unconfirmed.push({
      id: `${occ.slot.id}|${occ.dateStr}`,
      date: occ.dateStr,
      payType: occ.payType,
      minutes: occ.minutes,
      amount: previewAmount(previewEntry, rates, sessionRates),
    });
  }

  const confirmedPay = estimateTeacherPayByEntry(payroll, rates, {}, teacherId, sessionRates);
  const previewPay = unconfirmed.reduce((sum, row) => sum + row.amount, 0);
  return {
    slots: slotRows,
    payrollRows,
    unconfirmed,
    confirmedMinutes: payrollRows.reduce((sum, row) => sum + row.minutes, 0),
    estimatedPay: confirmedPay + previewPay,
  };
}

export function ownLessonPayForInstitutions({
  slots = [],
  entries = [],
  yearMonth,
  teacherId,
  institutionIds = [],
  rates = [],
  sessionRates = [],
}) {
  let pay = 0;
  for (const institutionId of institutionIds) {
    pay += buildTeachingInstitutionDetail({
      slots,
      entries,
      yearMonth,
      teacherId,
      institutionId,
      rates,
      sessionRates,
    }).estimatedPay;
  }
  return pay;
}

function clockRange(start, end) {
  const from = String(start || "").slice(0, 5);
  const to = String(end || "").slice(0, 5);
  if (from && to) return `${from}–${to}`;
  return "";
}

function classTimeLabel(entry, slot) {
  const changed = parseTimeChangeNote(entry?.note);
  const changedRange = clockRange(changed?.start, changed?.end);
  if (changedRange) return changedRange;
  const slotRange = clockRange(slot?.start_time, slot?.end_time);
  if (slotRange) return slotRange;
  const minutes = Number(entry?.minutes) || 0;
  return minutes > 0 ? `${minutes}분` : "";
}

/**
 * 담당하지 않는 원의 본인 수업만 모은다.
 * 확정된 급여 행과, 아직 급여 행이 없는 본인 시간표 수업을 같이 센다.
 * 금액은 entryPayAmount를 그대로 쓴다.
 * 매출 배분은 원 계약 단가에서 부가세를 빼고, 회당 단가는 그 금액만 담당자 몫으로 둔다.
 */
export function buildDirectTeachingPayRows({
  entries = [],
  slots = [],
  yearMonth,
  teacherId,
  managedIds = new Set(),
  namesById = new Map(),
  rates = [],
  sessionRates = [],
}) {
  if (!teacherId) return [];
  const prefix = String(yearMonth || "").slice(0, 7);
  const ownSlots = (slots || []).filter((slot) => !slot.teacher_id || slot.teacher_id === teacherId);
  const slotById = Object.fromEntries(ownSlots.filter((slot) => slot.id).map((slot) => [slot.id, slot]));
  const ownEntries = (entries || []).filter((entry) => entry.teacher_id === teacherId);
  const coveredSlotDates = new Set(
    ownEntries
      .filter((entry) => entry.schedule_slot_id && entry.class_date)
      .map((entry) => `${entry.schedule_slot_id}|${String(entry.class_date).slice(0, 10)}`),
  );
  const relevant = payRelevantEntries(ownEntries, teacherId).filter((entry) => (
    entry.institution_id
    && !managedIds.has(entry.institution_id)
    && String(entry.class_date || "").slice(0, 7) === prefix
  ));
  const planned = listOwnSlotDatesInMonth(ownSlots, yearMonth, teacherId)
    .filter((occ) => (
      occ.slot?.institution_id
      && !managedIds.has(occ.slot.institution_id)
      && !coveredSlotDates.has(`${occ.slot.id}|${occ.dateStr}`)
    ))
    .map((occ) => ({
      id: `plan:${occ.slot.id}:${occ.dateStr}`,
      teacher_id: teacherId,
      institution_id: occ.slot.institution_id,
      schedule_slot_id: occ.slot.id,
      class_date: occ.dateStr,
      pay_type: occ.payType,
      minutes: occ.minutes,
      entry_status: "as_scheduled",
      institutions: occ.slot.institutions,
    }));

  const grouped = new Map();
  for (const entry of [...relevant, ...planned]) {
    const institutionId = entry.institution_id;
    if (!grouped.has(institutionId)) {
      grouped.set(institutionId, {
        institutionId,
        name: namesById.get(institutionId) || entry.institutions?.name || "원",
        classes: [],
        contractKeys: new Set(),
        contractRates: [],
      });
    }
    const row = grouped.get(institutionId);
    const slot = entry.schedule_slot_id ? slotById[entry.schedule_slot_id] : null;
    const classDate = String(entry.class_date).slice(0, 10);
    const rateRow = pickRateRowForDate(
      rates,
      teacherId,
      entry.pay_type,
      classDate,
      institutionId,
    );
    const revenueShare = isRevenueShareRate(rateRow);
    const unit = revenueShare
      ? institutionSessionUnitPrice(sessionRates, institutionId, entry.pay_type, classDate)
      : 0;
    const contractKey = `${entry.pay_type || ""}|${unit}`;
    if (!row.contractKeys.has(contractKey)) {
      row.contractKeys.add(contractKey);
      row.contractRates.push({ payType: entry.pay_type || "수업", unit });
    }
    row.classes.push({
      id: entry.id,
      date: classDate,
      name: slot?.label || entry.pay_type || "수업",
      timeLabel: classTimeLabel(entry, slot),
      unit,
      amount: entryPayAmount(entry, rates, slotById, sessionRates),
      payType: entry.pay_type || "",
      payStyle: revenueShare ? "contract" : "instructor_fee",
    });
  }

  return [...grouped.values()]
    .map((row) => {
      const classes = [...row.classes].sort((a, b) => (
        a.date.localeCompare(b.date) || a.name.localeCompare(b.name, "ko")
      ));
      const payTotal = classes.reduce((sum, item) => sum + item.amount, 0);
      const revenue = classes.reduce((sum, item) => sum + (Number(item.unit) || 0), 0);
      const feeMode = classes.every((item) => item.payStyle === "instructor_fee")
        ? "instructor_fee"
        : "contract";
      const rateMissing = feeMode === "contract" ? revenue <= 0 : payTotal <= 0;
      const priced = rateMissing
        ? null
        : (feeMode === "contract"
          ? computeSettlement({ contractType: "manager_personal", revenue })
          : {
            revenue: 0,
            vat: 0,
            revenue_after_vat: 0,
            manager_share: payTotal,
          });
      return {
        institutionId: row.institutionId,
        name: row.name,
        classCount: classes.length,
        contractRates: row.contractRates,
        payTotal,
        feeMode,
        rateMissing,
        revenue: priced?.revenue || 0,
        vat: priced?.vat || 0,
        managerShare: priced?.manager_share || 0,
        gtsShare: 0,
        classes,
        settlementRow: priced ? {
          institution: {
            id: row.institutionId,
            name: row.name,
            contract_type: "manager_personal",
          },
          hasRevenue: feeMode === "contract",
          revenue: priced.revenue,
          vat: priced.vat,
          revenue_after_vat: priced.revenue_after_vat,
          income_tax: 0,
          instructor_cost: 0,
          net_profit: 0,
          manager_share: priced.manager_share,
          gts_share: 0,
        } : null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
}
