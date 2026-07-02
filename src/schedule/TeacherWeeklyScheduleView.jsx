import { useEffect, useMemo, useState } from "react";
import { ChevronLeft } from "lucide-react";
import {
  fetchHomeVisitPatterns,
  fetchMonthlyContracts,
  fetchSubstituteAssignmentsForTeacher,
  fetchWeeklySchedule,
} from "./api.js";
import { yearMonthKey, yearMonthLastDay } from "./constants.js";
import UnifiedWeeklyScheduleGrid from "./UnifiedWeeklyScheduleGrid.jsx";
import { buildUnifiedWeeklyItems, mapStudentCountsByInstitution } from "./unifiedWeeklySchedule.js";
import { enrichWeeklyItemsWithSubstitutes } from "./substituteSchedule.js";
import TeacherPickerToolbar, { useTeacherPicker } from "./TeacherPickerToolbar.jsx";

export default function TeacherWeeklyScheduleView({ me, onBack }) {
  const picker = useTeacherPicker(me);
  const {
    admin,
    activeTeacherId,
    selectedTeacher,
    teacherSearch,
    setTeacherSearch,
    selectedTeacherId,
    selectTeacher,
    filteredTeachers,
    teacherNotFound,
    handleTeacherSearchKeyDown,
  } = picker;

  const [institutionSlots, setInstitutionSlots] = useState([]);
  const [homeVisitPatterns, setHomeVisitPatterns] = useState([]);
  const [monthlyContracts, setMonthlyContracts] = useState([]);
  const [substituteAssignments, setSubstituteAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  const yearMonth = yearMonthKey();

  useEffect(() => {
    fetchMonthlyContracts()
      .then(setMonthlyContracts)
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!activeTeacherId) {
      setInstitutionSlots([]);
      setHomeVisitPatterns([]);
      setSubstituteAssignments([]);
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
        <h2 className="sch-view-title">선생님 시간표</h2>
        <p className="sch-muted">
          {admin
            ? "선생님별 주간 시간표 — 월~금 · 모든 원 · 가정방문 · 센터"
            : "내 주간 시간표 — 월~금"}
        </p>
      </header>

      {admin ? (
        <TeacherPickerToolbar
          teacherSearch={teacherSearch}
          setTeacherSearch={setTeacherSearch}
          selectedTeacherId={selectedTeacherId}
          selectTeacher={selectTeacher}
          filteredTeachers={filteredTeachers}
          teacherNotFound={teacherNotFound}
          handleTeacherSearchKeyDown={handleTeacherSearchKeyDown}
        />
      ) : null}

      {admin && selectedTeacher ? (
        <p className="sch-unified-teacher-banner">
          <strong>{selectedTeacher.name}</strong> 선생님 주간 시간표
        </p>
      ) : null}

      {loading ? (
        <p className="sch-muted">불러오는 중...</p>
      ) : !activeTeacherId ? (
        <p className="sch-muted sch-unified-empty-prompt">선생님을 선택하면 주간 시간표가 표시됩니다.</p>
      ) : (
        <UnifiedWeeklyScheduleGrid
          items={weeklyItems}
          emptyLabel="이번 주 등록된 수업이 없습니다."
        />
      )}
    </div>
  );
}
