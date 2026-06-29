import { Building2, UserRound } from "lucide-react";
import {
  WEEK_DISPLAY_ORDER,
  buildUnifiedScheduleLegend,
  formatPayTypeLabel,
  formatSlotTimeRange,
  groupWeeklyItemsByDay,
  resolveScheduleItemTheme,
  uniqueDayInstitutionBadges,
  weekDayLabel,
} from "./unifiedWeeklySchedule.js";

function ScheduleClassCard({ item }) {
  const theme = resolveScheduleItemTheme(item);
  const displayName = item.source === "home_visit" ? `가정방문 · ${item.name}` : item.name;

  return (
    <article
      className="sch-weekly-class-card"
      style={{
        background: theme.bg,
        borderColor: theme.border,
      }}
      title={`${formatSlotTimeRange(item.start_time, item.end_time)} · ${displayName} · ${formatPayTypeLabel(item.payType)}`}
    >
      <div className="sch-weekly-class-card-body">
        <p className="sch-weekly-class-card-time">{formatSlotTimeRange(item.start_time, item.end_time)}</p>
        <p className="sch-weekly-class-card-inst" style={{ color: theme.text }} title={displayName}>
          {displayName}
        </p>
        <p className="sch-weekly-class-card-type">{formatPayTypeLabel(item.payType)}</p>
        {item.substituteNote ? (
          <p className="sch-weekly-class-card-substitute">{item.substituteNote}</p>
        ) : null}
      </div>
      {item.studentCount != null ? (
        <div className="sch-weekly-class-card-count" style={{ color: theme.text }}>
          <UserRound size={12} strokeWidth={2.2}/>
          <span>{item.studentCount}</span>
        </div>
      ) : null}
    </article>
  );
}

export default function UnifiedWeeklyScheduleGrid({ items, emptyLabel = "등록된 수업 없음" }) {
  const byDay = groupWeeklyItemsByDay(items);
  const legend = buildUnifiedScheduleLegend(items);
  const totalCount = items.length;

  return (
    <>
      {legend.length > 0 ? (
        <div className="sch-cal-legend sch-unified-legend">
          {legend.map(({ key, label, color }) => (
            <span key={key} className="sch-cal-legend-item">
              <span className="sch-cal-dot" style={{ background: color }}/>
              {label}
            </span>
          ))}
        </div>
      ) : null}

      <div className="sch-weekly-rows" aria-label="주간 통합 시간표">
        {WEEK_DISPLAY_ORDER.map(dow => {
          const dayItems = byDay[dow] || [];
          const badges = uniqueDayInstitutionBadges(dayItems);
          const isWeekend = dow === 0 || dow === 6;

          return (
            <section
              key={dow}
              className={[
                "sch-weekly-row",
                isWeekend && "sch-weekly-row--weekend",
                dayItems.length === 0 && "sch-weekly-row--empty",
              ].filter(Boolean).join(" ")}
            >
              <div className="sch-weekly-row-day">
                <span className="sch-weekly-row-day-label">{weekDayLabel(dow)}</span>
              </div>

              <div className="sch-weekly-row-inst">
                {badges.length > 0 ? (
                  <div className="sch-weekly-row-badges">
                    {badges.map(badge => (
                      <span
                        key={badge.key}
                        className="sch-weekly-inst-badge"
                        style={{
                          background: badge.theme.badge,
                          color: badge.theme.text,
                        }}
                        title={badge.name}
                      >
                        <span
                          className="sch-weekly-inst-badge-icon"
                          style={{ background: badge.theme.dot }}
                          aria-hidden
                        >
                          {badge.isHomeVisit
                            ? <UserRound size={9} color="#fff" strokeWidth={2.4}/>
                            : <Building2 size={9} color="#fff" strokeWidth={2.4}/>}
                        </span>
                        <span className="sch-weekly-inst-badge-name">{badge.name}</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="sch-weekly-row-inst-empty">—</span>
                )}
              </div>

              <div className="sch-weekly-row-cards">
                {dayItems.length === 0 ? (
                  <span className="sch-weekly-row-empty">—</span>
                ) : (
                  dayItems.map(item => (
                    <ScheduleClassCard key={item.id} item={item}/>
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>

      <p className="sch-muted sch-unified-summary">
        {totalCount > 0 ? `주간 수업 ${totalCount}슬롯` : emptyLabel}
      </p>
    </>
  );
}
