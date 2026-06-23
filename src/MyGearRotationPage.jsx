import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  findNextWeekSlot,
  findWeekSlotForDate,
  formatWeekRange,
  getWeekItemsForLetter,
  resolveItemRecord,
  schoolYearMonths,
  yearMonthFirstDay,
  yearMonthKey,
} from "./itemRotation.js";
import {
  clampToSchoolYear,
  monthLabel,
  schoolYearStartYear,
} from "./lessonPlan.js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

const DS = {
  primary: "#059669",
  primaryLight: "#ecfdf5",
  textPrimary: "#111827",
  textSecondary: "#6b7280",
  textMuted: "#9ca3af",
};

const card = {
  background: "#fff",
  borderRadius: 16,
  border: "1px solid #e8ecee",
  boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
};

const MONTH_SHORT = ["", "1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

function Spinner({ text }) {
  return (
    <div style={{ textAlign: "center", padding: 40, color: DS.textSecondary }}>
      <div style={{ marginBottom: 8 }}>⏳</div>
      {text || "불러오는 중..."}
    </div>
  );
}

function AirBadge() {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, color: "#0891b2",
      background: "#ecfeff", border: "1px solid #a5f3fc",
      borderRadius: 6, padding: "2px 6px", marginLeft: 8,
    }}>
      에어
    </span>
  );
}

