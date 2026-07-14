import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronUp, History } from "lucide-react";
import { PAY_TYPES, formatWon } from "./constants.js";
import {
  fetchInstitutions,
  fetchPayRates,
  fetchTeachers,
  insertPayRate,
} from "./api.js";
import InstitutionSearchSelect from "./InstitutionSearchSelect.jsx";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** 오늘 기준 유효 단가 (선생님×유형×기관별 최신) */
function getCurrentRatesFromHistory(history) {
  const today = todayISO();
  const best = new Map();
  for (const r of history || []) {
    if (!r?.effective_from || r.effective_from > today) continue;
    const key = `${r.teacher_id}:${r.pay_type}:${r.institution_id || ""}`;
    const prev = best.get(key);
    if (
      !prev
      || prev.effective_from < r.effective_from
      || (
        prev.effective_from === r.effective_from
        && String(prev.created_at || "") < String(r.created_at || "")
      )
    ) {
      best.set(key, r);
    }
  }
  return [...best.values()];
}

function switchRateInputMode(currentMode, nextMode, amount) {
  const n = Number(amount);
  if (!n || n <= 0) return { mode: nextMode, amount };
  if (currentMode === "minute" && nextMode === "hour") {
    return { mode: nextMode, amount: String(Math.round(n * 60)) };
  }
  if (currentMode === "hour" && nextMode === "minute") {
    return { mode: nextMode, amount: String(Math.round((n / 60) * 100) / 100) };
  }
  return { mode: nextMode, amount };
}

