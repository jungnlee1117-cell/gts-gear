import { useEffect, useState } from "react";
import { FileText, PenLine, Plus, Upload, X } from "lucide-react";
import SignaturePad from "./SignaturePad.jsx";
import ContractIssueModal from "./ContractIssueModal.jsx";
import { createContractPdfUrl, invokeTeacherHr, sha256HexOfFile, signedContractPdfPath, TeacherHrError } from "./teacherHr.js";
import { formatDotDate, formatRateLine } from "../supabase/functions/teacher-hr/contractTemplate.js";

function formatDate(value) {
  if (!value) return "—";
  return String(value).slice(0, 10);
}

function contractStatusLabel(status) {
  if (status === "서명완료") return "서명 완료";
  if (status === "서명대기") return "서명 대기";
  return "계약 없음";
}

function ratesByContract(rateRows) {
  const map = {};
  for (const row of rateRows || []) {
    if (!map[row.contract_id]) map[row.contract_id] = [];
    map[row.contract_id].push(row);
  }
  return map;
}

export default function MyProfileContractsTab({
  supabase,
  me,
  teacherId,
  teacherName,
  teacherPhone,
  teacherContractType,
  canUpload,
  canSign,
  onChanged,
}) {
  const [rows, setRows] = useState([]);
  const [ratesMap, setRatesMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [cancellingId, setCancellingId] = useState("");
  const [title, setTitle] = useState("");
  const [contractDate, setContractDate] = useState("");
  const [file, setFile] = useState(null);
  const [viewer, setViewer] = useState(null);
  const [signing, setSigning] = useState(null);
  const [signature, setSignature] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [savingSign, setSavingSign] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("teacher_contracts")
      .select("*")
      .eq("teacher_id", teacherId)
      .order("created_at", { ascending: false });
    if (error) {
      setRows([]);
      setRatesMap({});
      if (!/schema cache|does not exist|42P01/i.test(error.message || "")) {
        alert(error.message || "계약서를 불러오지 못했습니다.");
      }
      setLoading(false);
      return;
    }
    const list = data || [];
    setRows(list);
    const ids = list.map((r) => r.id);
    if (!ids.length) {
      setRatesMap({});
      setLoading(false);
      return;
    }
    const { data: rateRows, error: rateErr } = await supabase
      .from("teacher_contract_rates")
      .select("id, contract_id, teacher_id, rate_type, rate_name, amount, unit, sort_order")
      .in("contract_id", ids)
      .order("sort_order");
    if (rateErr && !/schema cache|does not exist|42P01/i.test(rateErr.message || "")) {
      console.warn("[teacher_contract_rates]", rateErr.code || rateErr.message);
    }
    setRatesMap(ratesByContract(rateRows || []));
    setLoading(false);
  };

  useEffect(() => {
    if (!teacherId) return undefined;
    load();
    return undefined;
  }, [teacherId]);

  const visibleRows = canUpload ? rows : rows.filter((row) => row.status === "서명대기");

  const openPdf = async (row, kind = "auto") => {
    const signedPath = row.signed_pdf_path || row.signed_pdf_url;
    const originalPath = row.original_pdf_path || row.original_pdf_url;
    const wantSigned = kind === "signed" || (kind === "auto" && row.status === "서명완료");
    const path = kind === "original"
      ? originalPath
      : kind === "signed"
        ? signedPath
        : signedContractPdfPath(row);
    if (!path) {
      alert(wantSigned ? "서명완료 PDF를 찾을 수 없습니다." : "계약서 PDF를 찾을 수 없습니다.");
      return;
    }
    try {
      const url = await createContractPdfUrl(supabase, path);
      setViewer({
        ...row,
        url,
        label: wantSigned ? "서명완료 PDF" : "원본 계약서",
      });
    } catch (err) {
      alert(err.message || "PDF를 열 수 없습니다.");
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!canUpload) return;
    if (!title.trim()) return alert("계약서 제목을 입력해 주세요.");
    if (!file) return alert("PDF 파일을 선택해 주세요.");
    if (file.type && file.type !== "application/pdf") return alert("PDF 파일만 업로드할 수 있습니다.");
    setUploading(true);
    const id = crypto.randomUUID();
    const path = `${teacherId}/${id}/original.pdf`;
    try {
      const hash = await sha256HexOfFile(file);
      const { error: upErr } = await supabase.storage
        .from("teacher-contracts")
        .upload(path, file, { contentType: "application/pdf", upsert: false });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("teacher_contracts").insert({
        id,
        teacher_id: teacherId,
        title: title.trim(),
        contract_date: contractDate || null,
        status: "서명대기",
        original_pdf_path: path,
        original_pdf_url: path,
        original_pdf_hash: hash,
        created_by: me.id,
      });
      if (insErr) {
        await supabase.storage.from("teacher-contracts").remove([path]);
        throw insErr;
      }
      setTitle("");
      setContractDate("");
      setFile(null);
      await load();
      onChanged?.();
      alert("계약서가 등록되었습니다.");
    } catch (err) {
      alert(err.message || "업로드에 실패했습니다.");
    } finally {
      setUploading(false);
    }
  };

  const startSign = async (row) => {
    try {
      const url = await createContractPdfUrl(supabase, row.original_pdf_path);
      setSigning({ ...row, url });
      setSignature("");
      setAgreed(false);
    } catch (err) {
      alert(err.message || "계약서를 열 수 없습니다.");
    }
  };

  const cancelPending = async (row) => {
    if (!canUpload || row.status !== "서명대기") return;
    if (!window.confirm("서명 대기 중인 계약서 발행을 취소할까요? 원본 파일도 삭제됩니다.")) return;
    setCancellingId(row.id);
    try {
      await invokeTeacherHr(supabase, "cancel_pending_contract", { contract_id: row.id });
      await load();
      onChanged?.();
    } catch (err) {
      alert(err instanceof TeacherHrError ? err.message : (err.message || "발행 취소에 실패했습니다."));
    } finally {
      setCancellingId("");
    }
  };

  const submitSign = async () => {
    if (!signing) return;
    if (!agreed) return alert("계약 내용을 확인하고 전자서명에 동의해 주세요.");
    if (!signature) return alert("서명을 입력해 주세요.");
    setSavingSign(true);
    try {
      await invokeTeacherHr(supabase, "sign_contract", {
        contract_id: signing.id,
        signature_data_url: signature,
        agreed: true,
      });
      setSigning(null);
      setSignature("");
      setAgreed(false);
      await load();
      onChanged?.();
      alert("서명이 완료되었습니다.");
    } catch (err) {
      alert(err.message || "서명에 실패했습니다.");
    } finally {
      setSavingSign(false);
    }
  };

  return (
    <div className="my-profile-form">
      <div className="my-profile-section-head">
        <h2 className="my-profile-card-title">계약서</h2>
        {canUpload ? (
          <button type="button" className="my-profile-btn-mint" onClick={() => setIssuing(true)}>
            <Plus size={14} /> 계약서 발행
          </button>
        ) : null}
      </div>
      <p className="my-profile-hint" style={{ marginTop: 0 }}>
        {canUpload
          ? "서명 완료된 계약서는 수정할 수 없습니다. 내용이 바뀌면 발행 취소(서명 대기만) 또는 새 계약서를 발행하세요."
          : "계약 내용을 모두 확인한 뒤 전자서명해 주세요. 서명이 끝나면 이 탭은 닫힙니다."}
      </p>

      {canUpload ? (
        <details className="my-profile-card" style={{ marginBottom: 16 }}>
          <summary className="my-profile-card-title" style={{ fontSize: 14, cursor: "pointer" }}>PDF 직접 업로드</summary>
          <form onSubmit={handleUpload}>
            <div className="my-profile-grid" style={{ marginTop: 12 }}>
              <label className="my-profile-field">
                <span>제목 *</span>
                <input
                  className="my-profile-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={`${teacherName || "선생님"} 위탁계약서`}
                />
              </label>
              <label className="my-profile-field">
                <span>계약일</span>
                <input
                  type="date"
                  className="my-profile-input"
                  value={contractDate}
                  onChange={(e) => setContractDate(e.target.value)}
                />
              </label>
              <label className="my-profile-field my-profile-field--full">
                <span>PDF 파일 *</span>
                <input
                  type="file"
                  accept="application/pdf"
                  className="my-profile-input"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </label>
            </div>
            <div className="my-profile-actions">
              <button type="submit" className="my-profile-save" disabled={uploading}>
                <Upload size={14} style={{ marginRight: 6 }}/>
                {uploading ? "업로드 중..." : "계약서 등록"}
              </button>
            </div>
          </form>
        </details>
      ) : null}

      {loading ? (
        <p className="my-profile-muted">계약서 불러오는 중...</p>
      ) : visibleRows.length === 0 ? (
        <p className="my-profile-muted">{canUpload ? "계약 없음" : "서명할 계약서가 없습니다."}</p>
      ) : canUpload ? (
        <div className="my-profile-contract-list">
          {visibleRows.map((row) => {
            const rates = ratesMap[row.id] || [];
            return (
              <div key={row.id} className="my-profile-contract-row">
                <div>
                  <div className="my-profile-contract-title">{row.title || "GTS 교육용역 위탁 계약서"}</div>
                  <div className="my-profile-hint">
                    {row.contract_type ? `${row.contract_type} · ` : ""}
                    {row.start_date || row.end_date
                      ? `${formatDotDate(row.start_date)} ~ ${formatDotDate(row.end_date)}`
                      : `계약일 ${formatDate(row.contract_date)}`}
                    {row.signed_at ? ` · 서명일 ${formatDate(row.signed_at)}` : ""}
                    {row.version ? ` · v${row.version}` : ""}
                  </div>
                  {rates.length ? (
                    <div className="my-profile-hint" style={{ marginTop: 4 }}>
                      {rates.map((r) => formatRateLine(r)).join(" · ")}
                    </div>
                  ) : null}
                </div>
                <span className={`my-profile-status my-profile-status--${row.status === "서명완료" ? "done" : "wait"}`}>
                  {contractStatusLabel(row.status)}
                </span>
                <div className="my-profile-contract-actions">
                  {row.status === "서명완료" ? (
                    <>
                      <button type="button" className="my-profile-btn-ghost" onClick={() => openPdf(row, "original")}>
                        <FileText size={14}/> 원본 계약서
                      </button>
                      <button type="button" className="my-profile-save" onClick={() => openPdf(row, "signed")}>
                        <FileText size={14}/> 서명완료 PDF 보기
                      </button>
                    </>
                  ) : (
                    <button type="button" className="my-profile-btn-ghost" onClick={() => openPdf(row, "original")}>
                      <FileText size={14}/> 원본 계약서
                    </button>
                  )}
                  {row.status === "서명대기" ? (
                    <button
                      type="button"
                      className="my-profile-btn-ghost"
                      onClick={() => cancelPending(row)}
                      disabled={cancellingId === row.id}
                    >
                      <X size={14}/> {cancellingId === row.id ? "취소 중..." : "발행 취소"}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="my-profile-contract-list">
          {visibleRows.map((row) => (
            <div key={row.id} className="my-profile-pending-contract">
              <div className="my-profile-pending-contract-head">
                <div className="my-profile-contract-title">GTS 교육용역 위탁 계약서</div>
                <span className="my-profile-status my-profile-status--wait">서명 필요</span>
              </div>
              <div className="my-profile-pending-period-label">계약기간</div>
              <div className="my-profile-pending-period">
                {formatDotDate(row.start_date)} ~ {formatDotDate(row.end_date)}
              </div>
              <div className="my-profile-contract-actions">
                <button type="button" className="my-profile-save" onClick={() => startSign(row)}>
                  <PenLine size={14}/> 계약서 확인
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {issuing ? (
        <ContractIssueModal
          supabase={supabase}
          teacherId={teacherId}
          teacherName={teacherName}
          teacherPhone={teacherPhone}
          teacherContractType={teacherContractType}
          onClose={() => setIssuing(false)}
          onIssued={async () => {
            setIssuing(false);
            await load();
            onChanged?.();
            alert("계약서가 발행되었습니다. 선생님에게 서명 요청이 표시됩니다.");
          }}
        />
      ) : null}

      {viewer ? (
        <div className="sch-modal-overlay" onClick={() => setViewer(null)}>
          <div className="sch-modal sch-modal--wide my-profile-pdf-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sch-modal-head">
              <h3>{viewer.title} · {viewer.label}</h3>
              <div className="my-profile-contract-actions">
                <a className="my-profile-btn-ghost" href={viewer.url} target="_blank" rel="noreferrer">새 탭</a>
                <button type="button" className="sch-icon-btn" onClick={() => setViewer(null)}>닫기</button>
              </div>
            </div>
            <iframe title="계약서 PDF" src={viewer.url} className="my-profile-pdf-frame"/>
          </div>
        </div>
      ) : null}

      {signing ? (
        <div className="sch-modal-overlay" onClick={() => !savingSign && setSigning(null)}>
          <div className="sch-modal sch-modal--wide my-profile-pdf-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sch-modal-head">
              <h3>GTS 교육용역 위탁 계약서</h3>
              <button type="button" className="sch-icon-btn" onClick={() => setSigning(null)} disabled={savingSign}>닫기</button>
            </div>
            <p className="my-profile-hint">계약서 전체 내용을 확인한 뒤, 동의하고 서명해 주세요.</p>
            <iframe title="서명할 계약서" src={signing.url} className="my-profile-pdf-frame"/>
            <label className="my-profile-agree">
              <input
                type="checkbox"
                checked={agreed}
                disabled={savingSign}
                onChange={(e) => setAgreed(e.target.checked)}
              />
              <span>본인은 위 계약 내용을 모두 확인하였으며, 전자문서 및 전자서명 방식의 계약 체결에 동의합니다.</span>
            </label>
            <span className="my-profile-sign-pad-label">서명하기</span>
            <SignaturePad onChange={setSignature} disabled={savingSign || !agreed}/>
            <div className="my-profile-actions">
              <button type="button" className="my-profile-save" onClick={submitSign} disabled={savingSign || !signature || !agreed}>
                {savingSign ? "처리 중..." : "서명 완료"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
