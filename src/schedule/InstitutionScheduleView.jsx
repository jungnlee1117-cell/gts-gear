import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, Search } from "lucide-react";
import {
  fetchHomeVisitPatterns,
  fetchMonthlyContracts,
  fetchSubstituteAssignmentsForTeacher,
  fetchTeachers,
  fetchWeeklySchedule,
} from "./api.js";
import { yearMonthKey, yearMonthLastDay } from "./constants.js";
import { isScheduleAdmin } from "./roles.js";
import UnifiedWeeklyScheduleGrid from "./UnifiedWeeklyScheduleGrid.jsx";
import { buildUnifiedWeeklyItems, mapStudentCountsByInstitution } from "./unifiedWeeklySchedule.js";
import { enrichWeeklyItemsWithSubstitutes } from "./substituteSchedule.js";

export default function InstitutionScheduleView({ me, onBack }) {
  const admin = isScheduleAdmin(me);
  const teacherId = admin ? null : me.id;

  const [teachers, setTeachers] = useState([]);
  const [teacherSearch, setTeacherSearch] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState(admin ? "" : me.id);
  const [institutionSlots, setInstitutionSlots] = useState([]);
  const [homeVisitPatterns, setHomeVisitPatterns] = useState([]);
  const [monthlyContracts, setMonthlyContracts] = useState([]);
  const [substituteAssignments, setSubstituteAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  const activeTeacherId = admin ? selectedTeacherId : teacherId;
  const yearMonth = yearMonthKey();

  useEffect(() => {
    if (!admin) return;
    fetchTeachers()
      .then(rows => setTeachers(rows.filter(t => t.role === "teacher")))
      .catch(console.error);
  }, [admin]);

  useEffect(() => {
    fetchMonthlyContracts()
      .then(setMonthlyContracts)
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!activeTeacherId) {
      setInstitutionSlots([]);
      setHomeVisitPatterns([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const monthEnd = yearMonthLastDay(yearMonth);
    Promise.all([
      fetchWeeklySchedule(null, activeTeacherId),
      fetchHomeVisitPatterns({ teacherId: activeTeacherId, status: "active" }),
      fetchSubstituteAssignmentsForTeacher(activeTeacherId, `${yearMonth}-01`, monthEnd),
    ])
      .then(([slots, patterns, subs]) => {
        setInstitutionSlots(slots);
        setHomeVisitPatterns(patterns);
        setSubstituteAssignments(subs);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [activeTeacherId, yearMonth]);

  const filteredTeachers = useMemo(() => {
    const q = teacherSearch.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter(t => t.name.toLowerCase().includes(q));
  }, [teachers, teacherSearch]);

  const selectedTeacher = useMemo(
    () => teachers.find(t => t.id === selectedTeacherId) ?? null,
    [teachers, selectedTeacherId],
  );

  const studentCountByInstitution = useMemo(
    () => mapStudentCountsByInstitution(monthlyContracts, yearMonth),
    [monthlyContracts, yearMonth],
  );

  const weeklyItems = useMemo(() => {
    const items = buildUnifiedWeeklyItems(institutionSlots, homeVisitPatterns, studentCountByInstitution);
    return enrichWeeklyItemsWithSubstitutes(items, substituteAssignments);
  }, [institutionSlots, homeVisitPatterns, studentCountByInstitution, substituteAssignments]);

  return (
    <div className="sch-view sch-unified-schedule-view">
      <header className="sch-view-header">
        <button type="button" className="sch-back-btn" onClick={onBack}>
          <ChevronLeft size={18}/> 스케줄 관리
        </button>
        <h2 className="sch-view-title">원 수업 일정</h2>
        <p className="sch-muted">
          {admin
            ? "강사별 통합 주간 시간표 — 모든 원 · 가정방문 · 센터"
            : "배정된 모든 원 · 가정방문 · 센터 시간표"}
        </p>
      </header>

      {admin ? (
        <div className="sch-toolbar sch-unified-toolbar">
          <div className="sch-search-inline sch-unified-teacher-search">
            <Search size={16}/>
            <input
              className="sch-input"
              placeholder="강사 이름 검색"
              value={teacherSearch}
              onChange={e => setTeacherSearch(e.target.value)}
            />
          </div>
          <select
            className="sch-select"
            value={selectedTeacherId}
            onChange={e => setSelectedTeacherId(e.target.value)}
          >
            <option value="">강사 선택</option>
            {filteredTeachers.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      ) : null}

      {admin && selectedTeacher ? (
        <p className="sch-unified-teacher-banner">
          <strong>{selectedTeacher.name}</strong> 선생님 주간 시간표
        </p>
      ) : null}

      {loading ? (
        <p className="sch-muted">불러오는 중...</p>
      ) : !activeTeacherId ? (
        <p className="sch-muted sch-unified-empty-prompt">강사를 선택하면 통합 시간표가 표시됩니다.</p>
      ) : (
        <UnifiedWeeklyScheduleGrid
          items={weeklyItems}
          emptyLabel="이번 주 등록된 수업이 없습니다."
        />
      )}
    </div>
  );
}
