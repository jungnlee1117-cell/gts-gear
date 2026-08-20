import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  RATE_PRESETS,
  RATE_UNIT_CODES,
  RATE_UNITS,
  buildContractDocument,
  defaultCoreRates,
  formatResidentFront,
  validateContractIssueInput,
} from "../supabase/functions/teacher-hr/contractTemplate.js";
import FormField, { ProfileGrid } from "./MyProfileFormField.jsx";
import { invokeTeacherHr, TeacherHrError } from "./teacherHr.js";

function formatAmountInput(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("ko-KR");
}

function extraPresets(rates) {
  const used = new Set(rates.map((r) => r.rate_type).filter((t) => t !== "custom"));
  return RATE_PRESETS.filter((p) => !p.core && (p.rate_type === "custom" || !used.has(p.rate_type)));
}

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function ContractIssueModal({
  supabase,
  teacherId,
  teacherName,
  teacherPhone,
  teacherContractType,
  onClose,
  onIssued,
}) {
  const [step, setStep] = useState("form");
  const [context, setContext] = useState({
    teacher_name: teacherName || "",
    teacher_phone: teacherPhone || "",
    contract_type: teacherContractType || "위탁계약",
    resident_id_front: "",
    resident_number_front: formatResidentFront(""),
  });
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [contractDate, setContractDate] = useState(todayYmd);
  const [rates, setRates] = useState(defaultCoreRates);
  const [addType, setAddType] = useState("event");
  const [error, setError] = useState("");
  const [issuing, setIssuing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    invokeTeacherHr(supabase, "get_contract_issue_context", { teacher_id: teacherId })
      .then((data) => {
        if (cancelled || !data) return;
        setContext({
          teacher_name: data.teacher_name || teacherName || "",
          teacher_phone: data.teacher_phone || teacherPhone || "",
          contract_type: data.contract_type || teacherContractType || "위탁계약",
          resident_id_front: data.resident_id_front || "",
          resident_number_front: data.resident_number_front || formatResidentFront(data.resident_id_front),
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [supabase, teacherId, teacherName, teacherPhone, teacherContractType]);

  const extras = extraPresets(rates);
  const selectedAdd = RATE_PRESETS.find((p) => p.rate_type === addType) || extras[0];

  const preview = useMemo(() => {
    if (step !== "preview") return null;
    try {
      return buildContractDocument({
        teacherName: context.teacher_name,
        teacherPhone: context.teacher_phone,
        residentFront: context.resident_id_front,
        contractType: context.contract_type,
        startDate,
        endDate,
        contractDate,
        rates,
      });
    } catch {
      return null;
    }
  }, [step, context, startDate, endDate, contractDate, rates]);

  const setRate = (idx, patch) => {
    setRates((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
    setError("");
  };

  const addRate = () => {
    const preset = RATE_PRESETS.find((p) => p.rate_type === addType) || RATE_PRESETS.find((p) => p.rate_type === "custom");
    setRates((prev) => [
      ...prev,
      {
        rate_type: preset.rate_type,
        rate_name: preset.customName ? "" : preset.rate_name,
        amount: "",
        unit: preset.unit,
      },
    ]);
    const next = extraPresets([...rates, { rate_type: preset.rate_type }]);
    setAddType(next[0]?.rate_type || "custom");
  };

  const goPreview = () => {
    setError("");
    try {
      validateContractIssueInput({
        teacherName: context.teacher_name,
        teacherPhone: context.teacher_phone,
        residentFront: context.resident_id_front,
        contractType: context.contract_type,
        startDate,
        endDate,
        contractDate,
        rates,
      });
      setStep("preview");
    } catch (err) {
      setError(err.message || "입력값을 확인해 주세요.");
    }
  };

  const issue = async () => {
    setError("");
    setIssuing(true);
    try {
      await invokeTeacherHr(supabase, "issue_contract", {
        teacher_id: teacherId,
        start_date: startDate,
        end_date: endDate,
        contract_date: contractDate,
        rates,
      });
      onIssued?.();
    } catch (err) {
      setError(err instanceof TeacherHrError ? err.message : (err.message || "발행에 실패했습니다."));
    } finally {
      setIssuing(false);
    }
  };

  return (
    <div className="sch-modal-overlay" onClick={() => !issuing && onClose()}>
      <div className="sch-modal sch-modal--wide my-profile-issue-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sch-modal-head">
          <h3>{step === "preview" ? "계약서 미리보기" : "계약서 발행"}</h3>
          <button type="button" className="sch-icon-btn" onClick={onClose} disabled={issuing}>닫기</button>
        </div>

        {step === "form" ? (
          <>
            <h4 className="my-profile-rates-title">계약정보</h4>
            <ProfileGrid>
              <FormField label="성명">
                <div className="my-profile-value">{context.teacher_name || "—"}</div>
              </FormField>
              <FormField label="연락처">
                <div className="my-profile-value">{context.teacher_phone || "—"}</div>
              </FormField>
              <FormField label="주민등록번호">
                <div className="my-profile-value">{context.resident_number_front}</div>
              </FormField>
              <FormField label="계약 형태">
                <div className="my-profile-value">{context.contract_type || "위탁계약"}</div>
              </FormField>
              <FormField label="계약 시작일">
                <input type="date" className="my-profile-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </FormField>
              <FormField label="계약 종료일">
                <input type="date" className="my-profile-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </FormField>
              <FormField label="계약일">
                <input type="date" className="my-profile-input" value={contractDate} onChange={(e) => setContractDate(e.target.value)} />
              </FormField>
            </ProfileGrid>

            <h4 className="my-profile-rates-title">급여 조건</h4>
            <div className="my-profile-rate-list">
              {rates.map((row, idx) => {
                const core = row.rate_type === "regular" || row.rate_type === "after_school";
                const custom = row.rate_type === "custom";
                return (
                  <div key={`${row.rate_type}-${idx}`} className="my-profile-rate-row">
                    <label className="my-profile-field">
                      <span>항목명</span>
                      {custom ? (
                        <input
                          className="my-profile-input"
                          value={row.rate_name}
                          onChange={(e) => setRate(idx, { rate_name: e.target.value })}
                          placeholder="직접 입력"
                        />
                      ) : (
                        <input className="my-profile-input" value={row.rate_name} readOnly />
                      )}
                    </label>
                    <label className="my-profile-field">
                      <span>금액</span>
                      <div className="my-profile-rate-amount">
                        <input
                          className="my-profile-input"
                          inputMode="numeric"
                          value={row.amount}
                          onChange={(e) => setRate(idx, { amount: formatAmountInput(e.target.value) })}
                          placeholder="75,000"
                        />
                        <span>원</span>
                      </div>
                    </label>
                    <label className="my-profile-field">
                      <span>단위</span>
                      {core ? (
                        <input className="my-profile-input" value="시간" readOnly />
                      ) : (
                        <select className="my-profile-input" value={row.unit} onChange={(e) => setRate(idx, { unit: e.target.value })}>
                          {RATE_UNITS.map((u) => (
                            <option key={u} value={u}>{RATE_UNIT_CODES[u].label}</option>
                          ))}
                        </select>
                      )}
                    </label>
                    {core ? (
                      <span className="my-profile-rate-spacer" />
                    ) : (
                      <button type="button" className="my-profile-btn-ghost my-profile-btn-ghost--sm" onClick={() => setRates((prev) => prev.filter((_, i) => i !== idx))}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="my-profile-rate-add">
              <select className="my-profile-input" value={selectedAdd?.rate_type || "custom"} onChange={(e) => setAddType(e.target.value)}>
                {extras.map((p) => (
                  <option key={p.rate_type} value={p.rate_type}>{p.rate_name}</option>
                ))}
              </select>
              <button type="button" className="my-profile-btn-ghost" onClick={addRate}>
                <Plus size={14} /> 추가 급여 항목
              </button>
            </div>
            {error ? <p className="my-profile-field-error">{error}</p> : null}
            <div className="my-profile-actions">
              <button type="button" className="my-profile-btn-ghost" onClick={onClose}>취소</button>
              <button type="button" className="my-profile-save" onClick={goPreview}>계약서 미리보기</button>
            </div>
          </>
        ) : (
          <>
            {preview ? (
              <div className="my-profile-contract-preview">
                <h4>{preview.title}</h4>
                {preview.sections.map((section, idx) => (
                  <div key={section.heading || `intro-${idx}`}>
                    {section.heading ? <strong>{section.heading}</strong> : null}
                    {section.paragraphs.map((p) => (
                      <p key={p}>{p}</p>
                    ))}
                  </div>
                ))}
                <strong>{preview.signatureBlock.heading}</strong>
                {preview.signatureBlock.lines.map((line, idx) => (
                  <p key={`${line}-${idx}`}>{line || " "}</p>
                ))}
              </div>
            ) : (
              <p className="my-profile-empty">미리보기를 만들 수 없습니다.</p>
            )}
            {error ? <p className="my-profile-field-error">{error}</p> : null}
            <div className="my-profile-actions">
              <button type="button" className="my-profile-btn-ghost" onClick={() => setStep("form")} disabled={issuing}>수정하기</button>
              <button type="button" className="my-profile-save" onClick={issue} disabled={issuing || !preview}>
                {issuing ? "발행 중..." : "선생님에게 계약서 발행"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
