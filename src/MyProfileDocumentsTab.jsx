import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Eye, FileText, Trash2, Upload } from "lucide-react";
import { EmptyState } from "./MyProfileFormField.jsx";
import {
  TEACHER_DOCUMENT_ACCEPT,
  createTeacherDocumentSignedUrl,
  deleteTeacherDocument,
  documentViewerKind,
  fetchTeacherDocumentTypes,
  fetchTeacherDocuments,
  formatDocumentSize,
  formatDocumentWhen,
  isDocumentImage,
  isDocumentPdf,
  isHeicDocument,
  teacherDocumentTypeLabel,
  teacherDocumentsErrorMessage,
  uploadTeacherDocument,
  validateTeacherDocumentFile,
} from "./teacherDocuments.js";

export default function MyProfileDocumentsTab({
  supabase,
  me,
  teacherId,
  canManage = false,
  showTypeAdmin = false,
  onChanged,
}) {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [missingTable, setMissingTable] = useState(false);
  const [docTypeId, setDocTypeId] = useState("");
  const [docLabel, setDocLabel] = useState("");
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [viewer, setViewer] = useState(null);
  const [thumbUrls, setThumbUrls] = useState({});
  const [brokenThumbs, setBrokenThumbs] = useState({});
  const [previewFailed, setPreviewFailed] = useState(false);
  const replaceInputRef = useRef(null);
  const replaceRowRef = useRef(null);
  const uploadInputRef = useRef(null);

  const selectedType = useMemo(
    () => types.find((item) => item.id === docTypeId) || null,
    [types, docTypeId],
  );

  const load = async () => {
    if (!teacherId) return;
    setLoading(true);
    try {
      const [result, typeRows] = await Promise.all([
        fetchTeacherDocuments(supabase, teacherId),
        fetchTeacherDocumentTypes(supabase, { activeOnly: true }),
      ]);
      setMissingTable(false);
      setRows(result.rows || []);
      setTypes(typeRows || []);
      setDocTypeId((current) => {
        if (current && typeRows.some((item) => item.id === current)) return current;
        return typeRows[0]?.id || "";
      });
    } catch (err) {
      setRows([]);
      setTypes([]);
      const msg = String(err?.message || "");
      if (/schema cache|does not exist|42P01|PGRST205/i.test(msg)) {
        setMissingTable(true);
      } else {
        alert(teacherDocumentsErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    return undefined;
  }, [teacherId]);

  useEffect(() => {
    let cancelled = false;
    const images = rows.filter(isDocumentImage);
    if (!images.length) {
      setThumbUrls({});
      setBrokenThumbs({});
      return undefined;
    }
    (async () => {
      const entries = await Promise.all(images.map(async (row) => {
        try {
          const url = await createTeacherDocumentSignedUrl(supabase, row.file_path);
          return [row.id, url];
        } catch {
          return [row.id, ""];
        }
      }));
      if (!cancelled) {
        setThumbUrls(Object.fromEntries(entries));
        setBrokenThumbs({});
      }
    })();
    return () => { cancelled = true; };
  }, [supabase, rows]);

  useEffect(() => () => {
    if (viewer?.url?.startsWith("blob:")) URL.revokeObjectURL(viewer.url);
  }, [viewer]);

  useEffect(() => {
    setPreviewFailed(false);
  }, [viewer?.id, viewer?.url]);

  useEffect(() => {
    if (!viewer) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") setViewer(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewer]);

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!canManage) return;
    const fileError = validateTeacherDocumentFile(file);
    if (fileError) return alert(fileError);
    setSaving(true);
    try {
      await uploadTeacherDocument(supabase, {
        teacherId,
        uploadedBy: me?.id,
        docTypeId,
        docType: selectedType?.slug || null,
        docLabel,
        file,
      });
      setFile(null);
      setDocLabel("");
      if (uploadInputRef.current) uploadInputRef.current.value = "";
      await load();
      onChanged?.();
    } catch (err) {
      alert(teacherDocumentsErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const openDocument = async (row, { download = false } = {}) => {
    try {
      if (!download && isDocumentImage(row) && thumbUrls[row.id] && !brokenThumbs[row.id]) {
        setViewer({ ...row, url: thumbUrls[row.id], kind: "image" });
        return;
      }
      const url = await createTeacherDocumentSignedUrl(supabase, row.file_path, {
        downloadName: download ? row.file_name : undefined,
      });
      if (download) {
        window.open(url, "_blank", "noopener,noreferrer");
        return;
      }
      setViewer({
        ...row,
        url,
        kind: documentViewerKind(row),
      });
    } catch (err) {
      alert(teacherDocumentsErrorMessage(err));
    }
  };

  const startReplace = (row) => {
    if (!canManage) return;
    replaceRowRef.current = row;
    replaceInputRef.current?.click();
  };

  const handleReplaceFile = async (event) => {
    const nextFile = event.target.files?.[0];
    event.target.value = "";
    const row = replaceRowRef.current;
    replaceRowRef.current = null;
    if (!nextFile || !row) return;
    const fileError = validateTeacherDocumentFile(nextFile);
    if (fileError) return alert(fileError);
    setBusyId(row.id);
    try {
      await uploadTeacherDocument(supabase, {
        teacherId,
        uploadedBy: me?.id,
        docTypeId: row.doc_type_id,
        docType: row.doc_type,
        docLabel: row.doc_label,
        file: nextFile,
        existing: row,
      });
      await load();
      onChanged?.();
    } catch (err) {
      alert(teacherDocumentsErrorMessage(err));
    } finally {
      setBusyId("");
    }
  };

  const handleDelete = async (row) => {
    if (!canManage) return;
    if (!window.confirm(`“${teacherDocumentTypeLabel(row)} · ${row.file_name}” 서류를 삭제할까요?`)) return;
    setBusyId(row.id);
    try {
      await deleteTeacherDocument(supabase, row);
      if (viewer?.id === row.id) setViewer(null);
      await load();
      onChanged?.();
    } catch (err) {
      alert(teacherDocumentsErrorMessage(err));
    } finally {
      setBusyId("");
    }
  };

  return (
    <div className="my-profile-form">
      <div className="my-profile-section-head">
        <h2 className="my-profile-card-title">서류</h2>
        {showTypeAdmin ? (
          <button
            type="button"
            className="my-profile-btn-ghost"
            onClick={() => navigate("/schedule?view=document-types")}
          >
            서류 종류 관리
          </button>
        ) : null}
      </div>
      <p className="my-profile-hint" style={{ marginTop: 0 }}>
        원에 들어갈 때 필요한 이력서·건강검진표 등을 미리 등록해 두세요. 본인과 관리자만 볼 수 있습니다.
      </p>

      {canManage ? (
        <form className="my-profile-card" onSubmit={handleUpload} style={{ marginBottom: 16 }}>
          <div className="my-profile-grid">
            <label className="my-profile-field">
              <span>서류 종류 *</span>
              <select
                className="my-profile-input"
                value={docTypeId}
                onChange={(e) => setDocTypeId(e.target.value)}
                aria-label="서류 종류"
              >
                {types.length ? types.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                )) : (
                  <option value="">등록된 종류가 없습니다</option>
                )}
              </select>
            </label>
            {selectedType?.allows_custom_label ? (
              <label className="my-profile-field">
                <span>서류 이름 *</span>
                <input
                  className="my-profile-input"
                  value={docLabel}
                  onChange={(e) => setDocLabel(e.target.value)}
                  placeholder="예: 주민등록등본"
                  aria-label="기타 서류 이름"
                />
              </label>
            ) : (
              <div className="my-profile-field">
                <span>안내</span>
                <p className="my-profile-hint" style={{ margin: 0 }}>PDF 또는 이미지, 최대 15MB</p>
              </div>
            )}
            <label className="my-profile-field my-profile-field--full">
              <span>파일 *</span>
              <input
                ref={uploadInputRef}
                type="file"
                accept={TEACHER_DOCUMENT_ACCEPT}
                className="my-profile-input"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                aria-label="서류 파일"
              />
            </label>
          </div>
          <div className="my-profile-actions">
            <button type="submit" className="my-profile-save" disabled={saving || !docTypeId}>
              <Upload size={14} />
              {saving ? "업로드 중..." : "서류 등록"}
            </button>
          </div>
        </form>
      ) : null}

      <input
        ref={replaceInputRef}
        type="file"
        accept={TEACHER_DOCUMENT_ACCEPT}
        hidden
        onChange={handleReplaceFile}
      />

      {loading ? (
        <p className="my-profile-muted">서류를 불러오는 중...</p>
      ) : missingTable ? (
        <p className="my-profile-muted">서류 기능을 위한 데이터베이스 업데이트가 필요합니다.</p>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={FileText}
          compact
          title="등록된 서류가 없습니다."
          hint={canManage ? "위에서 파일을 올리면 이 목록에 쌓입니다." : ""}
        />
      ) : (
        <div className="my-profile-card">
          {rows.map((row) => (
            <div key={row.id} className="my-profile-entry">
              <button
                type="button"
                className="my-profile-doc-open"
                onClick={() => openDocument(row)}
              >
                <span className="my-profile-doc-thumb" aria-hidden="true">
                  {isDocumentImage(row) && thumbUrls[row.id] && !brokenThumbs[row.id] ? (
                    <img
                      src={thumbUrls[row.id]}
                      alt=""
                      onError={() => setBrokenThumbs((prev) => ({ ...prev, [row.id]: true }))}
                    />
                  ) : (
                    <span className="my-profile-doc-thumb-fallback">
                      <FileText size={18} />
                      {isHeicDocument(row) ? <em>HEIC</em> : isDocumentPdf(row) ? <em>PDF</em> : null}
                    </span>
                  )}
                </span>
                <span className="my-profile-doc-copy">
                  <span className="my-profile-doc-type">{teacherDocumentTypeLabel(row)}</span>
                  <span className="my-profile-entry-title">{row.file_name}</span>
                  <span className="my-profile-entry-sub">
                    {[formatDocumentWhen(row.uploaded_at), formatDocumentSize(row.file_size)].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </button>
              <div className="my-profile-entry-actions">
                <button type="button" className="my-profile-btn-ghost" onClick={() => openDocument(row)}>
                  <Eye size={14} /> 미리보기
                </button>
                <button type="button" className="my-profile-btn-ghost" onClick={() => openDocument(row, { download: true })}>
                  <Download size={14} /> 다운로드
                </button>
                {canManage ? (
                  <>
                    <button
                      type="button"
                      className="my-profile-btn-ghost"
                      onClick={() => startReplace(row)}
                      disabled={busyId === row.id}
                    >
                      <Upload size={14} /> {busyId === row.id ? "처리 중..." : "교체"}
                    </button>
                    <button
                      type="button"
                      className="my-profile-btn-ghost"
                      onClick={() => handleDelete(row)}
                      disabled={busyId === row.id}
                    >
                      <Trash2 size={14} /> 삭제
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {viewer ? (
        <div className="hub-modal-backdrop" onClick={() => setViewer(null)}>
          <div className="hub-modal my-profile-doc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="hub-modal__head">
              <h3 className="hub-modal__title">{teacherDocumentTypeLabel(viewer)} · {viewer.file_name}</h3>
              <button type="button" className="hub-modal__close" onClick={() => setViewer(null)}>닫기</button>
            </div>
            {viewer.kind === "image" && !previewFailed ? (
              <img
                className="my-profile-doc-preview"
                src={viewer.url}
                alt={viewer.file_name}
                onError={() => setPreviewFailed(true)}
              />
            ) : viewer.kind === "image" ? (
              <p className="my-profile-muted">
                {isHeicDocument(viewer)
                  ? "이 브라우저에서는 HEIC 미리보기를 지원하지 않습니다. 다운로드로 확인해 주세요."
                  : "이미지를 표시하지 못했습니다. 다운로드로 확인해 주세요."}
              </p>
            ) : viewer.kind === "pdf" ? (
              <iframe className="my-profile-doc-frame" title={viewer.file_name} src={viewer.url} />
            ) : (
              <p className="my-profile-muted">미리보기를 지원하지 않는 형식입니다. 다운로드로 확인해 주세요.</p>
            )}
            <div className="my-profile-actions">
              <button type="button" className="my-profile-btn-ghost" onClick={() => openDocument(viewer, { download: true })}>
                <Download size={14} /> 다운로드
              </button>
              <a className="my-profile-btn-ghost" href={viewer.url} target="_blank" rel="noreferrer">
                새 탭에서 열기
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
