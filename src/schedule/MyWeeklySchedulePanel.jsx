import { useEffect, useMemo, useState } from "react";
import {
  buildUnifiedWeeklyItems,
  formatPayTypeLabel,
  groupWeeklyItemsByDay,
  resolveScheduleItemTheme,
  weekDayLabel,
} from "./unifiedWeeklySchedule.js";
import { enrichWeeklyItemsWithSubstitutes } from "./substituteSchedule.js";
import { ONEOFF_LABEL_PREFIX } from "./payrollCalendar.js";

const WEEKDAY_TABS = [1, 2, 3, 4, 5];
const EMPTY_SCHEDULE_LABEL = "등록된 주간 시간표가 없습니다.";

function filterRecurringWeeklySlots(slots = []) {
  return slots.filter(slot => !String(slot?.label || "").startsWith(ONEOFF_LABEL_PREFIX));
}

function formatTimeDash(start, end) {
  const s = start?.slice(0, 5) ?? "";
  const e = end?.slice(0, 5) ?? "";
  return e ? `${s} - ${e}` : s;
}

function displayInstitutionName(item) {
  if (item.source === "home_visit") return item.name;
  return item.name;
}

function institutionFilterKey(item) {
  return item.source === "home_visit" ? `hv:${item.colorKey}` : `inst:${item.colorKey}`;
}

function WeeklyClassRow({ item }) {
  const theme = resolveScheduleItemTheme(item);
  const instName = displayInstitutionName(item);

  return (
    <article className="sch-my-weekly-row">
      <div className="sch-my-weekly-row__time">{formatTimeDash(item.start_time, item.end_time)}</div>
      <div className="sch-my-weekly-row__main">
        <div className="sch-my-weekly-row__inst-line">
          <span className="sch-my-weekly-row__dot" style={{ background: theme.dot }} aria-hidden/>
          <span className="sch-my-weekly-row__inst" title={instName}>{instName}</span>
        </div>
        <p className="sch-my-weekly-row__type">{formatPayTypeLabel(item.payType)}</p>
        {item.substituteNote ? (
          <p className="sch-my-weekly-row__sub">{item.substituteNote}</p>
        ) : null}
      </div>
    </article>
  );
}

function DayClassList({ items, emptyLabel }) {
  if (!items.length) {
    return <p className="sch-my-weekly-empty">{emptyLabel}</p>;
  }
  return (
    <div className="sch-my-weekly-list">
      {items.map(item => (
        <WeeklyClassRow key={item.id} item={item}/>
      ))}
    </div>
  );
}

export default function MyWeeklySchedulePanel({
  institutionSlots = [],
  homeVisitPatterns = [],
  substituteAssignments = [],
  loading = false,
  title = "내 주간 시간표",
  description = "매주 반복되는 기본 수업 일정을 확인하세요.",
  showInstitutionFilter = true,
}) {
  const todayDow = new Date().getDay();
  const defaultDow = WEEKDAY_TABS.includes(todayDow) ? todayDow : 1;

  const [selectedDow, setSelectedDow] = useState(defaultDow);
  const [instFilter, setInstFilter] = useState("all");

  useEffect(() => {
    if (WEEKDAY_TABS.includes(todayDow)) {
      setSelectedDow(todayDow);
    }
  }, [todayDow]);

  const weeklyItems = useMemo(() => {
    const recurringSlots = filterRecurringWeeklySlots(institutionSlots);
    const built = buildUnifiedWeeklyItems(recurringSlots, homeVisitPatterns);
    return enrichWeeklyItemsWithSubstitutes(built, substituteAssignments);
  }, [institutionSlots, homeVisitPatterns, substituteAssignments]);

  const institutionFilters = useMemo(() => {
    const map = new Map();
    for (const item of weeklyItems) {
      const key = institutionFilterKey(item);
      if (!map.has(key)) {
        map.set(key, displayInstitutionName(item));
      }
    }
    return [...map.entries()].map(([key, name]) => ({ key, name }));
  }, [weeklyItems]);

  const filteredItems = useMemo(() => {
    if (instFilter === "all") return weeklyItems;
    return weeklyItems.filter(item => institutionFilterKey(item) === instFilter);
  }, [weeklyItems, instFilter]);

  const byDay = useMemo(() => groupWeeklyItemsByDay(filteredItems), [filteredItems]);
  const selectedDayItems = byDay[selectedDow] || [];
  const hasSchedule = weeklyItems.length > 0;

  return (
    <section className="sch-my-weekly" aria-label={title}>
      <header className="sch-my-weekly__head">
        <h3 className="sch-my-weekly__title">{title}</h3>
        <p className="sch-my-weekly__desc">{description}</p>
      </header>

      {showInstitutionFilter && institutionFilters.length > 1 ? (
        <div className="sch-my-weekly__filters" role="tablist" aria-label="기관 필터">
          <button
            type="button"
            className={`sch-my-weekly__filter${instFilter === "all" ? " active" : ""}`}
            onClick={() => setInstFilter("all")}
          >
            전체
          </button>
          {institutionFilters.map(({ key, name }) => (
            <button
              key={key}
              type="button"
              className={`sch-my-weekly__filter${instFilter === key ? " active" : ""}`}
              onClick={() => setInstFilter(key)}
              title={name}
            >
              {name}
            </button>
          ))}
        </div>
      ) : null}

      {loading ? (
        <p className="sch-muted sch-my-weekly-loading">주간 시간표를 불러오는 중...</p>
      ) : !hasSchedule ? (
        <p className="sch-my-weekly-empty sch-my-weekly-empty--global">{EMPTY_SCHEDULE_LABEL}</p>
      ) : (
        <>
          <div className="sch-my-weekly__mobile">
            <div className="sch-my-weekly__tabs" role="tablist" aria-label="요일 선택">
              {WEEKDAY_TABS.map(dow => (
                <button
                  key={dow}
                  type="button"
                  role="tab"
                  aria-selected={selectedDow === dow}
                  className={`sch-my-weekly__tab${selectedDow === dow ? " active" : ""}${dow === todayDow ? " is-today" : ""}`}
                  onClick={() => setSelectedDow(dow)}
                >
                  {weekDayLabel(dow)}
                </button>
              ))}
            </div>
            <p className="sch-my-weekly__day-summary">
              {weekDayLabel(selectedDow)}요일 · {selectedDayItems.length}개 수업
            </p>
            <DayClassList items={selectedDayItems} emptyLabel="—"/>
          </div>

          <div className="sch-my-weekly__desktop" aria-label="주간 시간표">
            {WEEKDAY_TABS.map(dow => {
              const dayItems = byDay[dow] || [];
              return (
                <div key={dow} className="sch-my-weekly__day-col">
                  <div className={`sch-my-weekly__day-col-head${dow === todayDow ? " is-today" : ""}`}>
                    <span>{weekDayLabel(dow)}</span>
                    <span className="sch-my-weekly__day-col-count">{dayItems.length}</span>
                  </div>
                  <DayClassList items={dayItems} emptyLabel="—"/>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