function RateEditForm({
  label,
  currentRatePerMinute,
  institutions = [],
  institutionId = "",
  onInstitutionChange,
  showInstitution = true,
  onSave,
  onCancel,
  submitLabel = "단가 등록",
}) {
  const [inputMode, setInputMode] = useState("minute");
  const [amount, setAmount] = useState(() => {
    if (!currentRatePerMinute) return "";
    return String(currentRatePerMinute);
  });
  const [effectiveFrom, setEffectiveFrom] = useState(todayISO());
  const [localInstitutionId, setLocalInstitutionId] = useState(institutionId || "");
  const [saving, setSaving] = useState(false);

  const ratePerMinute = useMemo(() => {
    const n = Number(amount);
    if (!n || n <= 0) return 0;
    return inputMode === "hour" ? n / 60 : n;
  }, [amount, inputMode]);

  const selectedInstitutionId = onInstitutionChange ? institutionId : localInstitutionId;
  const setSelectedInstitutionId = onInstitutionChange || setLocalInstitutionId;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (ratePerMinute <= 0) return alert("단가를 입력해주세요.");
    setSaving(true);
    try {
      await onSave({
        rate_per_minute: Math.round(ratePerMinute * 100) / 100,
        effective_from: effectiveFrom,
        institution_id: selectedInstitutionId || null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="sch-rate-form" onSubmit={handleSubmit}>
      {label ? <h4 className="sch-rate-form-title">{label}</h4> : null}
      {showInstitution ? (
        <div className="sch-field">
          <span>적용 기관 (선택)</span>
          <InstitutionSearchSelect
            institutions={institutions}
            value={selectedInstitutionId || ""}
            onChange={id => setSelectedInstitutionId(id || "")}
            placeholder="비우면 전체 기관에 기본 단가"
          />
          <p className="sch-muted" style={{ marginTop: 6 }}>
            {selectedInstitutionId
              ? "선택한 기관 수업에만 이 단가가 적용됩니다. (기관별 단가 > 기본 단가)"
              : "기관을 지정하지 않으면 모든 기관에 기본 단가로 적용됩니다."}
          </p>
          {selectedInstitutionId ? (
            <button
              type="button"
              className="sch-btn sch-btn--ghost sch-btn--sm"
              style={{ marginTop: 6 }}
              onClick={() => setSelectedInstitutionId("")}
            >
              기관 선택 해제 (전체 적용)
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="sch-chip-row">
        <button
          type="button"
          className={`sch-chip${inputMode === "hour" ? " active" : ""}`}
          onClick={() => {
            const next = switchRateInputMode(inputMode, "hour", amount);
            setInputMode(next.mode);
            setAmount(next.amount);
          }}
        >
          시간당
        </button>
        <button
          type="button"
          className={`sch-chip${inputMode === "minute" ? " active" : ""}`}
          onClick={() => {
            const next = switchRateInputMode(inputMode, "minute", amount);
            setInputMode(next.mode);
            setAmount(next.amount);
          }}
        >
          분당
        </button>
      </div>
      <label className="sch-field">
        <span>{inputMode === "hour" ? "시간당 단가 (원)" : "분당 단가 (원)"}</span>
        <input
          type="number"
          inputMode="decimal"
          className="sch-input"
          min={0}
          step={inputMode === "hour" ? "100" : "1"}
          value={amount}
          onChange={e => setAmount(e.target.value)}
        />
      </label>
      {inputMode === "hour" && ratePerMinute > 0 ? (
        <p className="sch-muted">→ 분당 {ratePerMinute.toFixed(2)}원으로 저장</p>
      ) : inputMode === "minute" && ratePerMinute > 0 ? (
        <p className="sch-muted">→ 시간당 {Math.round(ratePerMinute * 60).toLocaleString("ko-KR")}원 · 30분 {formatWon(ratePerMinute * 30)}</p>
      ) : null}
      <label className="sch-field">
        <span>적용 시작일</span>
        <input
          type="date"
          className="sch-input"
          value={effectiveFrom}
          onChange={e => setEffectiveFrom(e.target.value)}
        />
      </label>
      <div className="sch-form-actions">
        <button type="button" className="sch-btn sch-btn--ghost" onClick={onCancel}>취소</button>
        <button type="submit" className="sch-btn sch-btn--primary" disabled={saving}>
          {saving ? "저장 중..." : submitLabel}
        </button>
      </div>
    </form>
  );
}

function uniformRatePerMinute(currentByType) {
  const rates = PAY_TYPES.map(t => currentByType[t]?.rate_per_minute).filter(v => v != null);
  if (!rates.length) return null;
  const first = rates[0];
  return rates.every(r => Math.abs(r - first) < 0.01) ? first : null;
}

function rateLabel(r, institutionsById) {
  if (!r?.institution_id) return "전체";
  return institutionsById[r.institution_id]?.name || "기관";
}

function TeacherRateCard({ teacher, currentRates, history, institutions, institutionsById, onSaved }) {
  const [expanded, setExpanded] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [editingInstitutionId, setEditingInstitutionId] = useState("");
  const [uniformMode, setUniformMode] = useState(false);
  const [addingInstitutionRate, setAddingInstitutionRate] = useState(false);

  const defaultRates = useMemo(
    () => (currentRates || []).filter(r => !r.institution_id),
    [currentRates],
  );
  const institutionRates = useMemo(
    () => (currentRates || [])
      .filter(r => r.institution_id)
      .sort((a, b) =>
        rateLabel(a, institutionsById).localeCompare(rateLabel(b, institutionsById), "ko")
        || a.pay_type.localeCompare(b.pay_type, "ko"),
      ),
    [currentRates, institutionsById],
  );

  const currentByType = useMemo(() => {
    const map = {};
    for (const r of defaultRates) map[r.pay_type] = r;
    return map;
  }, [defaultRates]);

  const sharedUniformRate = useMemo(
    () => uniformRatePerMinute(currentByType),
    [currentByType],
  );

  const historyByType = useMemo(() => {
    const map = {};
    for (const r of history) {
      if (!map[r.pay_type]) map[r.pay_type] = [];
      map[r.pay_type].push(r);
    }
    return map;
  }, [history]);

  const handleSave = async (payload) => {
    await insertPayRate({
      teacher_id: teacher.id,
      pay_type: payload.pay_type,
      rate_per_minute: payload.rate_per_minute,
      effective_from: payload.effective_from,
      institution_id: payload.institution_id || null,
    });
    setEditingType(null);
    setEditingInstitutionId("");
    setAddingInstitutionRate(false);
    await onSaved();
  };

  const handleBulkSave = async ({ rate_per_minute, effective_from }) => {
    await Promise.all(
      PAY_TYPES.map(payType =>
        insertPayRate({
          teacher_id: teacher.id,
          pay_type: payType,
          rate_per_minute,
          effective_from,
          institution_id: null,
        }),
      ),
    );
    await onSaved();
  };

  const unsetCount = PAY_TYPES.filter(t => !currentByType[t]).length;

  return (
    <div className="sch-rate-card">
      <button
        type="button"
        className="sch-rate-card-head"
        onClick={() => setExpanded(v => !v)}
      >
        <div>
          <strong>{teacher.name}</strong>
          {unsetCount > 0 ? (
            <span className="sch-alert-badge">미설정 {unsetCount}</span>
          ) : null}
          {institutionRates.length > 0 ? (
            <span className="sch-muted" style={{ marginLeft: 8, fontSize: 12 }}>
              기관별 {institutionRates.length}
            </span>
          ) : null}
        </div>
        {expanded ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
      </button>

      {expanded ? (
        <div className="sch-rate-card-body">
          <label className="sch-rate-uniform-toggle">
            <input
              type="checkbox"
              checked={uniformMode}
              onChange={e => {
                setUniformMode(e.target.checked);
                setEditingType(null);
                setAddingInstitutionRate(false);
              }}
            />
            <span>전체 유형 동일 금액으로 설정 (기본 단가)</span>
          </label>

          {uniformMode && !editingType ? (
            <div className="sch-rate-edit-panel sch-rate-edit-panel--uniform">
              <p className="sch-muted">
                입력한 단가가 {PAY_TYPES.join(", ")} 전체에 기본 단가로 적용됩니다.
              </p>
              <RateEditForm
                label="전체 유형 기본 단가"
                currentRatePerMinute={sharedUniformRate}
                showInstitution={false}
                onSave={handleBulkSave}
                onCancel={() => setUniformMode(false)}
                submitLabel="5개 유형 일괄 등록"
              />
            </div>
          ) : null}

          <h4 className="sch-rate-form-title" style={{ marginTop: 8 }}>기본 단가 (전체 기관)</h4>
          <table className="sch-table sch-table--compact">
            <thead>
              <tr>
                <th>유형</th>
                <th>시간당 단가</th>
                <th>적용일</th>
                <th/>
              </tr>
            </thead>
            <tbody>
              {PAY_TYPES.map(payType => {
                const cur = currentByType[payType];
                return (
                  <tr key={payType}>
                    <td>{payType}</td>
                    <td>
                      {cur ? (
                        <>
                          {formatWon(cur.rate_per_minute * 60)}/시간
                          <span className="sch-muted"> ({formatWon(cur.rate_per_minute)}/분)</span>
                        </>
                      ) : (
                        <span className="sch-muted">미설정</span>
                      )}
                    </td>
                    <td>{cur?.effective_from || "—"}</td>
                    <td>
                      <button
                        type="button"
                        className="sch-btn sch-btn--ghost sch-btn--sm"
                        onClick={() => {
                          setAddingInstitutionRate(false);
                          setEditingInstitutionId("");
                          setEditingType(editingType === payType && !editingInstitutionId ? null : payType);
                        }}
                      >
                        {cur ? "변경" : "입력"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {editingType && !editingInstitutionId && !addingInstitutionRate ? (
            <div className="sch-rate-edit-panel">
              <p className="sch-muted">기존 단가는 보존되며, 새 이력이 추가됩니다. 기관을 고르면 해당 기관 전용 단가가 됩니다.</p>
              <RateEditForm
                label={`${editingType} 단가 ${currentByType[editingType] ? "변경" : "등록"}`}
                currentRatePerMinute={currentByType[editingType]?.rate_per_minute}
                institutions={institutions}
                institutionId={editingInstitutionId}
                onInstitutionChange={setEditingInstitutionId}
                onSave={payload => handleSave({ pay_type: editingType, ...payload })}
                onCancel={() => {
                  setEditingType(null);
                  setEditingInstitutionId("");
                }}
              />
            </div>
          ) : null}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 16 }}>
            <h4 className="sch-rate-form-title" style={{ margin: 0 }}>기관별 단가</h4>
            <button
              type="button"
              className="sch-btn sch-btn--ghost sch-btn--sm"
              onClick={() => {
                setUniformMode(false);
                setEditingType(null);
                setEditingInstitutionId("");
                setAddingInstitutionRate(v => !v);
              }}
            >
              {addingInstitutionRate ? "취소" : "+ 기관별 단가 추가"}
            </button>
          </div>
          <p className="sch-muted" style={{ marginTop: 4 }}>
            특정 기관 수업에만 적용됩니다. 계산 시 기관별 단가가 기본 단가보다 우선합니다.
          </p>

          {addingInstitutionRate ? (
            <div className="sch-rate-edit-panel">
              <InstitutionRateAddForm
                institutions={institutions}
                onCancel={() => setAddingInstitutionRate(false)}
                onSave={async (payload) => {
                  await handleSave(payload);
                }}
              />
            </div>
          ) : null}

          {institutionRates.length === 0 && !addingInstitutionRate ? (
            <p className="sch-muted">등록된 기관별 단가가 없습니다.</p>
          ) : (
            <table className="sch-table sch-table--compact">
              <thead>
                <tr>
                  <th>기관</th>
                  <th>유형</th>
                  <th>분당</th>
                  <th>적용일</th>
                  <th/>
                </tr>
              </thead>
              <tbody>
                {institutionRates.map(r => (
                  <tr key={r.id}>
                    <td>{rateLabel(r, institutionsById)}</td>
                    <td>{r.pay_type}</td>
                    <td>
                      {formatWon(r.rate_per_minute)}/분
                      <span className="sch-muted"> ({formatWon(r.rate_per_minute * 60)}/시간)</span>
                    </td>
                    <td>{r.effective_from}</td>
                    <td>
                      <button
                        type="button"
                        className="sch-btn sch-btn--ghost sch-btn--sm"
                        onClick={() => {
                          setAddingInstitutionRate(false);
                          setEditingType(r.pay_type);
                          setEditingInstitutionId(r.institution_id);
                        }}
                      >
                        변경
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {editingType && editingInstitutionId && !addingInstitutionRate ? (
            <div className="sch-rate-edit-panel">
              <RateEditForm
                label={`${rateLabel({ institution_id: editingInstitutionId }, institutionsById)} · ${editingType} 변경`}
                currentRatePerMinute={
                  institutionRates.find(
                    r => r.pay_type === editingType && r.institution_id === editingInstitutionId,
                  )?.rate_per_minute
                }
                institutions={institutions}
                institutionId={editingInstitutionId}
                onInstitutionChange={setEditingInstitutionId}
                onSave={payload => handleSave({ pay_type: editingType, ...payload })}
                onCancel={() => {
                  setEditingType(null);
                  setEditingInstitutionId("");
                }}
              />
            </div>
          ) : null}

          <button
            type="button"
            className="sch-btn sch-btn--ghost"
            onClick={() => setHistoryOpen(v => !v)}
          >
            <History size={14}/> 이력 보기 {historyOpen ? "접기" : ""}
          </button>

          {historyOpen ? (
            <div className="sch-rate-history">
              {PAY_TYPES.map(payType => {
                const rows = historyByType[payType] || [];
                if (!rows.length) return null;
                return (
                  <div key={payType} className="sch-rate-history-group">
                    <h5>{payType}</h5>
                    <ul>
                      {rows.map(r => (
                        <li key={r.id}>
                          [{rateLabel(r, institutionsById)}] {r.effective_from} · {formatWon(r.rate_per_minute * 60)}/시간
                          <span className="sch-muted"> ({formatWon(r.rate_per_minute)}/분)</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function InstitutionRateAddForm({ institutions, onSave, onCancel }) {
  const [payType, setPayType] = useState("방과후");
  const [institutionId, setInstitutionId] = useState("");
  const [inputMode, setInputMode] = useState("minute");
  const [amount, setAmount] = useState("1000");
  const [effectiveFrom, setEffectiveFrom] = useState(todayISO());
  const [saving, setSaving] = useState(false);

  const ratePerMinute = useMemo(() => {
    const n = Number(amount);
    if (!n || n <= 0) return 0;
    return inputMode === "hour" ? n / 60 : n;
  }, [amount, inputMode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!institutionId) return alert("기관을 선택해 주세요.");
    if (ratePerMinute <= 0) return alert("단가를 입력해주세요.");
    setSaving(true);
    try {
      await onSave({
        pay_type: payType,
        institution_id: institutionId,
        rate_per_minute: Math.round(ratePerMinute * 100) / 100,
        effective_from: effectiveFrom,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="sch-rate-form" onSubmit={handleSubmit}>
      <h4 className="sch-rate-form-title">기관별 단가 등록</h4>
      <div className="sch-field">
        <span>기관 *</span>
        <InstitutionSearchSelect
          institutions={institutions}
          value={institutionId}
          onChange={setInstitutionId}
          placeholder="기관 이름 검색 (예: 어린이집)"
        />
      </div>
      <label className="sch-field">
        <span>수업 유형 *</span>
        <select className="sch-input" value={payType} onChange={e => setPayType(e.target.value)}>
          {PAY_TYPES.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </label>
      <div className="sch-chip-row">
        <button
          type="button"
          className={`sch-chip${inputMode === "hour" ? " active" : ""}`}
          onClick={() => {
            const next = switchRateInputMode(inputMode, "hour", amount);
            setInputMode(next.mode);
            setAmount(next.amount);
          }}
        >
          시간당
        </button>
        <button
          type="button"
          className={`sch-chip${inputMode === "minute" ? " active" : ""}`}
          onClick={() => {
            const next = switchRateInputMode(inputMode, "minute", amount);
            setInputMode(next.mode);
            setAmount(next.amount);
          }}
        >
          분당
        </button>
      </div>
      <label className="sch-field">
        <span>{inputMode === "hour" ? "시간당 단가 (원)" : "분당 단가 (원)"}</span>
        <input
          type="number"
          inputMode="decimal"
          className="sch-input"
          min={0}
          step={inputMode === "hour" ? "100" : "1"}
          value={amount}
          onChange={e => setAmount(e.target.value)}
        />
      </label>
      {ratePerMinute > 0 ? (
        <p className="sch-muted">
          30분 = {formatWon(ratePerMinute * 30)} · 시간당 {formatWon(ratePerMinute * 60)}
        </p>
      ) : null}
      <label className="sch-field">
        <span>적용 시작일</span>
        <input
          type="date"
          className="sch-input"
          value={effectiveFrom}
          onChange={e => setEffectiveFrom(e.target.value)}
        />
      </label>
      <div className="sch-form-actions">
        <button type="button" className="sch-btn sch-btn--ghost" onClick={onCancel}>취소</button>
        <button type="submit" className="sch-btn sch-btn--primary" disabled={saving}>
          {saving ? "저장 중..." : "단가 등록"}
        </button>
      </div>
    </form>
  );
}

export default function TeacherPayRatesView({ onBack }) {
  const [teachers, setTeachers] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [allHistory, setAllHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ts, inst, history] = await Promise.all([
        fetchTeachers(),
        fetchInstitutions({ activeOnly: false }),
        fetchPayRates(),
      ]);
      setTeachers(ts.filter(t => t.role === "teacher"));
      setInstitutions(inst);
      setAllHistory(history);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const currentRates = useMemo(
    () => getCurrentRatesFromHistory(allHistory),
    [allHistory],
  );

  const institutionsById = useMemo(() => {
    const map = {};
    for (const i of institutions) map[i.id] = i;
    return map;
  }, [institutions]);

  const filteredTeachers = useMemo(() => {
    if (!filter.trim()) return teachers;
    const q = filter.trim().toLowerCase();
    return teachers.filter(t => t.name.toLowerCase().includes(q));
  }, [teachers, filter]);

  const ratesByTeacher = useMemo(() => {
    const cur = {};
    const hist = {};
    for (const r of currentRates) {
      if (!cur[r.teacher_id]) cur[r.teacher_id] = [];
      cur[r.teacher_id].push(r);
    }
    for (const r of allHistory) {
      if (!hist[r.teacher_id]) hist[r.teacher_id] = [];
      hist[r.teacher_id].push(r);
    }
    return { cur, hist };
  }, [currentRates, allHistory]);

  return (
    <div className="sch-view">
      <header className="sch-view-header">
        <button type="button" className="sch-back-btn" onClick={onBack}>
          <ChevronLeft size={18}/> 급여/정산
        </button>
        <h2 className="sch-view-title">강사 단가 관리</h2>
      </header>

      <p className="sch-muted">
        단가 변경 시 기존 데이터는 수정하지 않고 새 이력이 추가됩니다.
        기관별 단가가 있으면 해당 기관 수업에 우선 적용하고, 없으면 기본 단가(전체)를 사용합니다.
      </p>

      <div className="sch-toolbar">
        <input
          className="sch-input"
          placeholder="강사 이름 검색"
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="sch-muted">불러오는 중...</p>
      ) : (
        <div className="sch-rate-list">
          {filteredTeachers.map(t => (
            <TeacherRateCard
              key={t.id}
              teacher={t}
              currentRates={ratesByTeacher.cur[t.id] || []}
              history={ratesByTeacher.hist[t.id] || []}
              institutions={institutions}
              institutionsById={institutionsById}
              onSaved={load}
            />
          ))}
        </div>
      )}
    </div>
  );
}
