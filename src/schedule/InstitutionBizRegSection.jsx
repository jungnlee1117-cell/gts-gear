import { useEffect, useRef, useState } from "react";
import { Download, FileText, Trash2 } from "lucide-react";
import {
  INSTITUTION_DOCUMENT_ACCEPT,
  createInstitutionDocumentSignedUrl,
  deleteInstitutionDocument,
  fetchInstitutionDocuments,
  formatDocumentSize,
  formatDocumentWhen,
  institutionDocumentsErrorMessage,
  isDocumentImage,
  isMissingInstitutionDocumentsTable,
  uploadInstitutionDocument,
} from "./institutionDocuments.js";
import { validateTeacherDocumentFile } from "../teacherDocuments.js";

function viewerKind(row) {
  if (isDocumentImage(row)) return "image";
  if (String(row?.mime_type || "").includes("pdf") || String(row?.file_name || "").toLowerCase().endsWith(".pdf")) {
    return "pdf";
  }
  return "file";
}

export default function InstitutionBizRegSection({
  me,
  institutionId,
  mode = "manage",
  embedded = false,
}) {
  const compact = mode === "preview";
  const canManage = mode === "manage";
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [missingTable, setMissingTable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [viewer, setViewer] = useState(null);
  const fileRef = useRef(null);

  const current = rows[0] || null;

  const load = async () => {
    if (!institutionId) return;
    setLoading(true);
    try {
      const list = await fetchInstitutionDocuments(institutionId);
      setRows(list);
      setMissingTable(false);
    } catch (err) {
      setRows([]);
      if (isMissingInstitutionDocumentsTable(err)) setMissingTable(true);
      else alert(institutionDocumentsErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    return undefined;
  }, [institutionId]);

  useEffect(() => {
    let cancelled = false;
    if (!current || !isDocumentImage(current)) {
      setPreviewUrl("");
      return undefined;
    }
    createInstitutionDocumentSignedUrl(current.file_path)
      .then((url) => { if (!cancelled) setPreviewUrl(url); })
      .catch(() => { if (!cancelled) setPreviewUrl(""); });
    return () => { cancelled = true; };
  }, [current?.id, current?.file_path]);

  const openDocument = async (row, { download = false } = {}) => {
    try {
      const url = await createInstitutionDocumentSignedUrl(row.file_path, {
        downloadName: download ? row.file_name : undefined,
      });
      if (download) {
        window.open(url, "_blank", "noopener,noreferrer");
        return;
      }
      setViewer({ ...row, url, kind: viewerKind(row) });
    } catch (err) {
      alert(institutionDocumentsErrorMessage(err));
    }
  };

  const handleUpload = async (file) => {
    const fileError = validateTeacherDocumentFile(file);
    if (fileError) return alert(fileError);
    setSaving(true);
    try {
      await uploadInstitutionDocument({
        institutionId,
        uploadedBy: me?.id,
        file,
      });
      if (fileRef.current) fileRef.current.value = "";
      await load();
    } catch (err) {
      alert(institutionDocumentsErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    if (!confirm(`${row.file_name}을(를) 삭제할까요?`)) return;
    setBusyId(row.id);
    try {
      await deleteInstitutionDocument(row);
      await load();
    } catch (err) {
      alert(institutionDocumentsErrorMessage(err));
    } finally {
      setBusyId("");
    }
  };

  const history = rows.slice(1);

  const Tag = embedded ? "div" : "section";

  return (
    <Tag className={`${embedded ? "sch-bizreg sch-bizreg--embedded" : `sch-billing-panel sch-bizreg${compact ? " sch-bizreg--compact" : ""}`}`}>
      {embedded ? (
        <div className="sch-field">
          <span>사업자등록증</span>
          <p className="sch-muted sch-field-hint">PDF 또는 이미지, 최대 15MB. 교체하면 이전 파일이 이력에 남습니다.</p>
        </div>
      ) : (
        <>
          <div className="sch-billing-panel-header">
            <h4 className="sch-subtitle">사업자등록증</h4>
          </div>
          <p className="sch-muted sch-billing-note">
            세금계산서 발행에 쓰는 서류입니다. PDF 또는 이미지, 최대 15MB.
          </p>
        </>
      )}

      {loading ? (
        <p className="sch-muted">불러오는 중...</p>
      ) : missingTable ? (
        <p className="sch-muted">사업자등록증 기능을 위한 데이터베이스 업데이트가 필요합니다.</p>
      ) : !current ? (
        <div className="sch-bizreg-empty">
          <p className="sch-muted">등록된 사업자등록증이 없습니다.</p>
        </div>
      ) : (
        <div className="sch-bizreg-current">
          {previewUrl ? (
            <button type="button" className="sch-bizreg-thumb" onClick={() => openDocument(current)}>
              <img src={previewUrl} alt={current.file_name} />
            </button>
          ) : (
            <button type="button" className="sch-bizreg-file" onClick={() => openDocument(current)}>
              <FileText size={18} />
              <span>{current.file_name}</span>
            </button>
          )}
          <div className="sch-bizreg-meta">
            <strong>{current.file_name}</strong>
            <span className="sch-muted">
              {[formatDocumentWhen(current.uploaded_at), formatDocumentSize(current.file_size)].filter(Boolean).join(" · ")}
            </span>
            <div className="sch-bizreg-actions">
              <button type="button" className="sch-btn sch-btn--ghost sch-btn--sm" onClick={() => openDocument(current)}>
                미리보기
              </button>
              <button type="button" className="sch-btn sch-btn--ghost sch-btn--sm" onClick={() => openDocument(current, { download: true })}>
                <Download size={13} /> 다운로드
              </button>
              {canManage ? (
                <button
                  type="button"
                  className="sch-btn sch-btn--ghost sch-btn--sm sch-regular-classes-delete"
                  disabled={busyId === current.id}
                  onClick={() => handleDelete(current)}
                >
                  <Trash2 size={13} /> 삭제
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {canManage && !missingTable ? (
        <label className="sch-field sch-bizreg-upload">
          <span>{current ? "새 파일로 교체 (이전 파일은 이력에 남음)" : "파일 업로드"}</span>
          <input
            ref={fileRef}
            type="file"
            className="sch-input"
            accept={INSTITUTION_DOCUMENT_ACCEPT}
            disabled={saving}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
            }}
          />
          {saving ? <span className="sch-muted">업로드 중...</span> : null}
        </label>
      ) : null}

      {canManage && history.length ? (
        <div className="sch-bizreg-history">
          <h5>이전 파일</h5>
          <ul>
            {history.map((row) => (
              <li key={row.id}>
                <button type="button" className="sch-bizreg-history-open" onClick={() => openDocument(row)}>
                  <span>{row.file_name}</span>
                  <small>{formatDocumentWhen(row.uploaded_at)}</small>
                </button>
                <button
                  type="button"
                  className="sch-btn sch-btn--ghost sch-btn--sm"
                  disabled={busyId === row.id}
                  onClick={() => handleDelete(row)}
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {viewer ? (
        <div className="sch-modal-overlay" onClick={() => setViewer(null)}>
          <div className="sch-modal sch-modal--wide sch-bizreg-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sch-modal-head">
              <h3>사업자등록증 · {viewer.file_name}</h3>
              <button type="button" className="sch-btn sch-btn--ghost" onClick={() => setViewer(null)}>닫기</button>
            </div>
            {viewer.kind === "image" ? (
              <img className="sch-bizreg-preview" src={viewer.url} alt={viewer.file_name} />
            ) : viewer.kind === "pdf" ? (
              <iframe className="sch-bizreg-frame" title={viewer.file_name} src={viewer.url} />
            ) : (
              <p className="sch-muted">미리보기를 지원하지 않는 형식입니다. 다운로드로 확인해 주세요.</p>
            )}
            <div className="sch-form-actions">
              <a className="sch-btn sch-btn--ghost" href={viewer.url} target="_blank" rel="noreferrer">새 탭에서 열기</a>
            </div>
          </div>
        </div>
      ) : null}
    </Tag>
  );
}
