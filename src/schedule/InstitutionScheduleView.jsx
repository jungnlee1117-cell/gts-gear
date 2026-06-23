import { useEffect, useMemo, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { DAY_LABELS, sortSlotsByTime } from "./constants.js";
import { fetchInstitutions, fetchWeeklySchedule } from "./api.js";
import { isScheduleAdmin } from "./roles.js";

export default function InstitutionScheduleView({ me, onBack }) {
  const admin = isScheduleAdmin(me);
  const [institutions, setInstitutions] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInstitutions({ teacherScope: !admin }).then(setInstitutions).catch(console.error);
  }, [admin]);

  useEffect(() => {
    if (!selectedId && institutions[0]) setSelectedId(institutions[0].id);
  }, [institutions, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    fetchWeeklySchedule(selectedId)
      .then(setSlots)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedId]);

  const byDay = useMemo(() => {
    const map = {};
    for (let i = 0; i < 7; i++) map[i] = [];
    for (const s of slots) map[s.day_of_week]?.push(s);
    for (let i = 0; i < 7; i++) map[i] = sortSlotsByTime(map[i]);
    return map;
  }, [slots]);

  return (
    <div className="sch-view">
      <header className="sch-view-header">
        <button type="button" className="sch-back-btn" onClick={onBack}>
          <ChevronLeft size={18}/> 스케줄 관리
        </button>
        <h2 className="sch-view-title">원 수업 일정</h2>
        <p className="sch-muted">{admin ? "전체 원 시간표 조회" : "배정된 원 시간표 조회"}</p>
      </header>

      <div className="sch-toolbar">
        <select className="sch-select" value={selectedId} onChange={e => setSelectedId(e.target.value)}>
          {institutions.map(inst => (
            <option key={inst.id} value={inst.id}>{inst.name}</option>
          ))}
        </select>
      </div>

      {loading ? <p className="sch-muted">불러오는 중...</p> : (
        <div className="sch-schedule-table">
          {DAY_LABELS.map((label, dow) => (
            <div key={label} className="sch-schedule-row">
              <div className="sch-schedule-day">{label}</div>
              <div className="sch-schedule-slots">
                {(byDay[dow] || []).length === 0 ? (
                  <span className="sch-muted">—</span>
                ) : (byDay[dow] || []).map(s => (
                  <div key={s.id} className="sch-schedule-chip">
                    <strong>{s.start_time?.slice(0, 5)}–{s.end_time?.slice(0, 5)}</strong>
                    <span>{s.class_type}</span>
                    {s.label ? <span className="sch-muted">{s.label}</span> : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
