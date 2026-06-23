import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, Pencil, Square } from "lucide-react";
import { DAY_LABELS, yearMonthKey, yearMonthLastDay } from "./constants.js";
import {
  endHomeVisitPattern,
  fetchHomeVisitPatterns,
  fetchTeachers,
  upsertHomeVisitPattern,
} from "./api.js";
import { fmtLocalDate, getMonthGrid } from "./payrollCalendar.js";
import {
  expandPatternsForRange,
  formatPatternSchedule,
  groupOccurrencesByDate,
  patternStatusLabel,
} from "./homeVisitPatterns.js";
import { isScheduleAdmin } from "./roles.js";

const EMPTY_FORM = {
  id: "",
  teacher_id: "",
  student_name: "",
  student_birth_date: "",
  parent_contact: "",
  location: "",
  day_of_week: "1",
  start_time: "16:00",
  end_time: "17:00",
  pattern_start_date: "",
  note: "",
};

function formatTime(t) {
  if (!t) return "—";
  return t.slice(0, 5);
}

function formatBirthDate(d) {
  if (!d) return "—";
  return d;
}

export default function HomeVisitScheduleView({ me, onBack }) {
  const admin = isScheduleAdmin(me);
  const [yearMonth, setYearMonth] = useState(yearMonthKey());
  const [teacherFilter, setTeacherFilter] = useState(admin ? "" : me.id);
  const [patternFilter, setPatternFilter] = useState("all");
  const [teachers, setTeachers] = useState([]);
  const [patterns, setPatterns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [endTarget, setEndTarget] = useState(null);
  const [endDate, setEndDate] = useState(() => fmtLocalDate(new Date()));

  const [y, m] = yearMonth.split("-").map(Number);
  const monthStart = `${yearMonth}-01`;
  const monthEnd = yearMonthLastDay(yearMonth);
  const monthLabel = `${y}년 ${m}월`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ts, rows] = await Promise.all([
        fetchTeachers(),
        fetchHomeVisitPatterns({ teacherId: teacherFilter || undefined }),
      ]);
      setTeachers(ts.filter(t => t.role === "teacher"));
      setPatterns(rows);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [teacherFilter]);

  useEffect(() => { load(); }, [load]);

  const filteredPatterns = useMemo(() => {
    if (patternFilter === "all") return patterns;
    return patterns.filter(p => p.status === patternFilter);
  }, [patterns, patternFilter]);

  const monthOccurrences = useMemo(
    () => expandPatternsForRange(filteredPatterns, monthStart, monthEnd),
    [filteredPatterns, monthStart, monthEnd],
  );

  const visitsByDate = useMemo(
    () => groupOccurrencesByDate(monthOccurrences),
    [monthOccurrences],
  );

  const gridCells = useMemo(() => getMonthGrid(y, m - 1), [y, m]);

  const openNew = () => {
    setForm({
      ...EMPTY_FORM,
      teacher_id: teacherFilter || me.id,
      pattern_start_date: fmtLocalDate(new Date()),
    });
    setShowForm(true);
  };

  const openEdit = (pattern) => {
    setForm({
      id: pattern.id,
      teacher_id: pattern.teacher_id,
      student_name: pattern.student_name || "",
      student_birth_date: pattern.student_birth_date || "",
      parent_contact: pattern.parent_contact || "",
      location: pattern.location || "",
      day_of_week: String(pattern.day_of_week),
      start_time: formatTime(pattern.start_time),
      end_time: formatTime(pattern.end_time) === "—" ? "" : formatTime(pattern.end_time),
      pattern_start_date: pattern.pattern_start_date,
      note: pattern.note || "",
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.teacher_id) return alert("강사를 선택해주세요.");
    if (!form.student_name?.trim()) return alert("학생 이름을 입력해주세요.");
    if (!form.pattern_start_date || !form.start_time) {
      return alert("시작일과 시작 시간을 입력해주세요.");
    }
    setSaving(true);
    try {
      await upsertHomeVisitPattern({
        ...form,
        status: form.id
          ? patterns.find(p => p.id === form.id)?.status || "active"
          : "active",
      });
      setShowForm(false);
      setForm(EMPTY_FORM);
      await load();
    } catch (err) {
      alert("저장 실패: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEndSubmit = async (e) => {
    e.preventDefault();
    if (!endTarget || !endDate) return;
    if (endDate < endTarget.pattern_start_date) {
      return alert("종료일은 시작일 이후여야 합니다.");
    }
    if (!confirm(`${endTarget.student_name} 학생의 반복 일정을 ${endDate}까지로 종료할까요?\n과거 기록은 유지되고, 이후 날짜에는 더 이상 표시되지 않습니다.`)) return;
    setSaving(true);
    try {
      await endHomeVisitPattern(endTarget.id, endDate);
      setEndTarget(null);
      await load();
    } catch (err) {
      alert("종료 처리 실패: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sch-view sch-home-visit-view">
      <header className="sch-view-header">
        <button type="button" className="sch-back-btn" onClick={onBack}>
          <ChevronLeft size={18}/> 스케줄 관리
        </button>
        <h2 className="sch-view-title">선생님 방문수업 일정</h2>
      </header>

      <p className="sch-muted">
        매주 반복되는 방문수업 패턴을 등록합니다. 캘린더에는 패턴에 따라 자동으로 일정이 표시됩니다.
      </p>

      <div className="sch-toolbar">
        <input type="month" className="sch-input" value={yearMonth} onChange={e => setYearMonth(e.target.value)}/>
        {admin ? (
          <select
            className="sch-select"
            value={teacherFilter}
            onChange={e => setTeacherFilter(e.target.value)}
          >
            <option value="">전체 강사</option>
            {teachers.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        ) : null}
        <select
          className="sch-select"
          value={patternFilter}
          onChange={e => setPatternFilter(e.target.value)}
        >
          <option value="all">전체 패턴</option>
          <option value="active">진행 중</option>
          <option value="ended">종료됨</option>
        </select>
        <button type="button" className="sch-btn sch-btn--primary" onClick={openNew}>
          반복 일정 등록
        </button>
      </div>

      {loading ? <p className="sch-muted">불러오는 중...</p> : (
        <>
          <div className="sch-cal-grid sch-home-visit-cal" role="grid" aria-label={`${monthLabel} 방문수업`}>
            <div className="sch-cal-head-row" role="row">
              {DAY_LABELS.map((label, i) => (
                <div
                  key={label}
                  className={[
                    "sch-cal-head-cell",
                    (i === 0 || i === 6) && "sch-cal-head-cell--weekend",
                  ].filter(Boolean).join(" ")}
                  role="columnheader"
                >
                  {label}
                </div>
              ))}
            </div>
            <div className="sch-cal-body">
              {gridCells.map(({ date, inMonth }) => {
                const dateStr = fmtLocalDate(date);
                const dayVisits = inMonth ? (visitsByDate[dateStr] || []) : [];
                return (
                  <div
                    key={dateStr}
                    role="gridcell"
                    className={[
                      "sch-cal-cell",
                      "sch-home-visit-cell",
                      !inMonth && "sch-cal-cell--muted",
                      dayVisits.length > 0 && "sch-home-visit-cell--has",
                    ].filter(Boolean).join(" ")}
                  >
                    <span className="sch-cal-day-num">{date.getDate()}</span>
                    {dayVisits.length > 0 ? (
                      <span className="sch-home-visit-count">{dayVisits.length}건</span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <section className="sch-home-visit-list-section">
            <h3 className="sch-admin-dash-section-title">등록된 반복 패턴</h3>
            {filteredPatterns.length === 0 ? (
              <p className="sch-muted">등록된 반복 패턴이 없습니다.</p>
            ) : (
              <div className="sch-table-wrap sch-admin-table-wrap">
                <table className="sch-table sch-admin-table sch-home-visit-patterns-table">
                  <thead>
                    <tr>
                      <th>상태</th>
                      {admin && !teacherFilter ? <th>강사</th> : null}
                      <th>반복</th>
                      <th>학생</th>
                      <th>생년월일</th>
                      <th>연락처</th>
                      <th>장소</th>
                      <th>기간</th>
                      <th>메모</th>
                      <th/>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPatterns.map(p => (
                      <tr key={p.id} className={p.status === "ended" ? "sch-home-visit-row--ended" : ""}>
                        <td>
                          <span className={`sch-home-visit-status sch-home-visit-status--${p.status}`}>
                            {patternStatusLabel(p)}
                          </span>
                        </td>
                        {admin && !teacherFilter ? (
                          <td>{p.teachers?.name || "—"}</td>
                        ) : null}
                        <td>{formatPatternSchedule(p)}</td>
                        <td>{p.student_name}</td>
                        <td>{formatBirthDate(p.student_birth_date)}</td>
                        <td>{p.parent_contact || "—"}</td>
                        <td>{p.location || "—"}</td>
                        <td>
                          {p.pattern_start_date}
                          {p.pattern_end_date ? ` ~ ${p.pattern_end_date}` : " ~"}
                        </td>
                        <td>{p.note || "—"}</td>
                        <td>
                          <div className="sch-home-visit-row-actions">
                            <button type="button" className="sch-btn sch-btn--ghost sch-btn--sm" onClick={() => openEdit(p)}>
                              <Pencil size={13}/> 수정
                            </button>
                            {p.status === "active" ? (
                              <button
                                type="button"
                                className="sch-btn sch-btn--ghost sch-btn--sm"
                                onClick={() => {
                                  setEndTarget(p);
                                  setEndDate(fmtLocalDate(new Date()));
                                }}
                                disabled={saving}
                              >
                                <Square size={13}/> 종료
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="sch-home-visit-list-section">
            <h3 className="sch-admin-dash-section-title">{monthLabel} 방문수업 일정</h3>
            {monthOccurrences.length === 0 ? (
              <p className="sch-muted">이 달에 예정된 방문수업이 없습니다.</p>
            ) : (
              <div className="sch-table-wrap sch-admin-table-wrap">
                <table className="sch-table sch-admin-table">
                  <thead>
                    <tr>
                      <th>날짜</th>
                      {admin && !teacherFilter ? <th>강사</th> : null}
                      <th>시간</th>
                      <th>학생</th>
                      <th>장소</th>
                      <th>연락처</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthOccurrences.map(o => (
                      <tr key={o.id}>
                        <td>{o.visit_date}</td>
                        {admin && !teacherFilter ? (
                          <td>{o.teachers?.name || "—"}</td>
                        ) : null}
                        <td>{formatTime(o.start_time)}{o.end_time ? `–${formatTime(o.end_time)}` : ""}</td>
                        <td>{o.student_name}</td>
                        <td>{o.location || "—"}</td>
                        <td>{o.parent_contact || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {showForm ? (
        <div className="sch-modal-overlay" onClick={() => setShowForm(false)}>
          <form className="sch-modal sch-form sch-home-visit-form" onClick={e => e.stopPropagation()} onSubmit={handleSubmit}>
            <h3>{form.id ? "반복 일정 수정" : "반복 일정 등록"}</h3>
            <p className="sch-muted sch-home-visit-form-hint">
              매주 같은 요일·시간에 반복되는 방문수업을 등록합니다.
            </p>
            {admin ? (
              <label className="sch-field">
                <span>강사</span>
                <select
                  className="sch-select"
                  required
                  value={form.teacher_id}
                  onChange={e => setForm(f => ({ ...f, teacher_id: e.target.value }))}
                >
                  <option value="">선택</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="sch-field">
              <span>학생 이름</span>
              <input type="text" className="sch-input" required placeholder="학생 이름"
                value={form.student_name} onChange={e => setForm(f => ({ ...f, student_name: e.target.value }))}/>
            </label>
            <label className="sch-field">
              <span>학생 생년월일</span>
              <input type="date" className="sch-input"
                value={form.student_birth_date} onChange={e => setForm(f => ({ ...f, student_birth_date: e.target.value }))}/>
            </label>
            <label className="sch-field">
              <span>부모님 연락처</span>
              <input type="tel" className="sch-input" placeholder="010-0000-0000"
                value={form.parent_contact} onChange={e => setForm(f => ({ ...f, parent_contact: e.target.value }))}/>
            </label>
            <label className="sch-field">
              <span>장소</span>
              <input type="text" className="sch-input" placeholder="예: 서울시 강남구 ..."
                value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}/>
            </label>
            <label className="sch-field">
              <span>반복 요일</span>
              <select
                className="sch-select"
                required
                value={form.day_of_week}
                onChange={e => setForm(f => ({ ...f, day_of_week: e.target.value }))}
              >
                {DAY_LABELS.map((label, i) => (
                  <option key={label} value={String(i)}>{label}요일</option>
                ))}
              </select>
            </label>
            <div className="sch-time-row">
              <label className="sch-field">
                <span>시작 시간</span>
                <input type="time" className="sch-input" required value={form.start_time}
                  onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}/>
              </label>
              <label className="sch-field">
                <span>종료 시간 (선택)</span>
                <input type="time" className="sch-input" value={form.end_time}
                  onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}/>
              </label>
            </div>
            <label className="sch-field">
              <span>시작일 (언제부터 반복)</span>
              <input type="date" className="sch-input" required value={form.pattern_start_date}
                onChange={e => setForm(f => ({ ...f, pattern_start_date: e.target.value }))}/>
            </label>
            <label className="sch-field">
              <span>메모 (선택)</span>
              <input type="text" className="sch-input" value={form.note}
                onChange={e => setForm(f => ({ ...f, note: e.target.value }))}/>
            </label>
            <div className="sch-form-actions">
              <button type="button" className="sch-btn sch-btn--ghost" onClick={() => setShowForm(false)}>취소</button>
              <button type="submit" className="sch-btn sch-btn--primary" disabled={saving}>
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {endTarget ? (
        <div className="sch-modal-overlay" onClick={() => setEndTarget(null)}>
          <form className="sch-modal sch-form" onClick={e => e.stopPropagation()} onSubmit={handleEndSubmit}>
            <h3>반복 일정 종료</h3>
            <p className="sch-muted">
              <strong>{endTarget.student_name}</strong> · {formatPatternSchedule(endTarget)}
            </p>
            <p className="sch-muted sch-home-visit-form-hint">
              종료일까지의 과거 일정은 캘린더에 그대로 남고, 그 이후부터는 더 이상 생성되지 않습니다.
            </p>
            <label className="sch-field">
              <span>종료일 (마지막 수업일)</span>
              <input
                type="date"
                className="sch-input"
                required
                min={endTarget.pattern_start_date}
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </label>
            <div className="sch-form-actions">
              <button type="button" className="sch-btn sch-btn--ghost" onClick={() => setEndTarget(null)}>취소</button>
              <button type="submit" className="sch-btn sch-btn--primary" disabled={saving}>
                {saving ? "처리 중..." : "종료 처리"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