function SchoolYearTimeline({ months, viewMonth, todayMonth, onSelect }) {
  const scrollRef = useRef(null);
  const activeRef = useRef(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [viewMonth]);

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: DS.textSecondary, marginBottom: 10 }}>
        학년도 월별 보기
      </div>
      <div
        ref={scrollRef}
        style={{
          display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6,
          WebkitOverflowScrolling: "touch",
        }}
      >
        {months.map((m) => {
          const isView = m === viewMonth;
          const isToday = m === todayMonth;
          const [, mo] = m.split("-").map(Number);
          return (
            <button
              key={m}
              ref={isView ? activeRef : undefined}
              type="button"
              onClick={() => onSelect(m)}
              style={{
                flexShrink: 0, minWidth: 64, padding: "10px 12px", borderRadius: 12,
                border: isView ? `2px solid ${DS.primary}` : "1px solid #e5e7eb",
                background: isView ? DS.primaryLight : "#fff",
                cursor: "pointer", fontFamily: "inherit", position: "relative",
              }}
            >
              <div style={{
                fontSize: 14, fontWeight: 800,
                color: isView ? DS.primary : DS.textPrimary,
              }}>
                {MONTH_SHORT[mo]}
              </div>
              {isToday && (
                <div style={{
                  fontSize: 10, fontWeight: 700, color: DS.primary, marginTop: 2,
                }}>
                  이번 달
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WeekHighlightCard({ label, dateRange, gear, compact, onRent }) {
  if (!gear) {
    return (
      <div style={{
        ...card, padding: compact ? "12px 14px" : "20px 18px",
        color: DS.textMuted, fontSize: 13, textAlign: "center",
      }}>
        {label} 교구 정보 없음
      </div>
    );
  }

  return (
    <div style={{
      ...card,
      padding: compact ? "14px 16px" : "22px 20px",
      background: compact ? "#f8fafc" : `linear-gradient(135deg, ${DS.primaryLight} 0%, #fff 100%)`,
    }}>
      <div style={{
        fontSize: compact ? 11 : 12, fontWeight: 700, color: DS.textMuted, marginBottom: 6,
      }}>
        {label}
        {dateRange && <span style={{ marginLeft: 8 }}>{dateRange}</span>}
      </div>
      <div style={{
        fontSize: compact ? 17 : 26, fontWeight: 900, color: DS.textPrimary, lineHeight: 1.3,
        display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4,
      }}>
        {gear.merged ? gear.displayName : gear.displayName}
        {gear.is_air_product && <AirBadge />}
      </div>
      {!gear.merged && gear.parts?.map(p => (
        <div key={p.label} style={{ fontSize: compact ? 12 : 13, color: DS.textSecondary, marginTop: 4 }}>
          <span style={{ fontWeight: 700 }}>{p.label}</span> {p.name}
        </div>
      ))}
      {gear.simple_activity && (
        <p style={{ margin: "10px 0 0", fontSize: 13, color: DS.textSecondary, lineHeight: 1.5 }}>
          {gear.simple_activity}
        </p>
      )}
      {!compact && gear.item_name && (
        <button
          type="button"
          onClick={() => onRent(gear.item_name)}
          style={{
            marginTop: 16, width: "100%", padding: "12px 0", borderRadius: 12, border: "none",
            background: DS.primary, color: "#fff", fontWeight: 800, fontSize: 15,
            cursor: "pointer", fontFamily: "inherit",
          }}
        >
          이 교구 대여 신청
        </button>
      )}
    </div>
  );
}

function MonthWeekRow({ weekNumber, dateRange, gear, onOpenItem }) {
  if (!gear) return null;

  const activityLine = gear.simple_activity
    || (gear.simpleActivities?.length ? gear.simpleActivities.join(" / ") : null);

  return (
    <button
      type="button"
      onClick={() => onOpenItem(gear.item_name)}
      style={{
        ...card, padding: "14px 16px", textAlign: "left", cursor: "pointer",
        fontFamily: "inherit", width: "100%",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: DS.textMuted, marginBottom: 6 }}>
        {dateRange || `${weekNumber}주차`}
      </div>
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 16, fontWeight: 800, color: DS.textPrimary }}>
          {gear.merged ? gear.displayName : gear.displayName}
        </span>
        {gear.is_air_product && <AirBadge />}
      </div>
      {!gear.merged && gear.parts?.map(p => (
        <div key={p.label} style={{ fontSize: 12, color: DS.textSecondary, marginTop: 4 }}>
          {p.label}: {p.name}
        </div>
      ))}
      {activityLine && (
        <p style={{ margin: "8px 0 0", fontSize: 13, color: DS.textSecondary, lineHeight: 1.45 }}>
          {activityLine}
        </p>
      )}
      <div style={{ fontSize: 11, color: DS.textMuted, marginTop: 8 }}>
        탭하여 교구 상세 · 대여
      </div>
    </button>
  );
}

export default function MyGearRotationPage({ me, items, onDetail, onGoRental, PageHeader, PageShell }) {
  const startYear = schoolYearStartYear();
  const todayMonth = yearMonthKey();
  const schoolMonths = useMemo(() => schoolYearMonths(startYear), [startYear]);

  const [viewMonth, setViewMonth] = useState(() => clampToSchoolYear(todayMonth, startYear));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [schedules, setSchedules] = useState([]);
  const [weeklyLists, setWeeklyLists] = useState([]);
  const [allMonthWeeks, setAllMonthWeeks] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const ymKeys = schoolMonths.map(m => yearMonthFirstDay(m));
        const [schedRes, weeklyRes, weeksRes] = await Promise.all([
          supabase.from("item_rotation_schedule")
            .select("year_month, assigned_letter")
            .eq("teacher_id", me.id)
            .in("year_month", ymKeys),
          supabase.from("item_weekly_lists").select("*").order("week_number"),
          supabase.from("item_rotation_month_weeks")
            .select("*")
            .in("year_month", ymKeys)
            .order("week_number"),
        ]);

        if (schedRes.error?.code === "42P01") {
          setError("교구 순환 테이블이 아직 생성되지 않았습니다. 관리자에게 문의하세요.");
          return;
        }
        if (schedRes.error) throw schedRes.error;
        if (weeklyRes.error) throw weeklyRes.error;
        if (weeksRes.error && weeksRes.error.code !== "42P01") throw weeksRes.error;

        if (!cancelled) {
          setSchedules(schedRes.data || []);
          setWeeklyLists(weeklyRes.data || []);
          setAllMonthWeeks(weeksRes.data || []);
        }
      } catch (e) {
        if (!cancelled) setError(e.message || "데이터를 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [me.id, schoolMonths]);

  const scheduleForMonth = (monthKey) =>
    schedules.find(s => s.year_month?.startsWith(String(monthKey).slice(0, 7))) || null;

  const weeksForMonth = (monthKey) =>
    allMonthWeeks.filter(w => w.year_month?.startsWith(String(monthKey).slice(0, 7)));

  const currentWeekSlot = useMemo(
    () => findWeekSlotForDate(allMonthWeeks),
    [allMonthWeeks],
  );

  const currentMonthKey = currentWeekSlot
    ? String(currentWeekSlot.year_month).slice(0, 7)
    : todayMonth;

  const currentLetter = scheduleForMonth(currentMonthKey)?.assigned_letter;

  const thisWeekGear = useMemo(() => {
    if (!currentLetter || !currentWeekSlot) return null;
    return getWeekItemsForLetter(weeklyLists, currentLetter, currentWeekSlot.week_number);
  }, [currentLetter, currentWeekSlot, weeklyLists]);

  const nextWeekSlot = useMemo(
    () => findNextWeekSlot(allMonthWeeks, currentWeekSlot),
    [allMonthWeeks, currentWeekSlot],
  );

  const nextWeekMonthKey = nextWeekSlot ? String(nextWeekSlot.year_month).slice(0, 7) : null;
  const nextLetter = nextWeekMonthKey ? scheduleForMonth(nextWeekMonthKey)?.assigned_letter : null;

  const nextWeekGear = useMemo(() => {
    if (!nextLetter || !nextWeekSlot) return null;
    return getWeekItemsForLetter(weeklyLists, nextLetter, nextWeekSlot.week_number);
  }, [nextLetter, nextWeekSlot, weeklyLists]);

  const viewLetter = scheduleForMonth(viewMonth)?.assigned_letter;
  const viewMonthWeeks = weeksForMonth(viewMonth);

  const monthWeekRows = useMemo(() => {
    if (!viewLetter) return [];
    const weeksMap = new Map(viewMonthWeeks.map(w => [w.week_number, w]));
    return [1, 2, 3, 4, 5].map(wn => {
      const gear = getWeekItemsForLetter(weeklyLists, viewLetter, wn);
      if (!gear) return null;
      const mw = weeksMap.get(wn);
      return {
        weekNumber: wn,
        dateRange: mw ? formatWeekRange(mw.week_start_date, mw.week_end_date) : null,
        gear,
      };
    }).filter(Boolean);
  }, [viewLetter, weeklyLists, viewMonthWeeks]);

  const openItem = (sheetName) => {
    const rec = resolveItemRecord(items, sheetName);
    if (rec) {
      onDetail(rec, "my-gear-rotation");
      return;
    }
    alert(`「${sheetName}」 교구를 재고 목록에서 찾지 못했습니다.\n관리자에게 이름 매칭을 요청하세요.`);
  };

  const handleRent = (sheetName) => {
    const rec = resolveItemRecord(items, sheetName);
    if (rec) {
      onDetail(rec, "my-gear-rotation");
      return;
    }
    if (onGoRental) onGoRental();
    else alert("대여 메뉴에서 신청해 주세요.");
  };

  const thisWeekRange = currentWeekSlot
    ? formatWeekRange(currentWeekSlot.week_start_date, currentWeekSlot.week_end_date)
    : null;
  const nextWeekRange = nextWeekSlot
    ? formatWeekRange(nextWeekSlot.week_start_date, nextWeekSlot.week_end_date)
    : null;

  return (
    <PageShell>
      <PageHeader
        me={me}
        subtitle="이번 주 교구를 확인하고, 학년도 전체 월별 교구를 살펴볼 수 있습니다."
      />

      {loading && <Spinner text="순환 배정 불러오는 중..." />}
      {!loading && error && (
        <div style={{ ...card, padding: 24, color: "#dc2626", textAlign: "center" }}>{error}</div>
      )}

      {!loading && !error && (
        <>
          <section style={{ marginBottom: 24 }}>
            <WeekHighlightCard
              label="이번 주"
              dateRange={thisWeekRange}
              gear={thisWeekGear}
              onRent={handleRent}
            />
            {nextWeekGear && (
              <div style={{ marginTop: 12 }}>
                <WeekHighlightCard
                  label="다음 주"
                  dateRange={nextWeekRange}
                  gear={nextWeekGear}
                  compact
                  onRent={handleRent}
                />
              </div>
            )}
            {!currentWeekSlot && (
              <p style={{ fontSize: 12, color: DS.textMuted, textAlign: "center", marginTop: 10 }}>
                주차별 날짜가 등록되지 않아 이번 주를 자동으로 찾지 못했습니다.
              </p>
            )}
          </section>

          <SchoolYearTimeline
            months={schoolMonths}
            viewMonth={viewMonth}
            todayMonth={todayMonth}
            onSelect={setViewMonth}
          />

          <section>
            <h2 style={{
              fontSize: 16, fontWeight: 800, color: DS.textPrimary, margin: "0 0 12px",
            }}>
              {monthLabel(viewMonth)} 전체 교구
            </h2>

            {!viewLetter && (
              <div style={{ ...card, padding: 28, textAlign: "center", color: DS.textSecondary }}>
                {monthLabel(viewMonth)} 순환 배정이 없습니다.
              </div>
            )}

            {viewLetter && monthWeekRows.length === 0 && (
              <div style={{ ...card, padding: 28, textAlign: "center", color: DS.textSecondary }}>
                등록된 주차별 교구가 없습니다.
              </div>
            )}

            {viewLetter && monthWeekRows.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {monthWeekRows.map(row => (
                  <MonthWeekRow
                    key={row.weekNumber}
                    weekNumber={row.weekNumber}
                    dateRange={row.dateRange}
                    gear={row.gear}
                    onOpenItem={openItem}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </PageShell>
  );
}

/** 대여 기간이 순환 배정과 겹치는지 검사 (다른 강사) */
export async function checkRotationRentalConflicts(client, {
  me, cartItems, items, dispatch_start, dispatch_end, teachers,
}) {
  if (!cartItems?.length || !dispatch_start || !dispatch_end) return [];

  const start = new Date(`${dispatch_start}T12:00:00`);
  const end = new Date(`${dispatch_end}T12:00:00`);
  const months = new Set();
  const d = new Date(start);
  while (d <= end) {
    months.add(yearMonthFirstDay(yearMonthKey(d)));
    d.setMonth(d.getMonth() + 1, 1);
  }

  const { data: schedules } = await client
    .from("item_rotation_schedule")
    .select("teacher_id, year_month, assigned_letter")
    .in("year_month", [...months]);

  if (!schedules?.length) return [];

  const { data: weeklyLists } = await client.from("item_weekly_lists").select("*");
  const { data: monthWeeks } = await client
    .from("item_rotation_month_weeks")
    .select("*")
    .in("year_month", [...months]);

  const teacherMap = new Map((teachers || []).map(t => [t.id, t.name]));
  const conflicts = [];

  for (const ci of cartItems) {
    const item = items.find(i => i.id === ci.item_id);
    if (!item) continue;

    for (const sched of schedules) {
      if (sched.teacher_id === me.id) continue;
      const schedLetter = sched.assigned_letter;
      const ym = sched.year_month;

      const assignedRows = (weeklyLists || []).filter(w => {
        if (w.letter !== schedLetter) return false;
        const resolved = resolveItemRecord(items, w.item_name);
        return w.item_name === item.name || resolved?.id === item.id;
      });
      if (!assignedRows.length) continue;

      const weeksForMonth = (monthWeeks || []).filter(w => w.year_month === ym);
      for (const row of assignedRows) {
        const mw = weeksForMonth.find(w => w.week_number === row.week_number);
        let overlaps = true;
        let dateRange = `${row.week_number}주차`;
        if (mw) {
          const ws = new Date(`${mw.week_start_date}T12:00:00`);
          const we = new Date(`${mw.week_end_date}T12:00:00`);
          dateRange = formatWeekRange(mw.week_start_date, mw.week_end_date) || dateRange;
          overlaps = start <= we && end >= ws;
        }
        if (!overlaps) continue;

        conflicts.push({
          itemName: item.name,
          teacherName: teacherMap.get(sched.teacher_id) || "다른 강사",
          dateRange,
          targetType: row.target_type,
          totalQuantity: item.total_quantity ?? 1,
        });
      }
    }
  }

  const seen = new Set();
  return conflicts.filter(c => {
    const k = `${c.itemName}|${c.teacherName}|${c.dateRange}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
