import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, MessageSquareWarning } from "lucide-react";
import { yearMonthKey } from "./constants.js";
import { fetchInstitutions, fetchTeachers } from "./api.js";
import {
  CLASS_INCIDENT_SQL_HINT,
  CLASS_INCIDENT_STATUS,
  classIncidentErrorMessage,
  countClassIncidentsNeedingReview,
  fetchClassIncidentReports,
  formatIncidentDate,
  formatIncidentWhen,
  markClassIncidentReviewed,
} from "./classIncidentReports.js";
import { ClassIncidentReplies, ClassIncidentStatusBadge } from "./ClassIncidentSlotForm.jsx";

function entryLabel(row) {
  const pay = row.payroll_entries?.pay_type;
  const mins = row.payroll_entries?.minutes;
  const parts = [];
  if (pay) parts.push(pay);
  if (mins != null) parts.push(`${mins}분`);
  return parts.join(" · ");
}

export default function ClassIncidentInboxView({ me, onBack, initialYearMonth = null }) {
  const [yearMonth, setYearMonth] = useState(initialYearMonth || yearMonthKey());
  const [status, setStatus] = useState(CLASS_INCIDENT_STATUS.needs_review);
  const [institutionId, setInstitutionId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [missingTable, setMissingTable] = useState(false);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState(null);
  const [savingId, setSavingId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [result, insts, people] = await Promise.all([
        fetchClassIncidentReports({
          yearMonth,
          status,
          institutionId: institutionId || undefined,
          teacherId: teacherId || undefined,
        }),
        fetchInstitutions({ activeOnly: false }).catch(() => []),
        fetchTeachers({ yearMonth }).catch(() => []),
      ]);
      setMissingTable(!!result.missingTable);
      setRows(result.rows || []);
      setInstitutions(insts || []);
      setTeachers((people || []).filter((t) => t.role === "teacher" || t.role === "admin"));
    } catch (err) {
      setError(err?.message || "특이사항을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [yearMonth, status, institutionId, teacherId]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) => {
      const hay = [
        row.teachers?.name,
        row.institutions?.name,
        row.body,
        entryLabel(row),
      ].join(" ").toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, query]);

  const pendingCount = useMemo(
    () => rows.filter((r) => r.status === CLASS_INCIDENT_STATUS.needs_review).length,
    [rows],
  );

  const handleReview = async (id) => {
    setSavingId(id);
    try {
      await markClassIncidentReviewed(id, me.id);
      await load();
    } catch (err) {
      alert(classIncidentErrorMessage(err));
    } finally {
      setSavingId("");
    }
  };

  return (
    <div className="sch-view sch-incident-inbox">
      <header className="sch-view-header">
        <button type="button" className="sch-back-btn" onClick={onBack}>
          <ChevronLeft size={18} /> 스케줄 관리
        </button>
        <h2 className="sch-view-title">수업 특이사항</h2>
      </header>

      <p className="sch-page-desc sch-incident-inbox-desc">
        선생님이 남긴 수업 특이사항을 확인하고 답장합니다. 특이사항이 있는 수업만 표시됩니다.
      </p>

      <div className="sch-toolbar sch-incident-filters">
        <label className="sch-field sch-field--inline">
          <span>월</span>
          <input
            type="month"
            className="sch-input"
            value={yearMonth}
            onChange={(e) => setYearMonth(e.target.value)}
          />
        </label>
        <label className="sch-field sch-field--inline">
          <span>상태</span>
          <select className="sch-select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value={CLASS_INCIDENT_STATUS.needs_review}>확인 필요</option>
            <option value={CLASS_INCIDENT_STATUS.reviewed}>확인 완료</option>
            <option value="all">전체</option>
          </select>
        </label>
        <label className="sch-field sch-field--inline">
          <span>원</span>
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
        </label>
        <label className="sch-field sch-field--inline">
          <span>선생님</span>
          <select
            className="sch-select"
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
          >
            <option value="">전체 선생님</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </label>
        <input
          className="sch-input sch-incident-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="내용·선생님·원 검색"
        />
      </div>

      {status !== "all" ? (
        <p className="sch-muted sch-incident-count">
          {status === CLASS_INCIDENT_STATUS.needs_review ? `확인 필요 ${pendingCount}건` : `${filtered.length}건`}
        </p>
      ) : (
        <p className="sch-muted sch-incident-count">이번 달 {filtered.length}건</p>
      )}

      {loading ? (
        <p className="sch-muted">불러오는 중...</p>
      ) : missingTable ? (
        <p className="sch-muted">{CLASS_INCIDENT_SQL_HINT}</p>
      ) : error ? (
        <p className="sch-muted">{error}</p>
      ) : !filtered.length ? (
        <p className="sch-muted">
          {query.trim() ? "검색 결과가 없습니다." : "해당하는 특이사항이 없습니다."}
        </p>
      ) : (
        <ul className="sch-incident-list">
          {filtered.map((row) => {
            const open = openId === row.id;
            return (
              <li key={row.id} className="sch-incident-card">
                <button
                  type="button"
                  className="sch-incident-card-head"
                  onClick={() => setOpenId(open ? null : row.id)}
                >
                  <span className="sch-incident-card-icon" aria-hidden>
                    <MessageSquareWarning size={16} />
                  </span>
                  <span className="sch-incident-card-main">
                    <span className="sch-incident-card-title">
                      {row.teachers?.name || "선생님"}
                      {row.institutions?.name ? ` · ${row.institutions.name}` : ""}
                    </span>
                    <span className="sch-incident-card-sub">
                      {[formatIncidentDate(row.class_date), entryLabel(row)]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    <span className="sch-incident-card-preview">{row.body}</span>
                  </span>
                  <ClassIncidentStatusBadge status={row.status} />
                </button>
                {open ? (
                  <div className="sch-incident-card-body">
                    <p className="sch-incident-body">{row.body}</p>
                    <p className="sch-muted">
                      작성 {formatIncidentWhen(row.created_at)}
                      {row.reviewed_at ? ` · 확인 ${formatIncidentWhen(row.reviewed_at)}` : ""}
                    </p>
                    <ClassIncidentReplies
                      report={row}
                      me={me}
                      canReply
                      onChanged={load}
                    />
                    {row.status === CLASS_INCIDENT_STATUS.needs_review ? (
                      <button
                        type="button"
                        className="sch-btn sch-btn--primary sch-btn--sm"
                        disabled={savingId === row.id}
                        onClick={() => handleReview(row.id)}
                      >
                        {savingId === row.id ? "처리 중..." : "확인함"}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function useUnreadClassIncidentCount(enabled) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    countClassIncidentsNeedingReview()
      .then((n) => { if (!cancelled) setCount(n); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [enabled]);

  return count;
}

