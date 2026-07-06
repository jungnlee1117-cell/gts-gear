import { useEffect, useState } from "react";
import {
  fetchHomeVisitPatterns,
  fetchSubstituteAssignmentsForTeacher,
  fetchWeeklySchedule,
} from "./api.js";
import { yearMonthKey, yearMonthLastDay } from "./constants.js";
import { useScheduleAuthReady } from "./ScheduleAuthContext.jsx";

/**
 * 선생님 주간 시간표 데이터 (institution_weekly_schedule + home_visit_patterns)
 * TeacherMonthlyScheduleView / TeacherWeeklyScheduleView 와 동일한 API 사용
 */
export function useTeacherWeeklySchedule(teacherId, { rangeFrom, rangeTo } = {}) {
  const authReady = useScheduleAuthReady();
  const [institutionSlots, setInstitutionSlots] = useState([]);
  const [homeVisitPatterns, setHomeVisitPatterns] = useState([]);
  const [substituteAssignments, setSubstituteAssignments] = useState([]);
  const [loading, setLoading] = useState(Boolean(teacherId));
  const [error, setError] = useState(null);

  const yearMonth = yearMonthKey();
  const substituteFrom = rangeFrom || `${yearMonth}-01`;
  const substituteTo = rangeTo || yearMonthLastDay(yearMonth);

  useEffect(() => {
    if (!teacherId) {
      setInstitutionSlots([]);
      setHomeVisitPatterns([]);
      setSubstituteAssignments([]);
      setLoading(false);
      setError(null);
      return undefined;
    }

    if (!authReady) {
      setLoading(true);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchWeeklySchedule(null, teacherId),
      fetchHomeVisitPatterns({ teacherId }),
      fetchSubstituteAssignmentsForTeacher(teacherId, substituteFrom, substituteTo),
    ])
      .then(([slots, patterns, subs]) => {
        if (cancelled) return;
        if (import.meta.env.DEV) {
          console.debug("[useTeacherWeeklySchedule] teacherId", teacherId, "slots", slots?.length);
        }
        setInstitutionSlots(slots);
        setHomeVisitPatterns(patterns);
        setSubstituteAssignments(subs);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("useTeacherWeeklySchedule", err);
        setError(err);
        setInstitutionSlots([]);
        setHomeVisitPatterns([]);
        setSubstituteAssignments([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [teacherId, substituteFrom, substituteTo, authReady]);

  return {
    institutionSlots,
    homeVisitPatterns,
    substituteAssignments,
    loading,
    error,
  };
}
