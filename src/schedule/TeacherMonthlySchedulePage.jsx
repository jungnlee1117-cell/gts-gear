import { ChevronLeft } from "lucide-react";
import TeacherMonthlyScheduleView from "./TeacherMonthlyScheduleView.jsx";
import TeacherPickerToolbar, { useTeacherPicker } from "./TeacherPickerToolbar.jsx";

export default function TeacherMonthlySchedulePage({ me, onBack }) {
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

  return (
    <div className="sch-view sch-teacher-schedule-view">
      <header className="sch-view-header">
        <button type="button" className="sch-back-btn" onClick={onBack}>
          <ChevronLeft size={18}/> 스케줄 관리
        </button>
        <h2 className="sch-view-title">{admin ? "선생님 월별 일정" : "내 월별 일정"}</h2>
        <p className="sch-muted">
          {admin
            ? "선생님별 월별 수업 달력 · 원 · 가정방문 · 행사"
            : "월별 수업 달력 · 행사"}
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

      {!activeTeacherId ? (
        <p className="sch-muted sch-unified-empty-prompt">선생님을 선택하면 월별 일정이 표시됩니다.</p>
      ) : (
        <TeacherMonthlyScheduleView
          me={me}
          onBack={onBack}
          targetTeacherId={activeTeacherId}
          targetTeacherName={admin ? selectedTeacher?.name : me.name}
          embedded
        />
      )}
    </div>
  );
}
