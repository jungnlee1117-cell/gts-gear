import { useMemo } from "react";
import { ChevronLeft } from "lucide-react";
import UnifiedWeeklyScheduleGrid from "./UnifiedWeeklyScheduleGrid.jsx";
import TeacherPickerToolbar, { useTeacherPicker } from "./TeacherPickerToolbar.jsx";
import { useTeacherWeeklySchedule } from "./useTeacherWeeklySchedule.js";
import { buildUnifiedWeeklyItems } from "./unifiedWeeklySchedule.js";
import { enrichWeeklyItemsWithSubstitutes } from "./substituteSchedule.js";
import { ONEOFF_LABEL_PREFIX } from "./payrollCalendar.js";

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

  const {
    institutionSlots,
    homeVisitPatterns,
    substituteAssignments,
    loading,
    error,
  } = useTeacherWeeklySchedule(activeTeacherId);

  const weeklyItems = useMemo(() => {
    const recurringSlots = institutionSlots.filter(
      slot => !String(slot?.label || "").startsWith(ONEOFF_LABEL_PREFIX),
    );
    const built = buildUnifiedWeeklyItems(recurringSlots, homeVisitPatterns);
    return enrichWeeklyItemsWithSubstitutes(built, substituteAssignments);
  }, [institutionSlots, homeVisitPatterns, substituteAssignments]);

  return (
    <div className="sch-view sch-unified-schedule-view">
      <header className="sch-view-header">
        <button type="button" className="sch-back-btn" onClick={onBack}>
          <ChevronLeft size={18}/> 스케줄 관리
        </button>
        <h2 className="sch-view-title">{admin ? "선생님 시간표" : "내 주간 시간표"}</h2>
        <p className="sch-muted">
          {admin
            ? "선생님별 주간 시간표 — 월~일 · 모든 원 · 가정방문 · 센터"
            : "매주 반복 수업 일정 — 월~일"}
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

      {!activeTeacherId ? (
        <p className="sch-muted sch-unified-empty-prompt">선생님을 선택하면 주간 시간표가 표시됩니다.</p>
      ) : loading ? (
        <p className="sch-muted">주간 시간표를 불러오는 중...</p>
      ) : (
        <>
          {error ? (
            <p className="sch-muted sch-my-weekly-error" role="alert">
              주간 시간표를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
            </p>
          ) : null}
          <UnifiedWeeklyScheduleGrid
            items={weeklyItems}
            emptyLabel="등록된 주간 시간표가 없습니다."
          />
        </>
      )}
    </div>
  );
}
