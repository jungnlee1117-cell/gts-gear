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
import { formatStoredRate, revenueShareListLabel } from "./payRateLabel.js";
import { isAssignableClassTeacher } from "./roles.js";

// 참관수업은 누구나 회당 15,000원 고정이므로 단가 등록 대상에서 제외합니다.
const RATE_PAY_TYPES = PAY_TYPES.filter(type => type !== "참관수업");

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
  if (!n || n <= 0 || currentMode === nextMode) return { mode: nextMode, amount };
  if (currentMode === "session" || nextMode === "session") {
    return { mode: nextMode, amount };
  }
  if (currentMode === "minute" && nextMode === "hour") {
    return { mode: nextMode, amount: String(Math.round(n * 60)) };
  }
  if (currentMode === "hour" && nextMode === "minute") {
    return { mode: nextMode, amount: String(Math.round((n / 60) * 100) / 100) };
  }
  return { mode: nextMode, amount };
}

function initialRateInput(rate) {
  if (rate?.rate_unit === "session" && Number(rate.rate_per_session) > 0) {
    return { mode: "session", amount: String(Math.round(Number(rate.rate_per_session))) };
  }
  if (rate?.rate_per_minute) {
    return { mode: "minute", amount: String(rate.rate_per_minute) };
  }
  return { mode: "minute", amount: "" };
}

function buildRateSaveFields(inputMode, amount) {
  const n = Number(amount);
  if (inputMode === "session") {
    const session = Math.round(n);
    if (!session || session <= 0) return null;
    return { rate_unit: "session", rate_per_session: session, rate_per_minute: 0 };
  }
  const perMinute = inputMode === "hour" ? n / 60 : n;
  const rounded = Math.round(perMinute * 100) / 100;
  if (!rounded || rounded <= 0) return null;
  return { rate_unit: "minute", rate_per_session: null, rate_per_minute: rounded };
}

function rateAmountLabel(inputMode) {
  if (inputMode === "hour") return "시간당 단가 (원)";
  if (inputMode === "session") return "회당 단가 (원)";
  return "분당 단가 (원)";
}

