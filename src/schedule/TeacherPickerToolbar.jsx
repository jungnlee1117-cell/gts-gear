import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { fetchTeachers } from "./api.js";
import { isScheduleAdmin } from "./roles.js";

export function useTeacherPicker(me) {
  const admin = isScheduleAdmin(me);
  const [teachers, setTeachers] = useState([]);
  const [teacherSearch, setTeacherSearch] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState(admin ? "" : me.id);

  useEffect(() => {
    if (!admin) return;
    fetchTeachers()
      .then(rows => setTeachers(rows.filter(t => t.role === "teacher")))
      .catch(console.error);
  }, [admin]);

  const filteredTeachers = useMemo(() => {
    const q = teacherSearch.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter(t => t.name.toLowerCase().includes(q));
  }, [teachers, teacherSearch]);

  const teacherSearchQuery = teacherSearch.trim();
  const teacherNotFound = teacherSearchQuery.length > 0 && filteredTeachers.length === 0;

  const selectTeacher = useCallback((id) => {
    setSelectedTeacherId(id);
  }, []);

  useEffect(() => {
    if (!admin || !teacherSearchQuery || filteredTeachers.length !== 1) return;
    selectTeacher(filteredTeachers[0].id);
  }, [admin, teacherSearchQuery, filteredTeachers, selectTeacher]);

  const handleTeacherSearchKeyDown = useCallback((e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const q = teacherSearch.trim();
    if (!q) return;
    if (filteredTeachers.length === 0) return;
    selectTeacher(filteredTeachers[0].id);
  }, [teacherSearch, filteredTeachers, selectTeacher]);

  const selectedTeacher = useMemo(
    () => teachers.find(t => t.id === selectedTeacherId) ?? null,
    [teachers, selectedTeacherId],
  );

  const activeTeacherId = admin ? selectedTeacherId : me.id;

  return {
    admin,
    teachers,
    teacherSearch,
    setTeacherSearch,
    selectedTeacherId,
    selectTeacher,
    filteredTeachers,
    teacherNotFound,
    handleTeacherSearchKeyDown,
    selectedTeacher,
    activeTeacherId,
  };
}

export default function TeacherPickerToolbar({
  teacherSearch,
  setTeacherSearch,
  selectedTeacherId,
  selectTeacher,
  filteredTeachers,
  teacherNotFound,
  handleTeacherSearchKeyDown,
}) {
  return (
    <div className="sch-toolbar sch-unified-toolbar">
      <div className="sch-search-inline sch-unified-teacher-search">
        <Search size={16}/>
        <input
          className="sch-input"
          placeholder="선생님 이름 검색"
          value={teacherSearch}
          onChange={e => setTeacherSearch(e.target.value)}
          onKeyDown={handleTeacherSearchKeyDown}
          aria-invalid={teacherNotFound || undefined}
        />
      </div>
      <select
        className="sch-select"
        value={selectedTeacherId}
        onChange={e => selectTeacher(e.target.value)}
      >
        <option value="">선생님 선택</option>
        {filteredTeachers.map(t => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
      {teacherNotFound ? (
        <p className="sch-unified-teacher-search-error" role="alert">
          선생님을 찾을 수 없습니다
        </p>
      ) : null}
    </div>
  );
}
