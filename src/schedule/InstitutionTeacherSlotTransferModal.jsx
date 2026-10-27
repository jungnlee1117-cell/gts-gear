import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { fmtLocalDate, yearMonthKey } from "./constants.js";
import { isTeacherVisibleInYearMonth } from "./teacherEmployment.js";
import { filterAssignableClassTeachers } from "./roles.js";
import { slotTransferLine } from "./weeklySlotDisplay.js";
import { findOverlappingInstitutionSlots, formatInstitutionOverlapWarning } from "./weeklySlotOverlap.js";
import { openTeacherSlots, slotTeacherChangePlan, weeklySlotSeriesId } from "./weeklySlotVersion.js";
import { transferSelectedWeeklySlots } from "./transferInstitutionTeacher.js";
import WeeklySlotDayList from "./WeeklySlotDayList.jsx";

const OTHER_TEACHER = "__other__";

export default function InstitutionTeacherSlotTransferModal({
  institution,
  fromAssignment,
  weekly = [],
  teachers = [],
  teacherList = [],
  changedBy = null,
  onClose,
  onDone,
}) {
  const fromTeacherId = fromAssignment?.teacher_id || "";
  const fromTeacherName = fromAssignment?.teachers?.name || "선생님";
  const today = fmtLocalDate(new Date());
  const [transferDate, setTransferDate] = useState(today);
  const [toTeacherId, setToTeacherId] = useState("");
  const [otherNote, setOtherNote] = useState("");
  const toOther = toTeacherId === OTHER_TEACHER;
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [saving, setSaving] = useState(false);

  const openSlots = useMemo(
    () => openTeacherSlots(weekly, {
      teacherId: fromTeacherId,
      institutionId: institution?.id,
      today,
    }),
    [weekly, fromTeacherId, institution?.id, today],
  );

  const teacherName = (teacherId) => {
    if (!teacherId) return "기타";
    if (teacherId === fromTeacherId) return fromTeacherName;
    return teachers.find((teacher) => teacher.id === teacherId)?.name
      || teacherList.find((teacher) => teacher.id === teacherId)?.name
      || "선생님";
  };

  const teacherCandidates = useMemo(() => {
    const source = teacherList.length ? teacherList : filterAssignableClassTeachers(teachers);
    let list = source.filter((teacher) => (
      teacher.id !== fromTeacherId && isTeacherVisibleInYearMonth(teacher, yearMonthKey())
    ));
    if (search.trim()) {
      const query = search.trim().toLowerCase();
      list = list.filter((teacher) => String(teacher.name || "").toLowerCase().includes(query));
    }
    return list.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ko"));
  }, [teacherList, teachers, search, fromTeacherId]);

  const toTeacherName = toOther
    ? "기타"
    : (teacherCandidates.find((teacher) => teacher.id === toTeacherId)?.name
      || teacherList.find((teacher) => teacher.id === toTeacherId)?.name
      || "");

  const selectedSlots = openSlots.filter((slot) => selectedIds.has(slot.id));

  const toggleSlot = (slotId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(slotId)) next.delete(slotId);
      else next.add(slotId);
      return next;
    });
  };

  const toggleDay = (slotIds, checked) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const slotId of slotIds) {
        if (checked) next.add(slotId);
        else next.delete(slotId);
      }
      return next;
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedSlots.length) return alert("교체할 수업을 선택해 주세요.");
    if (!toTeacherId) return alert("새 선생님을 선택해 주세요.");
    if (!transferDate) return alert("교체 적용일을 입력해 주세요.");

    const problems = selectedSlots.flatMap((slot) => {
      const plan = slotTeacherChangePlan(slot, transferDate, today);
      return plan.ok ? [] : [`${slotTransferLine(slot)}: ${plan.message}`];
    });
    if (problems.length) return alert(problems.join("\n"));

    const names = new Map(teachers.map((teacher) => [teacher.id, teacher.name]));
    if (toTeacherName) names.set(toTeacherId, toTeacherName);
    const overlapHits = [];
    const seen = new Set();
    for (const slot of (toOther ? [] : selectedSlots)) {
      const plan = slotTeacherChangePlan(slot, transferDate, today);
      const hits = findOverlappingInstitutionSlots({
        slots: weekly,
        institutionId: institution?.id,
        teacherId: toTeacherId,
        dayOfWeek: slot.day_of_week,
        startTime: slot.start_time,
        endTime: slot.end_time,
        effectiveFrom: plan.mode === "inplace" ? slot.effective_from : transferDate,
        effectiveTo: slot.effective_to || null,
        excludeSeriesIds: selectedSlots.map(weeklySlotSeriesId),
      });
      for (const hit of hits) {
        if (seen.has(hit.id)) continue;
        seen.add(hit.id);
        overlapHits.push(hit);
      }
    }
    if (overlapHits.length) {
      const proceed = confirm(
        `${formatInstitutionOverlapWarning(overlapHits[0], names)}\n\n그래도 교체할까요?`,
      );
      if (!proceed) return;
    }

    const lines = selectedSlots.map(slotTransferLine).join("\n");
    if (!confirm(
      `${fromTeacherName} 선생님의 선택한 수업을 ${toOther ? `기타${otherNote.trim() ? `(${otherNote.trim()})` : ""}(회사 선생님 없음)` : `${toTeacherName} 선생님`}에게 ${transferDate}부터 넘길까요?\n\n${lines}\n\n적용일 전날까지는 기존 수업이 남고, 적용일부터 새 기록이 생깁니다.`,
    )) {
      return;
    }

    setSaving(true);
    try {
      const result = await transferSelectedWeeklySlots({
        slots: selectedSlots,
        toTeacherId: toOther ? null : toTeacherId,
        toOther,
        otherNote,
        transferDate,
        changedBy,
        institutionId: institution?.id,
        institutionName: institution?.name,
        fromTeacherId,
      });
      alert(`수업 교체가 완료되었습니다.\n이관된 시간표 슬롯: ${result.weeklyTransferred}건`);
      onDone?.();
      onClose?.();
    } catch (err) {
      alert("변경 실패: " + (err.message || "알 수 없는 오류"));
      onDone?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sch-modal-overlay" onClick={() => !saving && onClose?.()}>
      <div
        className="sch-modal sch-modal--wide sch-modal--transfer"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sch-modal-head">
          <h3>{fromTeacherName} 선생님 교체</h3>
          <button type="button" className="sch-icon-btn" onClick={onClose} disabled={saving}>
            <X size={18}/>
          </button>
        </div>
        <form className="sch-form sch-form--flush" onSubmit={handleSubmit}>
          <p className="sch-muted" style={{ marginTop: 0 }}>
            넘길 수업만 선택합니다. 적용일 전날까지는 기존 선생님 수업으로 남고,
            적용일부터 새 선생님 수업이 현재 기록이 됩니다.
          </p>

          <div className="sch-transfer-toolbar">
            <label className="sch-field">
              <span>새 선생님 검색</span>
              <div className="sch-search-inline">
                <Search size={16}/>
                <input
                  className="sch-input"
                  placeholder="이름으로 검색"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </label>
            <label className="sch-field">
              <span>새 선생님 *</span>
              <select
                className="sch-select"
                value={toTeacherId}
                onChange={(event) => setToTeacherId(event.target.value)}
                required
              >
                <option value="">선택하세요</option>
                {teacherCandidates.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>{teacher.name} 선생님</option>
                ))}
                <option value={OTHER_TEACHER}>기타 (일용직·수업 취소 등)</option>
              </select>
            </label>
            {toOther ? (
              <label className="sch-field">
                <span>기타 메모 (이름·사유)</span>
                <input
                  className="sch-input"
                  placeholder="예: 일용직 홍길동 / 수업 취소"
                  value={otherNote}
                  onChange={(event) => setOtherNote(event.target.value)}
                />
              </label>
            ) : null}
            <label className="sch-field">
              <span>교체 적용일 *</span>
              <input
                type="date"
                className="sch-input"
                value={transferDate}
                onChange={(event) => setTransferDate(event.target.value)}
                required
              />
            </label>
          </div>

          <div className={`sch-regular-classes sch-regular-classes--no-inst${openSlots.length ? " sch-regular-classes--pick" : ""}`}>
            <WeeklySlotDayList
              slots={openSlots}
              teacherName={teacherName}
              selectable
              selectedIds={selectedIds}
              onToggle={toggleSlot}
              onToggleDay={toggleDay}
              emptyText="현재 또는 변경 예정인 수업이 없습니다."
            />
          </div>

          <div className="sch-form-actions">
            <button type="button" className="sch-btn sch-btn--ghost" onClick={onClose} disabled={saving}>
              취소
            </button>
            <button
              type="submit"
              className="sch-btn sch-btn--primary"
              disabled={saving || !openSlots.length}
            >
              {saving ? "처리 중..." : `선택한 ${selectedSlots.length}개 교체`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