function RateUnitChips({ inputMode, amount, onChange }) {
  const choose = (nextMode) => {
    const next = switchRateInputMode(inputMode, nextMode, amount);
    onChange(next);
  };
  return (
    <div className="sch-chip-row">
      {[
        ["hour", "시간당"],
        ["minute", "분당"],
        ["session", "회당"],
      ].map(([mode, label]) => (
        <button
          key={mode}
          type="button"
          className={`sch-chip${inputMode === mode ? " active" : ""}`}
          onClick={() => choose(mode)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function storedRateText(rate) {
  return formatStoredRate(rate, formatWon);
}

function RateEditForm({
  label,
  currentRate = null,
  institutions = [],
  institutionId = "",
  onInstitutionChange,
  showInstitution = true,
  onSave,
  onCancel,
  submitLabel = "단가 등록",
}) {
  const initial = initialRateInput(currentRate);
  const [inputMode, setInputMode] = useState(initial.mode);
  const [amount, setAmount] = useState(initial.amount);
  const [effectiveFrom, setEffectiveFrom] = useState(todayISO());
  const [localInstitutionId, setLocalInstitutionId] = useState(institutionId || "");
  const [saving, setSaving] = useState(false);

  const saveFields = useMemo(
    () => buildRateSaveFields(inputMode, amount),
    [amount, inputMode],
  );

  const selectedInstitutionId = onInstitutionChange ? institutionId : localInstitutionId;
  const setSelectedInstitutionId = onInstitutionChange || setLocalInstitutionId;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!saveFields) return alert("단가를 입력해주세요.");
    setSaving(true);
    try {
      await onSave({
        ...saveFields,
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
      {currentRate?.rate_unit === "revenue_share" ? (
        <p className="sch-muted">현재 단가: {storedRateText(currentRate)}. 새 단가를 등록하면 이 날짜부터 그 단가로 바뀝니다.</p>
      ) : null}
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
      <RateUnitChips
        inputMode={inputMode}
        amount={amount}
        onChange={(next) => {
          setInputMode(next.mode);
          setAmount(next.amount);
        }}
      />
      <label className="sch-field">
        <span>{rateAmountLabel(inputMode)}</span>
        <input
          type="number"
          inputMode="decimal"
          className="sch-input"
          min={0}
          step={inputMode === "minute" ? "1" : "100"}
          value={amount}
          onChange={e => setAmount(e.target.value)}
        />
      </label>
      {inputMode === "hour" && saveFields ? (
        <p className="sch-muted">→ 분당 {saveFields.rate_per_minute.toFixed(2)}원으로 저장</p>
      ) : inputMode === "minute" && saveFields ? (
        <p className="sch-muted">→ 시간당 {Math.round(saveFields.rate_per_minute * 60).toLocaleString("ko-KR")}원 · 30분 {formatWon(saveFields.rate_per_minute * 30)}</p>
      ) : inputMode === "session" && saveFields ? (
        <p className="sch-muted">→ 수업 1회마다 {formatWon(saveFields.rate_per_session)}. 수업 시간과 관계없습니다.</p>
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

function sharedCurrentRate(currentByType) {
  const rows = RATE_PAY_TYPES.map(t => currentByType[t]).filter(Boolean);
  if (!rows.length) return null;
  const first = rows[0];
  const same = rows.every((row) => {
    if ((row.rate_unit || "minute") !== (first.rate_unit || "minute")) return false;
    if ((row.rate_unit || "minute") === "session") {
      return Number(row.rate_per_session) === Number(first.rate_per_session);
    }
    if (row.rate_unit === "revenue_share") {
      return Number(row.share_ratio) === Number(first.share_ratio);
    }
    return Math.abs(Number(row.rate_per_minute) - Number(first.rate_per_minute)) < 0.01;
  });
  return same ? first : null;
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
    () => sharedCurrentRate(currentByType),
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
      rate_unit: payload.rate_unit || "minute",
      rate_per_session: payload.rate_unit === "session" ? payload.rate_per_session : null,
      effective_from: payload.effective_from,
      institution_id: payload.institution_id || null,
    });
    setEditingType(null);
    setEditingInstitutionId("");
    setAddingInstitutionRate(false);
    await onSaved();
  };

  const handleBulkSave = async (payload) => {
    await Promise.all(
      RATE_PAY_TYPES.map(payType =>
        insertPayRate({
          teacher_id: teacher.id,
          pay_type: payType,
          rate_per_minute: payload.rate_per_minute,
          rate_unit: payload.rate_unit || "minute",
          rate_per_session: payload.rate_unit === "session" ? payload.rate_per_session : null,
          effective_from: payload.effective_from,
          institution_id: null,
        }),
      ),
    );
    await onSaved();
  };

  const unsetCount = RATE_PAY_TYPES.filter(t => !currentByType[t]).length;
  const shareLabel = revenueShareListLabel(defaultRates);

  return (
    <div className="sch-rate-card">
      <button
        type="button"
        className="sch-rate-card-head"
        onClick={() => setExpanded(v => !v)}
      >
        <div>
          <strong>{teacher.name}</strong>
          {shareLabel ? (
            <span className="sch-muted" style={{ marginLeft: 8, fontSize: 12 }}>
              {shareLabel}
            </span>
          ) : null}
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
                입력한 단가가 {RATE_PAY_TYPES.join(", ")} 전체에 기본 단가로 적용됩니다. 참관수업은 회당 15,000원으로 자동 계산됩니다.
              </p>
              <RateEditForm
                label="전체 유형 기본 단가"
                currentRate={sharedUniformRate}
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
                <th>단가</th>
                <th>적용일</th>
                <th/>
              </tr>
            </thead>
            <tbody>
              {RATE_PAY_TYPES.map(payType => {
                const cur = currentByType[payType];
                return (
                  <tr key={payType}>
                    <td>{payType}</td>
                    <td>
                      {cur ? (
                        storedRateText(cur)
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
                currentRate={currentByType[editingType]}
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
                  <th>단가</th>
                  <th>적용일</th>
                  <th/>
                </tr>
              </thead>
              <tbody>
                {institutionRates.map(r => (
                  <tr key={r.id}>
                    <td>{rateLabel(r, institutionsById)}</td>
                    <td>{r.pay_type}</td>
                    <td>{storedRateText(r)}</td>
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
                currentRate={institutionRates.find(
                  r => r.pay_type === editingType && r.institution_id === editingInstitutionId,
                )}
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
              {RATE_PAY_TYPES.map(payType => {
                const rows = historyByType[payType] || [];
                if (!rows.length) return null;
                return (
                  <div key={payType} className="sch-rate-history-group">
                    <h5>{payType}</h5>
                    <ul>
                      {rows.map(r => (
                        <li key={r.id}>
                          [{rateLabel(r, institutionsById)}] {r.effective_from} · {storedRateText(r)}
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

  const saveFields = useMemo(
    () => buildRateSaveFields(inputMode, amount),
    [amount, inputMode],
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!institutionId) return alert("기관을 선택해 주세요.");
    if (!saveFields) return alert("단가를 입력해주세요.");
    setSaving(true);
    try {
      await onSave({
        pay_type: payType,
        institution_id: institutionId,
        ...saveFields,
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
          {RATE_PAY_TYPES.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </label>
      <RateUnitChips
        inputMode={inputMode}
        amount={amount}
        onChange={(next) => {
          setInputMode(next.mode);
          setAmount(next.amount);
        }}
      />
      <label className="sch-field">
        <span>{rateAmountLabel(inputMode)}</span>
        <input
          type="number"
          inputMode="decimal"
          className="sch-input"
          min={0}
          step={inputMode === "minute" ? "1" : "100"}
          value={amount}
          onChange={e => setAmount(e.target.value)}
        />
      </label>
      {inputMode === "session" && saveFields ? (
        <p className="sch-muted">수업 1회마다 {formatWon(saveFields.rate_per_session)}. 수업 시간과 관계없습니다.</p>
      ) : saveFields?.rate_unit === "minute" ? (
        <p className="sch-muted">
          30분 = {formatWon(saveFields.rate_per_minute * 30)} · 시간당 {formatWon(saveFields.rate_per_minute * 60)}
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
        fetchTeachers({ allowBeforeHire: true }),
        fetchInstitutions({ activeOnly: false }),
        fetchPayRates(),
      ]);
      setTeachers(ts.filter(isAssignableClassTeacher));
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
