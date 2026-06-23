import { useMemo } from "react";
import {
  filterExceptionsForMonth,
  formatExceptionNotice,
} from "./scheduleExceptions.js";

export default function MonthExceptionNotice({ exceptions, year, month, showInstitution = true }) {
  const items = useMemo(
    () => filterExceptionsForMonth(exceptions, year, month),
    [exceptions, year, month],
  );

  if (!items.length) return null;

  return (
    <section className="sch-month-notices" aria-label="이번 달 휴원/행사 안내">
      <h3 className="sch-month-notices-title">이번 달 휴원/행사 안내</h3>
      <ul className="sch-month-notices-list">
        {items.map(ex => (
          <li key={ex.id} className="sch-month-notices-item">
            {showInstitution && ex.institutions?.name ? (
              <span className="sch-month-notices-inst">{ex.institutions.name}</span>
            ) : null}
            <span>{formatExceptionNotice(ex)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
