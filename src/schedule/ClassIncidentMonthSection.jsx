import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CLASS_INCIDENT_SQL_HINT,
  fetchClassIncidentReports,
  formatIncidentDate,
} from "./classIncidentReports.js";
import { ClassIncidentStatusBadge } from "./ClassIncidentSlotForm.jsx";
import { ClassIncidentCategoryBadge } from "./ClassIncidentCategoryFields.jsx";
import {
  formatIncidentPreview,
  isSafetyIncident,
  sortIncidentRowsForAdmin,
} from "./classIncidentCategories.js";

export default function ClassIncidentMonthSection({ yearMonth, institutions = [] }) {
  const [rows, setRows] = useState([]);
  const [institutionId, setInstitutionId] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [missingTable, setMissingTable] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchClassIncidentReports({ yearMonth, limit: 500 });
      setMissingTable(!!result.missingTable);
      setRows(result.rows || []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [yearMonth]);

  useEffect(() => { load(); }, [load]);

  const teachers = useMemo(() => {
    const map = new Map();
    for (const row of rows) {
      if (row.teacher_id && !map.has(row.teacher_id)) {
        map.set(row.teacher_id, row.teachers?.name || "선생님");
      }
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], "ko"));
  }, [rows]);

  const filtered = useMemo(() => {
    return sortIncidentRowsForAdmin(rows.filter((row) => {
      if (institutionId && row.institution_id !== institutionId) return false;
      if (teacherFilter && row.teacher_id !== teacherFilter) return false;
      return true;
    }));
  }, [rows, institutionId, teacherFilter]);

  return (
    <section className="sch-table-section sch-incident-settlement">
      <h3>이번 달 수업 특이사항</h3>
      <p className="sch-muted sch-billing-note">
        급여 계산에는 포함되지 않습니다. 정산 전에 그달 보고를 훑어보는 용도입니다.
      </p>
      <div className="sch-toolbar">
        <select
          className="sch-select"
          value={institutionId}
          onChange={(e) => setInstitutionId(e.target.value)}
        >
          <option value="">전체 원</option>
          {institutions.map((inst) => (
            <option key={inst.id} value={inst.id}>{inst.name}</option>
          ))}
        </select>
        <select
          className="sch-select"
          value={teacherFilter}
          onChange={(e) => setTeacherFilter(e.target.value)}
        >
          <option value="">전체 선생님</option>
          {teachers.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
      </div>
      {loading ? (
        <p className="sch-muted">불러오는 중...</p>
      ) : missingTable ? (
        <p className="sch-muted">{CLASS_INCIDENT_SQL_HINT}</p>
      ) : !filtered.length ? (
        <p className="sch-muted">이번 달 특이사항이 없습니다.</p>
      ) : (
        <div className="sch-table-wrap">
          <table className="sch-table sch-table--compact">
            <thead>
              <tr>
                <th>날짜</th>
                <th>상태</th>
                <th>유형</th>
                <th>선생님</th>
                <th>원</th>
                <th>내용</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className={isSafetyIncident(row) ? "sch-incident-table-row--safety" : undefined}>
                  <td>{formatIncidentDate(row.class_date)}</td>
                  <td><ClassIncidentStatusBadge status={row.status} /></td>
                  <td>
                    <ClassIncidentCategoryBadge
                      category={row.incident_category}
                      subtype={row.incident_subtype}
                    />
                  </td>
                  <td>{row.teachers?.name || "—"}</td>
                  <td>{row.institutions?.name || "—"}</td>
                  <td className="sch-incident-table-body">{formatIncidentPreview(row)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
