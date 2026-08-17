import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { schoolYearStartYear } from "./lessonPlan.js";
import { schoolYearMonths, yearMonthFirstDay } from "./itemRotation.js";
import {
  ROTATION_RENTAL_FILTERS,
  ROTATION_RENTAL_STATUS_META,
  buildTeacherRotationRentalRows,
} from "./teacherRotationRentalStatus.js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

export default function TeacherRotationRentalStatusSection({
  items,
  reqs,
  ris,
  rets,
  weeklyLists,
  monthWeeks,
  weekSlot,
  weekRangeLabel,
}) {
  const startYear = schoolYearStartYear();
  const [teachers, setTeachers] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const ymKeys = schoolYearMonths(startYear).map((m) => yearMonthFirstDay(m));
        const [teachersRes, schedRes] = await Promise.all([
          supabase
            .from("teachers")
            .select("id, name, role, active")
            .eq("active", true)
            .order("name"),
          supabase
            .from("item_rotation_schedule")
            .select("year_month, assigned_letter, teacher_id")
            .in("year_month", ymKeys),
        ]);
        if (cancelled) return;
        if (teachersRes.error) throw teachersRes.error;
        if (schedRes.error && schedRes.error.code !== "42P01") throw schedRes.error;
        setTeachers(teachersRes.data || []);
        setSchedules(schedRes.data || []);
      } catch (e) {
        if (!cancelled) setError(e.message || "현황을 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [startYear]);

  const rows = useMemo(
    () => buildTeacherRotationRentalRows({
      teachers,
      schedules,
      weeklyLists,
      monthWeeks,
      items,
      reqs,
      ris,
      rets,
      weekSlot,
      startYear,
    }),
    [teachers, schedules, weeklyLists, monthWeeks, items, reqs, ris, rets, weekSlot, startYear],
  );

  const counts = useMemo(() => {
    const next = { all: rows.length, ok: 0, mismatch: 0, missing: 0 };
    for (const row of rows) next[row.status] = (next[row.status] || 0) + 1;
    return next;
  }, [rows]);

  const visible = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => r.status === filter)),
    [rows, filter],
  );

  return (
    <section className="rotation-rental-status" aria-label="선생님별 이번 주 배정·대여 현황">
      <div className="rotation-rental-status__head">
        <div>
          <h2 className="rotation-rental-status__title">선생님별 이번 주 배정·대여 현황</h2>
          <p className="rotation-rental-status__sub">
            {weekRangeLabel ? `${weekRangeLabel} · ` : ""}
            배정 교구와 실제 대여를 비교합니다.
          </p>
        </div>
        <div className="rotation-rental-status__filters" role="tablist" aria-label="현황 필터">
          {ROTATION_RENTAL_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              className={`rotation-rental-status__filter${filter === f.id ? " is-active" : ""}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
              <span>{counts[f.id] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="rotation-rental-status__empty">현황을 불러오는 중…</p>
      ) : error ? (
        <p className="rotation-rental-status__empty">{error}</p>
      ) : !weekSlot ? (
        <p className="rotation-rental-status__empty">이번 주 순환 주차 데이터가 없어 비교할 수 없습니다.</p>
      ) : visible.length === 0 ? (
        <p className="rotation-rental-status__empty">해당 조건의 선생님이 없습니다.</p>
      ) : (
        <div className="rotation-rental-status__table-wrap">
          <table className="rotation-rental-status__table">
            <thead>
              <tr>
                <th>이름</th>
                <th>배정된 교구</th>
                <th>실제 대여</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const meta = ROTATION_RENTAL_STATUS_META[row.status];
                return (
                  <tr key={row.teacherId} className={`rotation-rental-status__row rotation-rental-status__row--${row.status}`}>
                    <td className="rotation-rental-status__name">{row.teacherName}</td>
                    <td>{row.assignedNames}</td>
                    <td>
                      <span className={row.rentedHighlight ? "rotation-rental-status__rented-warn" : ""}>
                        {row.rentedNames}
                      </span>
                    </td>
                    <td>
                      <span className={`rotation-rental-status__badge rotation-rental-status__badge--${row.status}`}>
                        {meta?.label || row.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
