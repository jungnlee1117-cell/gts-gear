import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import {
  assignedLetterForMonth,
  findCurrentRotationWeekSlot,
  findNextRotationWeekSlot,
  formatCalendarWeekLabel,
  formatCalendarWeekRange,
  formatWeekRange,
  getWeekItemsForLetter,
  resolveItemRecord,
  resolveRotationSchedules,
  rotationSubjectTeacherId,
  rotationWeekLabelForSlot,
  rotationWeekRangeForSlot,
  schoolYearMonths,
  yearMonthFirstDay,
  yearMonthKey,
} from "./itemRotation.js";
import {
  clampToSchoolYear,
  findLessonPlanForKoreanItem,
  monthLabel,
  schoolYearStartYear,
} from "./lessonPlan.js";
import { itemPhotoStyle } from "./gearPhoto.js";
import { buildCurrentRentals } from "./teacherGearStatus.js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

const MONTH_SHORT = ["", "1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
const LIST_PREVIEW = 5;

const FILTERS = [
  { id: "all", label: "전체" },
  { id: "rental", label: "대여" },
  { id: "air", label: "에어" },
  { id: "prop", label: "소도구" },
];

function parseDay(value) {
  if (!value) return null;
  const d = new Date(`${value}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function gearTypeBadge(gear) {
  if (gear?.is_air_product) return { label: "에어", tone: "air" };
  return { label: "대여", tone: "rental" };
}

function resolveGearItemEntries(gear, items) {
  if (!gear) return [];
  if (gear.merged) {
    const item = resolveItemRecord(items, gear.item_name);
    return [{ label: null, name: gear.displayName, item }];
  }
  if (gear.parts?.length) {
    return gear.parts.map(p => ({
      label: p.label,
      name: p.name,
      item: resolveItemRecord(items, p.name),
    }));
  }
  const item = resolveItemRecord(items, gear.item_name);
  return [{ label: null, name: gear.displayName, item }];
}

function resolveGearPhotoEntries(gear, items) {
  return resolveGearItemEntries(gear, items).filter(e => e.item?.photo_url);
}

function matchesFilter(filterId, gear, items) {
  if (filterId === "all") return true;
  const entries = resolveGearItemEntries(gear, items);
  return entries.some(({ item }) => {
    if (filterId === "air") return Boolean(gear?.is_air_product);
    if (filterId === "prop") {
      const cat = item?.category;
      return ["TOOL", "STACK", "TARGET", "ETC", "SPC"].includes(cat);
    }
    if (filterId === "rental") return !gear?.is_air_product;
    return true;
  });
}

function weekRentalStatusForGear(weekSlot, gear, items, heldIds) {
  const ids = resolveGearItemEntries(gear, items).map(e => e.item?.id).filter(Boolean);
  if (!ids.length) return { label: "대여 예정", tone: "scheduled" };
  if (ids.some(id => heldIds.has(id))) {
    return { label: "대여 중", tone: "rented" };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = parseDay(weekSlot?.week_end_date);
  const start = parseDay(weekSlot?.week_start_date);
  if (end && end < today) return { label: "반납 완료", tone: "done" };
  if (start && start > today) return { label: "대여 예정", tone: "scheduled" };
  return { label: "대여 예정", tone: "scheduled" };
}

function GearPhoto({ item, className, alt }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [item?.id, item?.photo_url]);

  if (!item?.photo_url || failed) return null;

  return (
    <img
      src={item.photo_url}
      alt={alt || item.name}
      className={className}
      onError={() => setFailed(true)}
      style={itemPhotoStyle(item, { width: "100%", height: "100%" })}
    />
  );
}

function SchoolYearTimeline({ months, viewMonth, todayMonth, onSelect }) {
  const activeRef = useRef(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [viewMonth]);

  return (
    <section className="gear-rotation-months">
      <h2 className="gear-rotation-months__title">학년도 월별 보기</h2>
      <div className="gear-rotation-months__scroll">
        {months.map((m) => {
          const isView = m === viewMonth;
          const isToday = m === todayMonth;
          const [, mo] = m.split("-").map(Number);
          return (
            <button
              key={m}
              ref={isView ? activeRef : undefined}
              type="button"
              className={`gear-rotation-month-btn${isView ? " gear-rotation-month-btn--active" : ""}`}
              onClick={() => onSelect(m)}
            >
              <span className="gear-rotation-month-btn__label">{MONTH_SHORT[mo] || `${mo}월`}</span>
              {isToday && <span className="gear-rotation-month-btn__now">이번 달</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function GearPhotoGroup({ entries }) {
  if (!entries.length) return null;

  const countMod = entries.length === 1 ? "single" : "multi";

  return (
    <div className={`gear-rotation-equipment-images gear-rotation-equipment-images--${countMod}`}>
      {entries.map(({ item, label, name }) => (
        <div key={`${label}-${name}`} className="gear-rotation-equipment-image-card">
          {label && <span className="gear-rotation-photo-label">{label}</span>}
          <GearPhoto item={item} alt={name} />
        </div>
      ))}
    </div>
  );
}

function gearNamesForLessonPlan(gear) {
  if (!gear) return [];
  if (gear.merged) return [gear.item_name].filter(Boolean);
  if (gear.parts?.length) return gear.parts.map(p => p.name).filter(Boolean);
  return [gear.item_name || gear.displayName].filter(Boolean);
}

function LessonPlanPanel({ plan }) {
  if (!plan) return null;
  return (
    <details className="gear-rotation-plan">
      <summary className="gear-rotation-plan__summary">수업 계획안</summary>
      <div className="gear-rotation-plan__body">
        {plan.activity_description ? (
          <div className="gear-rotation-plan__block">
            <div className="gear-rotation-plan__label">Activity</div>
            <p className="gear-rotation-plan__text">{plan.activity_description}</p>
          </div>
        ) : null}
        {plan.key_expressions ? (
          <div className="gear-rotation-plan__block">
            <div className="gear-rotation-plan__label">Key Expressions</div>
            <p className="gear-rotation-plan__text">{plan.key_expressions}</p>
          </div>
        ) : null}
      </div>
    </details>
  );
}

function WeekHighlightCard({ variant, label, dateRange, gear, items, heldIds, lessonPlans, aliases, yearMonth, weekNumber, onRent, onOpenGear }) {
  const typeBadge = gearTypeBadge(gear);
  const photoEntries = useMemo(
    () => resolveGearPhotoEntries(gear, items),
    [gear, items],
  );
  const entries = useMemo(
    () => (gear ? resolveGearItemEntries(gear, items) : []),
    [gear, items],
  );
  const rentedCount = entries.filter(e => e.item?.id && heldIds?.has(e.item.id)).length;
  const lessonPlan = useMemo(() => {
    if (!gear || !yearMonth || !weekNumber) return null;
    for (const name of gearNamesForLessonPlan(gear)) {
      const plan = findLessonPlanForKoreanItem(lessonPlans, aliases, yearMonth, weekNumber, name);
      if (plan) return plan;
    }
    return null;
  }, [gear, lessonPlans, aliases, yearMonth, weekNumber]);

  if (!gear) {
    return (
      <article className={`gear-rotation-highlight gear-rotation-highlight--${variant} gear-rotation-highlight--empty`}>
        <p>{label} 교구 정보 없음</p>
      </article>
    );
  }

  return (
    <article className={`gear-rotation-highlight gear-rotation-highlight--${variant}${photoEntries.length ? " gear-rotation-highlight--has-photo" : ""}`}>
      <div className="gear-rotation-highlight__content">
        <div className="gear-rotation-highlight__text">
          <p className="gear-rotation-highlight__period">
            {label}
            {dateRange ? <span>{dateRange}</span> : null}
          </p>
          <div className="gear-rotation-highlight__name-row">
            <h3 className="gear-rotation-highlight__name">{gear.displayName}</h3>
            <span className={`gear-rotation-type-badge gear-rotation-type-badge--${typeBadge.tone}`}>
              {typeBadge.label}
            </span>
          </div>
          {!gear.merged && gear.parts?.map(p => {
            const item = resolveItemRecord(items, p.name);
            const rented = item?.id && heldIds?.has(item.id);
            return (
              <p key={p.label} className="gear-rotation-highlight__sub">
                {p.label}: {p.name}
                {rented ? <span className="gear-rotation-highlight__rented-tag"> · 대여 중</span> : null}
              </p>
            );
          })}
          {rentedCount > 0 ? (
            <p className="gear-rotation-highlight__rented-summary">대여 중 {rentedCount}종</p>
          ) : null}
          {gear.simple_activity && (
            <p className="gear-rotation-highlight__activity">{gear.simple_activity}</p>
          )}
          <LessonPlanPanel plan={lessonPlan} />
        </div>
        <GearPhotoGroup entries={photoEntries} />
        <div className={`gear-rotation-highlight__actions${variant === "current" ? "" : " gear-rotation-highlight__actions--single"}`}>
          {variant === "current" ? (
            <button type="button" className="gear-rotation-highlight__cta" onClick={() => onRent(gear)}>
              이 교구 대여 신청 →
            </button>
          ) : null}
          <button type="button" className="gear-rotation-highlight__link" onClick={() => onOpenGear(gear)}>
            상세 보기{entries.length > 1 ? ` (${entries.length})` : ""}
          </button>
        </div>
      </div>
    </article>
  );
}

function MonthGearRow({ row, items, status, heldIds, lessonPlans, aliases, viewMonth, onOpenGear }) {
  const typeBadge = gearTypeBadge(row.gear);
  const activityLine = row.gear.simple_activity
    || (row.gear.simpleActivities?.length ? row.gear.simpleActivities.join(" / ") : null);
  const photoEntries = useMemo(
    () => resolveGearPhotoEntries(row.gear, items),
    [row.gear, items],
  );

  const entries = useMemo(
    () => resolveGearItemEntries(row.gear, items),
    [row.gear, items],
  );
  const rentedEntries = entries.filter(e => e.item?.id && heldIds.has(e.item.id));
  const lessonPlan = useMemo(() => {
    for (const name of gearNamesForLessonPlan(row.gear)) {
      const plan = findLessonPlanForKoreanItem(
        lessonPlans, aliases, viewMonth, row.weekNumber, name,
      );
      if (plan) return plan;
    }
    return null;
  }, [row.gear, row.weekNumber, lessonPlans, aliases, viewMonth]);

  return (
    <article className="gear-rotation-row">
      <div className="gear-rotation-row__content">
        <div className="gear-rotation-row__header">
          <div className="gear-rotation-row__dates">
            {row.weekLabel ? (
              <>
                <div>{row.weekLabel}</div>
                {row.dateRange ? <div className="gear-rotation-row__dates-sub">{row.dateRange}</div> : null}
              </>
            ) : (row.dateRange || `${row.weekNumber}주차`)}
          </div>
          <div className="gear-rotation-row__title-row">
            <h4 className="gear-rotation-row__title">{row.gear.displayName}</h4>
            <span className={`gear-rotation-type-badge gear-rotation-type-badge--${typeBadge.tone}`}>
              {typeBadge.label}
            </span>
            <span className={`gear-rotation-status gear-rotation-status--${status.tone}`}>
              {status.label}
            </span>
          </div>
          {!row.gear.merged && row.gear.parts?.map(p => {
            const item = resolveItemRecord(items, p.name);
            const rented = item?.id && heldIds.has(item.id);
            return (
              <p key={p.label} className="gear-rotation-row__sub">
                {p.label}: {p.name}
                {rented ? <span className="gear-rotation-highlight__rented-tag"> · 대여 중</span> : null}
              </p>
            );
          })}
          {activityLine && (
            <p className="gear-rotation-row__meta">활동영역: {activityLine}</p>
          )}
          {rentedEntries.length > 0 ? (
            <p className="gear-rotation-row__rented-hint gear-rotation-row__rented-hint--inline">
              대여 {rentedEntries.length}종
            </p>
          ) : null}
          <LessonPlanPanel plan={lessonPlan} />
        </div>
        <GearPhotoGroup entries={photoEntries} />
        <div className="gear-rotation-row__actions">
          <button type="button" className="gear-rotation-row__link gear-rotation-row__link--btn" onClick={() => onOpenGear(row.gear)}>
            상세 보기{entries.length > 1 ? ` (${entries.length})` : ""}
          </button>
        </div>
      </div>
    </article>
  );
}

function GearItemsDetailModal({ gear, items, heldIds, onClose, onOpenItem }) {
  const entries = resolveGearItemEntries(gear, items);

  return (
    <div className="sch-modal-overlay" onClick={onClose}>
      <div className="sch-modal gear-rotation-gear-modal" onClick={e => e.stopPropagation()}>
        <h3>{gear?.displayName || "교구 상세"}</h3>
        <ul className="gear-rotation-gear-modal-list">
          {entries.map(({ label, name, item }) => {
            const rented = item?.id && heldIds.has(item.id);
            return (
              <li key={`${label}-${name}`} className="gear-rotation-gear-modal-item">
                <div>
                  {label ? <span className="gear-rotation-gear-modal-tag">{label}</span> : null}
                  <strong>{name}</strong>
                  {rented ? <span className="gear-rotation-gear-modal-rented">대여 중</span> : null}
                  {!item ? (
                    <p className="gear-rotation-gear-modal-miss">재고 목록에서 찾을 수 없음</p>
                  ) : null}
                </div>
                {item ? (
                  <button type="button" className="sch-btn sch-btn--ghost sch-btn--sm" onClick={() => onOpenItem(item)}>
                    상세 보기
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
        <div className="sch-form-actions">
          <button type="button" className="sch-btn sch-btn--ghost" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}

function Spinner({ text }) {
  return (
    <div className="gear-rotation-loading">
      <div>⏳</div>
      <p>{text || "불러오는 중..."}</p>
    </div>
  );
}

export default function MyGearRotationPage({
  me,
  items,
  reqs,
  ris,
  rets,
  onDetail,
  onGoRental,
  PageHeader,
  PageShell,
}) {
  const startYear = schoolYearStartYear();
  const todayMonth = yearMonthKey();
  const schoolMonths = useMemo(() => schoolYearMonths(startYear), [startYear]);

  const [viewMonth, setViewMonth] = useState(() => clampToSchoolYear(todayMonth, startYear));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [schedules, setSchedules] = useState([]);
  const [weeklyLists, setWeeklyLists] = useState([]);
  const [allMonthWeeks, setAllMonthWeeks] = useState([]);
  const [lessonPlans, setLessonPlans] = useState([]);
  const [equipmentAliases, setEquipmentAliases] = useState([]);
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState(false);
  const [gearDetail, setGearDetail] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const ymKeys = schoolMonths.map(m => yearMonthFirstDay(m));
        const subjectId = rotationSubjectTeacherId(me);
        const [schedRes, weeklyRes, weeksRes, plansRes, aliasRes] = await Promise.all([
          supabase.from("item_rotation_schedule")
            .select("year_month, assigned_letter, teacher_id")
            .eq("teacher_id", subjectId)
            .in("year_month", ymKeys),
          supabase.from("item_weekly_lists").select("*").order("week_number"),
          supabase.from("item_rotation_month_weeks")
            .select("*")
            .in("year_month", ymKeys)
            .order("week_number"),
          supabase.from("monthly_lesson_plans")
            .select("*")
            .in("year_month", ymKeys)
            .order("week_number"),
          supabase.from("equipment_name_aliases").select("*"),
        ]);

        if (schedRes.error?.code === "42P01") {
          setError("교구 순환 테이블이 아직 생성되지 않았습니다. 관리자에게 문의하세요.");
          return;
        }
        if (schedRes.error) throw schedRes.error;
        if (weeklyRes.error) throw weeklyRes.error;
        if (weeksRes.error && weeksRes.error.code !== "42P01") throw weeksRes.error;
        if (plansRes.error && plansRes.error.code !== "42P01") throw plansRes.error;
        if (aliasRes.error && aliasRes.error.code !== "42P01") throw aliasRes.error;

        if (!cancelled) {
          setSchedules(resolveRotationSchedules(schedRes.data || [], me, startYear));
          setWeeklyLists(weeklyRes.data || []);
          setAllMonthWeeks(weeksRes.data || []);
          setLessonPlans(plansRes.error?.code === "42P01" ? [] : (plansRes.data || []));
          setEquipmentAliases(aliasRes.error?.code === "42P01" ? [] : (aliasRes.data || []));
        }
      } catch (e) {
        if (!cancelled) setError(e.message || "데이터를 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [me, schoolMonths, startYear]);

  const heldIds = useMemo(() => {
    const rentals = buildCurrentRentals(me, reqs || [], ris || [], items || [], rets || []);
    return new Set(rentals.map(r => r.itemId).filter(Boolean));
  }, [me, reqs, ris, items, rets]);

  const letterForMonth = (monthKey) => assignedLetterForMonth(schedules, me, monthKey);

  const weeksForMonth = (monthKey) =>
    allMonthWeeks.filter(w => w.year_month?.startsWith(String(monthKey).slice(0, 7)));

  const currentWeekSlot = useMemo(
    () => findCurrentRotationWeekSlot(allMonthWeeks),
    [allMonthWeeks],
  );

  const thisWeekLabel = currentWeekSlot
    ? rotationWeekLabelForSlot(currentWeekSlot)
    : formatCalendarWeekLabel();
  const thisWeekRange = currentWeekSlot
    ? rotationWeekRangeForSlot(currentWeekSlot)
    : formatCalendarWeekRange();

  const currentMonthKey = currentWeekSlot
    ? String(currentWeekSlot.year_month).slice(0, 7)
    : todayMonth;

  const currentLetter = letterForMonth(currentMonthKey);

  const thisWeekGear = useMemo(() => {
    if (!currentLetter || !currentWeekSlot) return null;
    return getWeekItemsForLetter(weeklyLists, currentLetter, currentWeekSlot.week_number);
  }, [currentLetter, currentWeekSlot, weeklyLists]);

  const nextWeekSlot = useMemo(
    () => findNextRotationWeekSlot(allMonthWeeks),
    [allMonthWeeks],
  );

  const nextWeekLabel = nextWeekSlot
    ? rotationWeekLabelForSlot(nextWeekSlot)
    : formatCalendarWeekLabel(new Date(Date.now() + 7 * 86400000));
  const nextWeekRange = nextWeekSlot
    ? rotationWeekRangeForSlot(nextWeekSlot)
    : formatCalendarWeekRange(new Date(Date.now() + 7 * 86400000));

  const nextWeekMonthKey = nextWeekSlot ? String(nextWeekSlot.year_month).slice(0, 7) : null;
  const nextLetter = nextWeekMonthKey ? letterForMonth(nextWeekMonthKey) : null;

  const nextWeekGear = useMemo(() => {
    if (!nextLetter || !nextWeekSlot) return null;
    return getWeekItemsForLetter(weeklyLists, nextLetter, nextWeekSlot.week_number);
  }, [nextLetter, nextWeekSlot, weeklyLists]);

  const viewLetter = letterForMonth(viewMonth);
  const viewMonthWeeks = weeksForMonth(viewMonth);

  const monthWeekRows = useMemo(() => {
    if (!viewLetter) return [];
    const weeksMap = new Map(viewMonthWeeks.map(w => [w.week_number, w]));
    const weekNumbers = viewMonthWeeks.length
      ? [...viewMonthWeeks].sort((a, b) => a.week_number - b.week_number).map(w => w.week_number)
      : [1, 2, 3, 4, 5];
    return weekNumbers.map(wn => {
      const gear = getWeekItemsForLetter(weeklyLists, viewLetter, wn);
      if (!gear) return null;
      const mw = weeksMap.get(wn);
      return {
        weekNumber: wn,
        dateRange: mw ? formatWeekRange(mw.week_start_date, mw.week_end_date) : null,
        weekLabel: mw ? rotationWeekLabelForSlot(mw) : null,
        weekSlot: mw || null,
        gear,
        status: weekRentalStatusForGear(mw, gear, items, heldIds),
      };
    }).filter(Boolean);
  }, [viewLetter, weeklyLists, viewMonthWeeks, items, heldIds]);

  const filteredRows = useMemo(
    () => monthWeekRows.filter(row => matchesFilter(filter, row.gear, items)),
    [monthWeekRows, filter, items],
  );

  const visibleRows = expanded ? filteredRows : filteredRows.slice(0, LIST_PREVIEW);
  const hasMore = filteredRows.length > LIST_PREVIEW;

  useEffect(() => {
    setExpanded(false);
    setFilter("all");
  }, [viewMonth]);

  const openItemRecord = (item) => {
    if (item) {
      onDetail(item, "my-gear-rotation");
      setGearDetail(null);
    }
  };

  const openGear = (gear) => {
    if (!gear) return;
    const entries = resolveGearItemEntries(gear, items);
    const resolved = entries.filter(e => e.item);
    if (resolved.length === 0) {
      alert(`「${gear.displayName}」 교구를 재고 목록에서 찾지 못했습니다.\n관리자에게 이름 매칭을 요청하세요.`);
      return;
    }
    if (resolved.length === 1) {
      openItemRecord(resolved[0].item);
      return;
    }
    setGearDetail(gear);
  };

  const handleRent = (gear) => {
    openGear(gear);
  };

  return (
    <PageShell>
      <PageHeader
        me={me}
        subtitle="이번 주 교구를 확인하고, 학년도 전체 월별 교구를 살펴볼 수 있습니다."
      />

      {loading && <Spinner text="순환 배정 불러오는 중..." />}
      {!loading && error && (
        <div className="gear-rotation-error">{error}</div>
      )}

      {!loading && !error && (
        <div className="gear-rotation-page">
          <section className="gear-rotation-highlights-grid">
            <WeekHighlightCard
              variant="current"
              label={thisWeekLabel}
              dateRange={thisWeekRange}
              gear={thisWeekGear}
              items={items}
              heldIds={heldIds}
              lessonPlans={lessonPlans}
              aliases={equipmentAliases}
              yearMonth={currentMonthKey}
              weekNumber={currentWeekSlot?.week_number}
              onRent={handleRent}
              onOpenGear={openGear}
            />
            <WeekHighlightCard
              variant="next"
              label={nextWeekLabel}
              dateRange={nextWeekRange}
              gear={nextWeekGear}
              items={items}
              heldIds={heldIds}
              lessonPlans={lessonPlans}
              aliases={equipmentAliases}
              yearMonth={nextWeekMonthKey}
              weekNumber={nextWeekSlot?.week_number}
              onRent={handleRent}
              onOpenGear={openGear}
            />
          </section>

          {!currentWeekSlot && (
            <p className="gear-rotation-hint">
              이번 주({thisWeekRange})에 해당하는 순환 주차 데이터가 없습니다.
            </p>
          )}

          <SchoolYearTimeline
            months={schoolMonths}
            viewMonth={viewMonth}
            todayMonth={todayMonth}
            onSelect={setViewMonth}
          />

          <section className="gear-rotation-list-section">
            <div className="gear-rotation-list-head">
              <h2 className="gear-rotation-list-title">{monthLabel(viewMonth)} 전체 교구</h2>
              <div className="gear-rotation-filters">
                {FILTERS.map(f => (
                  <button
                    key={f.id}
                    type="button"
                    className={`gear-rotation-filter${filter === f.id ? " gear-rotation-filter--active" : ""}`}
                    onClick={() => setFilter(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {!viewLetter && (
              <div className="gear-rotation-empty">{monthLabel(viewMonth)} 순환 배정이 없습니다.</div>
            )}

            {viewLetter && filteredRows.length === 0 && (
              <div className="gear-rotation-empty">해당 필터에 맞는 교구가 없습니다.</div>
            )}

            {viewLetter && filteredRows.length > 0 && (
              <>
                <div className="gear-rotation-list">
                  {visibleRows.map(row => (
                    <MonthGearRow
                      key={row.weekNumber}
                      row={row}
                      items={items}
                      status={row.status}
                      heldIds={heldIds}
                      lessonPlans={lessonPlans}
                      aliases={equipmentAliases}
                      viewMonth={viewMonth}
                      onOpenGear={openGear}
                    />
                  ))}
                </div>
                {hasMore && (
                  <button
                    type="button"
                    className="gear-rotation-expand"
                    onClick={() => setExpanded(v => !v)}
                  >
                    {expanded ? "접기" : "더 많은 교구 보기"}
                    <ChevronDown size={16} className={expanded ? "gear-rotation-expand__icon--up" : ""} />
                  </button>
                )}
              </>
            )}
          </section>
        </div>
      )}

      {gearDetail ? (
        <GearItemsDetailModal
          gear={gearDetail}
          items={items}
          heldIds={heldIds}
          onClose={() => setGearDetail(null)}
          onOpenItem={openItemRecord}
        />
      ) : null}
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
