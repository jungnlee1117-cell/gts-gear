import { useEffect, useMemo, useState } from "react";
import { fetchInstitutionClassesForDateRange } from "./api.js";

function rowKey(row) {
  return `${row.class_date}:${row.schedule_series_id || row.schedule_slot_id}`;
}

function shortDate(dateStr) {
  const [, month, day] = String(dateStr).split("-");
  return `${Number(month)}월 ${Number(day)}일`;
}

export default function ScheduleClassCancellationPicker({ form, setForm }) {
  const enabled = form.exception_type === "class_cancelled";
  const queryKey = enabled && form.institution_id && form.start_date
    ? `${form.institution_id}:${form.start_date}:${form.end_date || form.start_date}`
    : "";
  const [candidates, setCandidates] = useState([]);
  const [loadedKey, setLoadedKey] = useState("");
  const [error, setError] = useState("");
  const loading = Boolean(queryKey) && loadedKey !== queryKey;

  useEffect(() => {
    if (!queryKey) return undefined;
    let cancelled = false;
    const [institutionId, startDate, endDate] = queryKey.split(":");
    fetchInstitutionClassesForDateRange(institutionId, startDate, endDate)
      .then(rows => {
        if (cancelled) return;
        setCandidates(rows);
        setError("");
        setLoadedKey(queryKey);
        setForm(current => ({
          ...current,
          class_candidate_count: rows.length,
        }));
      })
      .catch(err => {
        if (cancelled) return;
        setCandidates([]);
        setError(err?.message || "수업 목록을 불러오지 못했습니다.");
        setLoadedKey(queryKey);
      });
    return () => { cancelled = true; };
  }, [queryKey, setForm]);

  const selectedRows = useMemo(
    () => (Array.isArray(form.cancelled_classes) ? form.cancelled_classes : []),
    [form.cancelled_classes],
  );
  const selectedKeys = useMemo(() => new Set(selectedRows.map(rowKey)), [selectedRows]);
  const grouped = useMemo(() => {
    const map = new Map();
    for (const row of candidates) {
      if (!map.has(row.class_date)) map.set(row.class_date, []);
      map.get(row.class_date).push(row);
    }
    return [...map.entries()];
  }, [candidates]);

  if (!enabled) return null;
  if (!form.institution_id || !form.start_date) {
    return <p className="sch-class-cancel-empty">원과 시작일을 먼저 선택해주세요.</p>;
  }

  const toggle = (row, checked) => {
    setForm(current => {
      const currentRows = Array.isArray(current.cancelled_classes) ? current.cancelled_classes : [];
      const key = rowKey(row);
      const next = checked
        ? [...currentRows.filter(item => rowKey(item) !== key), row]
        : currentRows.filter(item => rowKey(item) !== key);
      return { ...current, cancelled_classes: next };
    });
  };

  const allSelected = candidates.length > 0 && candidates.every(row => selectedKeys.has(rowKey(row)));

  return (
    <section className="sch-class-cancel-picker">
      <div className="sch-class-cancel-picker__head">
        <div>
          <strong>휴강할 수업 선택 *</strong>
          <p>선택한 수업만 해당 날짜의 시간표와 급여 예정에서 제외됩니다.</p>
        </div>
        {candidates.length > 0 ? (
          <button
            type="button"
            className="sch-btn sch-btn--ghost sch-btn--sm"
            onClick={() => setForm(current => ({
              ...current,
              cancelled_classes: allSelected ? [] : candidates,
            }))}
          >
            {allSelected ? "전체 해제" : "전체 선택"}
          </button>
        ) : null}
      </div>

      {loading ? <p className="sch-class-cancel-empty">수업 목록을 불러오는 중...</p> : null}
      {!loading && error ? <p className="sch-class-cancel-error">{error}</p> : null}
      {!loading && !error && candidates.length === 0 ? (
        <p className="sch-class-cancel-empty">선택한 날짜에 등록된 수업이 없습니다.</p>
      ) : null}

      {!loading && !error && grouped.length > 0 ? (
        <div className="sch-class-cancel-days">
          {grouped.map(([date, rows]) => (
            <fieldset key={date} className="sch-class-cancel-day">
              <legend>{shortDate(date)}</legend>
              {rows.map(row => {
                const key = rowKey(row);
                return (
                  <label key={key} className={`sch-class-cancel-row${selectedKeys.has(key) ? " is-selected" : ""}`}>
                    <input
                      type="checkbox"
                      checked={selectedKeys.has(key)}
                      onChange={event => toggle(row, event.target.checked)}
                    />
                    <span className="sch-class-cancel-row__label">{row.display_label}</span>
                    <span className="sch-class-cancel-row__time">{row.start_time}–{row.end_time}</span>
                    <span className="sch-class-cancel-row__type">{row.class_type}</span>
                    {row.teacher_name ? <span className="sch-class-cancel-row__teacher">{row.teacher_name}</span> : null}
                  </label>
                );
              })}
            </fieldset>
          ))}
        </div>
      ) : null}

      <p className="sch-class-cancel-picker__count">
        {selectedRows.length}개 수업 선택됨
      </p>
    </section>
  );
}
