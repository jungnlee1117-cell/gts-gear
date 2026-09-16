import { institutionColor } from "./constants.js";
import { exceptionBadgeLabel } from "./scheduleExceptions.js";

export default function CalendarEventBadges({ events, maxVisible = 4, compact = false }) {
  if (!events?.length) return null;

  const visible = events.slice(0, maxVisible);
  const extra = events.length - visible.length;

  return (
    <div className={`sch-cal-event-badges${compact ? " sch-cal-event-badges--compact" : ""}`}>
      {visible.map(ex => {
        const color = institutionColor(ex.institution_id);
        const label = exceptionBadgeLabel(ex);
        const institutionName = ex.institutions?.name?.trim() || "원";
        const fullLabel = `${institutionName} - ${label}`;
        return (
          <span
            key={ex.id}
            className="sch-cal-event-badge"
            style={{
              background: `${color}1f`,
              borderColor: `${color}66`,
              color: "#334155",
            }}
            title={fullLabel}
          >
            <span className="sch-cal-event-badge__institution">{institutionName}</span>
            <span className="sch-cal-event-badge__event"> - {label}</span>
          </span>
        );
      })}
      {extra > 0 ? (
        <span className="sch-cal-event-badge sch-cal-event-badge--more">+{extra}</span>
      ) : null}
    </div>
  );
}
