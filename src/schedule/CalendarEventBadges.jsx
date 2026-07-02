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
        return (
          <span
            key={ex.id}
            className="sch-cal-event-badge"
            style={{
              background: `${color}1f`,
              borderColor: `${color}66`,
              color: "#334155",
            }}
            title={ex.institutions?.name ? `${ex.institutions.name} · ${label}` : label}
          >
            {label}
          </span>
        );
      })}
      {extra > 0 ? (
        <span className="sch-cal-event-badge sch-cal-event-badge--more">+{extra}</span>
      ) : null}
    </div>
  );
}
