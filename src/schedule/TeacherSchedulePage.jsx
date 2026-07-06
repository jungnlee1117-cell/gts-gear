import { useMemo, useState } from "react";
import { ChevronLeft } from "lucide-react";
import UnifiedWeeklyScheduleGrid from "./UnifiedWeeklyScheduleGrid.jsx";
import TeacherPickerToolbar, { useTeacherPicker } from "./TeacherPickerToolbar.jsx";
import TeacherMonthlyScheduleView from "./TeacherMonthlyScheduleView.jsx";
import { useTeacherWeeklySchedule } from "./useTeacherWeeklySchedule.js";
import { buildUnifiedWeeklyItems } from "./unifiedWeeklySchedule.js";
import { enrichWeeklyItemsWithSubstitutes } from "./substituteSchedule.js";
import { ONEOFF_LABEL_PREFIX } from "./payrollCalendar.js";
import { isScheduleAdmin } from "./roles.js";

const TABS = [
  { id: "weekly", label: "주간 시간표" },
  { id: "monthly", label: "월간 시간표" },
];

function TeacherWeeklyScheduleContent({ activeTeacherId, admin, selectedTeacher }) {
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

  if (!activeTeacherId) {
    return (
      <p className="sch-muted sch-unified-empty-prompt">선생님을 선택하면 주간 시간표가 표시됩니다.</p>
    );
  }

  if (loading) {
    return <p className="sch-muted">주간 시간표를 불러오는 중...</p>;
  }

  return (
    <>
      {admin && selectedTeacher ? (
        <p className="sch-unified-teacher-banner">
          <strong>{selectedTeacher.name}</strong> 선생님 주간 시간표
        </p>
      ) : null}
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
  );
}

export default function TeacherSchedulePage({ me, onBack, initialTab = "weekly" }) {
  const admin = isScheduleAdmin(me);
  const [tab, setTab] = useState(initialTab === "monthly" ? "monthly" : "weekly");
  const picker = useTeacherPicker(me);
  const {
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
    <div className="sch-view sch-teacher-schedule-page">
      <header className="sch-view-header">
        <button type="button" className="sch-back-btn" onClick={onBack}>
          <ChevronLeft size={18}/> 스케줄 관리
        </button>
        <h2 className="sch-view-title">{admin ? "선생님 시간표" : "내 시간표"}</h2>
        <p className="sch-muted">
          {admin
            ? "선생님별 주간·월간 수업 일정"
            : "주간·월간 수업 일정"}
        </p>
      </header>

      <div className="sch-tabs sch-schedule-mode-tabs" role="tablist" aria-label="시간표 보기">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`sch-tab${tab === id ? " active" : ""}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

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
        <p className="sch-muted sch-unified-empty-prompt">선생님을 선택하면 시간표가 표시됩니다.</p>
      ) : tab === "weekly" ? (
        <TeacherWeeklyScheduleContent
          activeTeacherId={activeTeacherId}
          admin={admin}
          selectedTeacher={selectedTeacher}
        />
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
