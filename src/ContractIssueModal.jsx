import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  contractEndDate,
  contractParagraphEditKey,
  EDITABLE_CONTRACT_SECTIONS,
  RATE_PRESETS,
  RATE_UNIT_CODES,
  RATE_UNITS,
  defaultCoreRates,
  formatResidentFront,
  validateContractIssueInput,
} from "../supabase/functions/teacher-hr/contractFields.js";
import ContractPdfActions from "./ContractPdfActions.jsx";
import "./contract-design.css";
import FormField, { ProfileGrid } from "./MyProfileFormField.jsx";
import { invokeTeacherHr, TeacherHrError } from "./teacherHr.js";

function formatAmountInput(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("ko-KR");
}

function extraPresets(rates) {
  const used = new Set(rates.map((r) => r.rate_type).filter((t) => t !== "custom"));
  return RATE_PRESETS.filter((p) => p.rate_type !== "after_school" && (p.rate_type === "custom" || !used.has(p.rate_type)));
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
  const [contractYears, setContractYears] = useState(1);
  const endDate = contractEndDate(startDate, contractYears);
  const [sectionEdits, setSectionEdits] = useState({});
  const [pdfPreview, setPdfPreview] = useState(null);
  const [renderingPdf, setRenderingPdf] = useState(false);
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

  useEffect(() => {
    setPdfPreview(null);
  }, [startDate, contractYears, contractDate, rates, sectionEdits, context]);
  useEffect(() => () => { if (pdfPreview?.url) URL.revokeObjectURL(pdfPreview.url); }, [pdfPreview]);

  const contractPayload = () => ({
    teacher_id: teacherId, start_date: startDate, end_date: endDate,
    contract_date: contractDate, contract_years: contractYears, rates, section_edits: sectionEdits,
  });
  const renderPdf = async () => {
    setRenderingPdf(true);
    setError("");
    setPdfPreview(null);
    try {
      const data = await invokeTeacherHr(supabase, "preview_contract", contractPayload());
      const bytes = Uint8Array.from(atob(data.pdf_base64), c => c.charCodeAt(0));
      setPdfPreview({ url: URL.createObjectURL(new Blob([bytes], { type: "application/pdf" })), filename: data.file_name });
    } catch (err) { setError(err.message || "PDF 미리보기를 만들지 못했습니다."); }
    finally { setRenderingPdf(false); }
  };

  const extras = extraPresets(rates);
  const selectedAdd = RATE_PRESETS.find((p) => p.rate_type === addType) || extras[0];

  const [preview, setPreview] = useState(null);
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

  const goPreview = async () => {
    setRenderingPdf(true);
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
        contractYears,
      });
      const document = await invokeTeacherHr(supabase, "preview_contract_document", { ...contractPayload(), section_edits: {} });
      setPreview(document);
      setStep("preview");
    } catch (err) {
      setError(err.message || "입력값을 확인해 주세요.");
    } finally { setRenderingPdf(false); }
  };

  const issue = async () => {
    setError("");
    setIssuing(true);
    try {
      if (!pdfPreview) throw new Error("발송 전 PDF 미리보기를 확인해 주세요.");
      await invokeTeacherHr(supabase, "issue_contract", contractPayload());
      onIssued?.();
    } catch (err) {
      setError(err instanceof TeacherHrError ? err.message : (err.message || "발행에 실패했습니다."));
    } finally {
      setIssuing(false);
    }
  };

  return (
    <div className="sch-modal-overlay" onClick={() => !issuing && !renderingPdf && onClose()}>
      <div className="sch-modal sch-modal--wide my-profile-issue-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sch-modal-head">
          <h3>{step === "preview" ? "계약서 미리보기" : "계약서 발행"}</h3>
          <button type="button" className="sch-icon-btn" onClick={onClose} disabled={issuing || renderingPdf}>닫기</button>
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
                <input type="date" className="my-profile-input" aria-label="계약 시작일" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </FormField>
              <FormField label="계약 기간 (1년 단위)">
                <select className="my-profile-input" aria-label="계약 기간 (1년 단위)" value={contractYears} onChange={e => setContractYears(Number(e.target.value))}>
                  {[1, 2, 3, 4, 5].map(years => <option key={years} value={years}>{years}년</option>)}
                </select>
              </FormField>
              <FormField label="계약 종료일 (자동 계산)">
                <input type="date" className="my-profile-input" aria-label="계약 종료일" value={endDate} readOnly />
              </FormField>
              <FormField label="계약일">
                <input type="date" className="my-profile-input" aria-label="계약일" value={contractDate} onChange={(e) => setContractDate(e.target.value)} />
              </FormField>
            </ProfileGrid>

            <h4 className="my-profile-rates-title">급여 조건</h4>
            <p className="my-profile-hint">정규수업이 없는 계약은 정규수업 항목을 삭제해 주세요.</p>
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
                    {row.rate_type === "after_school" ? (
                      <span className="my-profile-rate-spacer" />
                    ) : (
                      <button type="button" className="my-profile-btn-ghost my-profile-btn-ghost--sm" aria-label={`${row.rate_name} 삭제`} onClick={() => setRates((prev) => prev.filter((_, i) => i !== idx))}>
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
              <button type="button" className="my-profile-save" onClick={goPreview} disabled={renderingPdf}>{renderingPdf ? "불러오는 중..." : "계약서 미리보기"}</button>
            </div>
          </>
        ) : (
          <>
            {preview ? (
              <div className="my-profile-contract-preview">
                <h4>{preview.title}</h4>
                <p className="my-profile-hint">조항의 문구를 아래에서 수정할 수 있습니다. 이름·계약기간·금액은 ‘계약정보 수정’에서 변경해 주세요. PDF 미리보기에 로고와 회사 도장이 포함됩니다.</p>
                {preview.sections.map((section, idx) => (
                  <div key={section.heading || `intro-${idx}`}>
                    {section.heading ? <strong>{section.heading}</strong> : null}
                    {EDITABLE_CONTRACT_SECTIONS.includes(idx) ? (
                      <textarea className="gts-contract-clause-editor" aria-label={`${section.heading} 내용 수정`}
                        value={sectionEdits[idx] ?? section.paragraphs.join("\n")}
                        rows={Math.min(12, Math.max(3, section.paragraphs.join("\n").length / 45 + 1))}
                        maxLength={6000} disabled={issuing || renderingPdf}
                        onChange={e => { setSectionEdits(prev => ({ ...prev, [idx]: e.target.value })); setError(""); }} />
                    ) : section.paragraphs.map((p, i) => {
                      const editKey = contractParagraphEditKey(idx, i, p);
                      return editKey ? <textarea key={editKey} className="gts-contract-clause-editor" aria-label={`${section.heading} ${i + 1}항 수정`}
                        value={sectionEdits[editKey] ?? p} rows={3} maxLength={6000} disabled={issuing || renderingPdf}
                        onChange={e => { setSectionEdits(prev => ({ ...prev, [editKey]: e.target.value })); setError(""); }} /> : <p key={i}>{p}</p>;
                    })}
                  </div>
                ))}
                <div className="gts-contract-sign-summary"><strong>회사 날인 · 선생님 전자서명</strong><p>발행하는 PDF의 회사 서명란에는 지티에스 도장이 들어갑니다. 선생님 서명은 본인 확인·동의 후 추가됩니다.</p></div>
              </div>
            ) : (
              <p className="my-profile-empty">미리보기를 만들 수 없습니다.</p>
            )}
            {error ? <p role="alert" className="my-profile-field-error">{error}</p> : null}
            {pdfPreview && <div className="gts-contract-final-preview">
              <div className="my-profile-contract-actions"><ContractPdfActions url={pdfPreview.url} filename={pdfPreview.filename} /></div>
              <iframe title="발송할 계약서 PDF 미리보기" src={pdfPreview.url} className="my-profile-pdf-frame" />
            </div>}
            <div className="my-profile-actions">
              <button type="button" className="my-profile-btn-ghost" onClick={() => setStep("form")} disabled={issuing || renderingPdf}>계약정보 수정</button>
              <button type="button" className="my-profile-btn-ghost" onClick={renderPdf} disabled={issuing || renderingPdf || !preview}>{renderingPdf ? "PDF 만드는 중..." : "PDF 미리보기 확인"}</button>
              <button type="button" className="my-profile-save" onClick={issue} disabled={issuing || renderingPdf || !preview || !pdfPreview}>
                {issuing ? "발행 중..." : "선생님 앱으로 발송"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
