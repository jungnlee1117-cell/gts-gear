import { homeVisitColor, institutionColor } from "./constants.js";
import { ONEOFF_LESSON_COLOR } from "./oneoffLessons.js";

export default function CalendarClassLines({ lines }) {
  if (!lines?.length) return null;
  return (
    <span className="sch-cal-class-lines">
      {lines.map((line) => {
        const color = line.colorKind === "home_visit"
          ? homeVisitColor(line.colorId)
          : line.colorKind === "oneoff"
            ? ONEOFF_LESSON_COLOR
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
  );
}
