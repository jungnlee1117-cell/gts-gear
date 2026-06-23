import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronUp, History } from "lucide-react";
import { PAY_TYPES, formatWon } from "./constants.js";
import {
  fetchCurrentPayRates,
  fetchPayRates,
  fetchTeachers,
  insertPayRate,
} from "./api.js";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
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

function RateEditForm({ label, currentRatePerMinute, onSave, onCancel, submitLabel = "단가 등록" }) {
  const [inputMode, setInputMode] = useState("hour");
  const [amount, setAmount] = useState(() => {
    if (!currentRatePerMinute) return "";
    return String(Math.round(currentRatePerMinute * 60));
  });
  const [effectiveFrom, setEffectiveFrom] = useState(todayISO());
  const [saving, setSaving] = useState(false);

  const ratePerMinute = useMemo(() => {
    const n = Number(amount);
    if (!n || n <= 0) return 0;
    return inputMode === "hour" ? n / 60 : n;
  }, [amount, inputMode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (ratePerMinute <= 0) return alert("단가를 입력해주세요.");
    setSaving(true);
    try {
      await onSave({
        rate_per_minute: Math.round(ratePerMinute * 100) / 100,
        effective_from: effectiveFrom,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="sch-rate-form" onSubmit={handleSubmit}>
      {label ? <h4 className="sch-rate-form-title">{label}</h4> : null}
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
        <p className="sch-muted">→ 시간당 {Math.round(ratePerMinute * 60).toLocaleString("ko-KR")}원</p>
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

function TeacherRateCard({ teacher, currentRates, history, onSaved }) {
  const [expanded, setExpanded] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [uniformMode, setUniformMode] = useState(false);

  const currentByType = useMemo(() => {
    const map = {};
    for (const r of currentRates) map[r.pay_type] = r;
    return map;
  }, [currentRates]);

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
    await insertPayRate({ teacher_id: teacher.id, ...payload });
    setEditingType(null);
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
              }}
            />
            <span>전체 유형 동일 금액으로 설정</span>
          </label>

          {uniformMode && !editingType ? (
            <div className="sch-rate-edit-panel sch-rate-edit-panel--uniform">
              <p className="sch-muted">
                입력한 단가가 {PAY_TYPES.join(", ")} 전체에 적용됩니다. 유형별로 다르게 두려면 토글을 끄거나 아래에서 개별 변경하세요.
              </p>
              <RateEditForm
                label="전체 유형 단가"
                currentRatePerMinute={sharedUniformRate}
                onSave={handleBulkSave}
                onCancel={() => setUniformMode(false)}
                submitLabel="5개 유형 일괄 등록"
              />
            </div>
          ) : null}

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
                          setEditingType(editingType === payType ? null : payType);
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

          {editingType ? (
            <div className="sch-rate-edit-panel">
              <p className="sch-muted">기존 단가는 보존되며, 새 이력이 추가됩니다.</p>
              <RateEditForm
                label={`${editingType} 단가 ${currentByType[editingType] ? "변경" : "등록"}`}
                currentRatePerMinute={currentByType[editingType]?.rate_per_minute}
                onSave={payload => handleSave({ pay_type: editingType, ...payload })}
                onCancel={() => setEditingType(null)}
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
                          {r.effective_from} · {formatWon(r.rate_per_minute * 60)}/시간
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

export default function TeacherPayRatesView({ onBack }) {
  const [teachers, setTeachers] = useState([]);
  const [currentRates, setCurrentRates] = useState([]);
  const [allHistory, setAllHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ts, current, history] = await Promise.all([
        fetchTeachers(),
        fetchCurrentPayRates(),
        fetchPayRates(),
      ]);
      setTeachers(ts.filter(t => t.role === "teacher"));
      setCurrentRates(current);
      setAllHistory(history);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

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
        단가 변경 시 기존 데이터는 수정하지 않고 새 이력이 추가됩니다. 급여 계산은 각 수업일 기준 유효 단가를 사용합니다.
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
              onSaved={load}
            />
          ))}
        </div>
      )}
    </div>
  );
}
