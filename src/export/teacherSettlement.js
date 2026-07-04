import { estimateTeacherPayByEntry } from "../schedule/settlement.js";
import {
  resolveTeacherMonthlyGross,
  sumAdditionalPayments,
} from "../schedule/additionalPayments.js";

function yearMonthFirstDay(key) {
  const ym = String(key || "").slice(0, 7);
  return `${ym}-01`;
}

function yearMonthLastDay(key) {
  const ym = String(key || "").slice(0, 7);
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(y, m, 0);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
}

function ymFromDate(value) {
  if (!value) return null;
  const s = String(value);
  if (/^\d{4}-\d{2}/.test(s)) return s.slice(0, 7);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function groupEntriesByTeacherInstitution(entries) {
  const map = new Map();
  for (const entry of entries || []) {
    if (!entry?.teacher_id) continue;
    const instId = entry.institution_id || "none";
    const key = `${entry.teacher_id}:${instId}`;
    if (!map.has(key)) {
      map.set(key, {
        teacherId: entry.teacher_id,
        institutionName: entry.institutions?.name || "미지정",
        entries: [],
      });
    }
    map.get(key).entries.push(entry);
  }
  return map;
}

function buildRowsForMonth({
  yearMonth,
  entries,
  additionalPayments,
  teachers,
  rates,
}) {
  const rows = [];
  const teacherMap = new Map((teachers || []).map(t => [t.id, t]));
  const grouped = groupEntriesByTeacherInstitution(entries);
  const lessonByTeacher = new Map();

  for (const group of grouped.values()) {
    const teacher = teacherMap.get(group.teacherId);
    if (!teacher || teacher.role === "superadmin") continue;
    const lessonPay = estimateTeacherPayByEntry(
      group.entries.filter(e => Number(e.minutes) > 0),
      rates,
    );
    lessonByTeacher.set(group.teacherId, (lessonByTeacher.get(group.teacherId) || 0) + lessonPay);
    rows.push({
      선생님명: teacher.name,
      기관: group.institutionName,
      수업료: lessonPay,
      추가수당: 0,
      총액: lessonPay,
      정산월: yearMonth,
    });
  }

  const additionalByTeacher = new Map();
  for (const payment of additionalPayments || []) {
    if (!payment?.teacher_id) continue;
    if (!additionalByTeacher.has(payment.teacher_id)) {
      additionalByTeacher.set(payment.teacher_id, []);
    }
    additionalByTeacher.get(payment.teacher_id).push(payment);
  }

  for (const [teacherId, payments] of additionalByTeacher.entries()) {
    const teacher = teacherMap.get(teacherId);
    if (!teacher || teacher.role === "superadmin") continue;
    const additionalTotal = sumAdditionalPayments(payments);
    if (additionalTotal <= 0) continue;
    const lessonTotal = lessonByTeacher.get(teacherId) || 0;
    const gross = resolveTeacherMonthlyGross(
      teacherId,
      yearMonth,
      lessonTotal,
      payments,
      teacher.name,
    );
    const adjustment = gross - lessonTotal - additionalTotal;

    for (const payment of payments) {
      const amount = Number(payment.amount) || 0;
      rows.push({
        선생님명: teacher.name,
        기관: "추가수당",
        수업료: 0,
        추가수당: amount,
        총액: amount,
        정산월: yearMonth,
      });
    }

    if (adjustment !== 0) {
      rows.push({
        선생님명: teacher.name,
        기관: adjustment > 0 ? "고정급/조정" : "조정",
        수업료: adjustment,
        추가수당: 0,
        총액: adjustment,
        정산월: yearMonth,
      });
    }
  }

  for (const teacher of teachers || []) {
    if (teacher.role === "superadmin") continue;
    const teacherAdditional = additionalByTeacher.get(teacher.id) || [];
    const lessonTotal = lessonByTeacher.get(teacher.id) || 0;
    const gross = resolveTeacherMonthlyGross(
      teacher.id,
      yearMonth,
      lessonTotal,
      teacherAdditional,
      teacher.name,
    );
    if (lessonTotal === 0 && teacherAdditional.length === 0 && gross > 0) {
      rows.push({
        선생님명: teacher.name,
        기관: "고정급",
        수업료: gross,
        추가수당: 0,
        총액: gross,
        정산월: yearMonth,
      });
    }
  }

  rows.sort((a, b) =>
    a.선생님명.localeCompare(b.선생님명, "ko")
    || a.기관.localeCompare(b.기관, "ko"),
  );

  return rows;
}

export async function fetchTeacherSettlementRows(supabase, { month, all }) {
  const [teachersRes, ratesRes] = await Promise.all([
    supabase.from("teachers").select("id, name, role, active").eq("active", true).order("name"),
    supabase.from("teacher_pay_rates").select("*").order("effective_from", { ascending: false }),
  ]);

  if (teachersRes.error) throw teachersRes.error;
  if (ratesRes.error) throw ratesRes.error;

  const teachers = teachersRes.data || [];
  const rates = ratesRes.data || [];

  if (all) {
    const [entriesRes, additionalRes] = await Promise.all([
      supabase
        .from("payroll_entries")
        .select("*, institutions(id, name)")
        .order("class_date", { ascending: true }),
      supabase
        .from("additional_payments")
        .select("*")
        .order("year_month", { ascending: true }),
    ]);
    if (entriesRes.error) throw entriesRes.error;
    if (additionalRes.error) throw additionalRes.error;

    const monthSet = new Set();
    for (const entry of entriesRes.data || []) {
      const ym = ymFromDate(entry.class_date);
      if (ym) monthSet.add(ym);
    }
    for (const payment of additionalRes.data || []) {
      const ym = ymFromDate(payment.year_month);
      if (ym) monthSet.add(ym);
    }

    const rows = [];
    for (const yearMonth of [...monthSet].sort()) {
      const monthEntries = (entriesRes.data || []).filter(
        e => ymFromDate(e.class_date) === yearMonth,
      );
      const monthAdditional = (additionalRes.data || []).filter(
        p => ymFromDate(p.year_month) === yearMonth,
      );
      rows.push(...buildRowsForMonth({
        yearMonth,
        entries: monthEntries,
        additionalPayments: monthAdditional,
        teachers,
        rates,
      }));
    }
    return rows;
  }

  const yearMonth = month;
  const [entriesRes, additionalRes] = await Promise.all([
    supabase
      .from("payroll_entries")
      .select("*, institutions(id, name)")
      .gte("class_date", yearMonthFirstDay(yearMonth))
      .lte("class_date", yearMonthLastDay(yearMonth)),
    supabase
      .from("additional_payments")
      .select("*")
      .eq("year_month", yearMonthFirstDay(yearMonth)),
  ]);

  if (entriesRes.error) throw entriesRes.error;
  if (additionalRes.error) throw additionalRes.error;

  return buildRowsForMonth({
    yearMonth,
    entries: entriesRes.data || [],
    additionalPayments: additionalRes.data || [],
    teachers,
    rates,
  });
}

export const TEACHER_SETTLEMENT_HEADERS = [
  "선생님명",
  "기관",
  "수업료",
  "추가수당",
  "총액",
  "정산월",
];
