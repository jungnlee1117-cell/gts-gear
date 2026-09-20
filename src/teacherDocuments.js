export const TEACHER_DOCUMENTS_BUCKET = "teacher-documents";
export const TEACHER_DOCUMENT_MAX_BYTES = 15 * 1024 * 1024;
export const TEACHER_DOCUMENT_ACCEPT = "application/pdf,image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.pdf,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif";

const ALLOWED_EXT = new Set(["pdf", "jpg", "jpeg", "png", "webp", "gif", "heic", "heif"]);
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

export function teacherDocumentTypeLabel(row) {
  const typeLabel = row?.teacher_document_types?.label || "서류";
  if (row?.doc_label) return `${typeLabel} · ${row.doc_label}`;
  return typeLabel;
}

export function formatDocumentWhen(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function formatDocumentSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)}KB`;
  return `${(n / (1024 * 1024)).toFixed(1)}MB`;
}

function documentFileName(row) {
  return typeof row === "string" ? row : String(row?.file_name || "");
}

export function isDocumentImage(row) {
  const mime = String(row?.mime_type || "").toLowerCase();
  if (mime.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(documentFileName(row));
}

export function isDocumentPdf(row) {
  const mime = String(row?.mime_type || "").toLowerCase();
  if (mime.includes("pdf")) return true;
  return /\.pdf$/i.test(documentFileName(row));
}

export function isHeicDocument(row) {
  const mime = String(row?.mime_type || "").toLowerCase();
  if (mime.includes("heic") || mime.includes("heif")) return true;
  return /\.(heic|heif)$/i.test(documentFileName(row));
}

export function documentViewerKind(row) {
  if (isDocumentImage(row)) return "image";
  if (isDocumentPdf(row)) return "pdf";
  return "file";
}

function fileExtension(name) {
  const ext = String(name || "").split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toLowerCase();
  return ext || "bin";
}

export function teacherDocumentStoragePath(teacherId, docId, fileName) {
  return `${teacherId}/${docId}/${crypto.randomUUID()}.${fileExtension(fileName)}`;
}

export function validateTeacherDocumentFile(file) {
  if (!file) return "파일을 선택해 주세요.";
  if (file.size > TEACHER_DOCUMENT_MAX_BYTES) return `${file.name}: 파일 크기는 15MB 이하여야 합니다.`;
  const ext = fileExtension(file.name);
  const mime = String(file.type || "").toLowerCase();
  if (ALLOWED_MIME.has(mime) || ALLOWED_EXT.has(ext)) return "";
  return `${file.name}: PDF 또는 이미지 파일만 업로드할 수 있습니다.`;
}

export function teacherDocumentsErrorMessage(error) {
  const msg = String(error?.message || error || "").trim();
  if (!msg) return "서류를 처리하지 못했습니다.";
  if (/schema cache|does not exist|42P01|PGRST205/i.test(msg)) {
    return "서류 기능을 위한 데이터베이스 업데이트가 필요합니다. supabase/teacher_document_types.sql 을 실행해 주세요.";
  }
  if (/이 종류로 올라간 서류가 있어/i.test(msg)) {
    return "이 종류로 올라간 서류가 있어 삭제할 수 없습니다. 비활성화해 주세요.";
  }
  return msg;
}

export async function fetchTeacherDocumentTypes(supabase, { activeOnly = false } = {}) {
  let query = supabase
    .from("teacher_document_types")
    .select("id, slug, label, sort_order, is_active, allows_custom_label, created_at")
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });
  if (activeOnly) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createTeacherDocumentType(supabase, { label, allowsCustomLabel = false }) {
  const name = String(label || "").trim();
  if (!name) throw new Error("서류 종류 이름을 입력해 주세요.");
  const existing = await fetchTeacherDocumentTypes(supabase);
  const maxOrder = existing.reduce((max, row) => Math.max(max, Number(row.sort_order) || 0), 0);
  const { data, error } = await supabase
    .from("teacher_document_types")
    .insert({
      label: name,
      sort_order: maxOrder + 10,
      is_active: true,
      allows_custom_label: Boolean(allowsCustomLabel),
    })
    .select("id, slug, label, sort_order, is_active, allows_custom_label, created_at")
    .single();
  if (error) throw error;
  return data;
}

export async function updateTeacherDocumentType(supabase, id, patch) {
  if (!id) throw new Error("서류 종류를 찾을 수 없습니다.");
  const payload = {};
  if (patch.label != null) payload.label = String(patch.label).trim();
  if (patch.sort_order != null) payload.sort_order = Number(patch.sort_order);
  if (patch.is_active != null) payload.is_active = Boolean(patch.is_active);
  if (patch.allows_custom_label != null) payload.allows_custom_label = Boolean(patch.allows_custom_label);
  const { data, error } = await supabase
    .from("teacher_document_types")
    .update(payload)
    .eq("id", id)
    .select("id, slug, label, sort_order, is_active, allows_custom_label, created_at")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTeacherDocumentType(supabase, id) {
  if (!id) return;
  const { error } = await supabase.from("teacher_document_types").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchTeacherDocuments(supabase, teacherId) {
  const { data, error, count } = await supabase
    .from("teacher_documents")
    .select("id, teacher_id, doc_type, doc_type_id, doc_label, file_path, file_name, mime_type, file_size, uploaded_at, uploaded_by, teacher_document_types(id, label, slug, allows_custom_label, is_active)", { count: "exact" })
    .eq("teacher_id", teacherId)
    .order("uploaded_at", { ascending: false });
  if (error) throw error;
  return { rows: data || [], count: typeof count === "number" ? count : (data || []).length };
}

export async function countTeacherDocuments(supabase, teacherId) {
  const { count, error } = await supabase
    .from("teacher_documents")
    .select("id", { count: "exact", head: true })
    .eq("teacher_id", teacherId);
  if (error) {
    if (/schema cache|does not exist|42P01|PGRST205/i.test(error.message || "")) return 0;
    throw error;
  }
  return count || 0;
}

export async function createTeacherDocumentSignedUrl(supabase, path, { downloadName, expiresIn = 60 * 60 } = {}) {
  if (!path) throw new Error("파일을 찾을 수 없습니다.");
  const options = downloadName ? { download: downloadName } : undefined;
  const { data, error } = await supabase.storage
    .from(TEACHER_DOCUMENTS_BUCKET)
    .createSignedUrl(path, expiresIn, options);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error("파일을 열 수 없습니다.");
  return data.signedUrl;
}

export async function uploadTeacherDocument(supabase, {
  teacherId,
  uploadedBy,
  docTypeId,
  docType,
  docLabel,
  file,
  existing,
} = {}) {
  const fileError = validateTeacherDocumentFile(file);
  if (fileError) throw new Error(fileError);
  if (!teacherId) throw new Error("선생님을 찾을 수 없습니다.");
  const typeId = docTypeId || existing?.doc_type_id;
  if (!typeId) throw new Error("서류 종류를 선택해 주세요.");
  const label = String(docLabel || "").trim();

  const id = existing?.id || crypto.randomUUID();
  const path = teacherDocumentStoragePath(teacherId, id, file.name);
  const oldPath = existing?.file_path || null;

  const { error: upErr } = await supabase.storage
    .from(TEACHER_DOCUMENTS_BUCKET)
    .upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (upErr) throw upErr;

  const payload = {
    teacher_id: teacherId,
    doc_type_id: typeId,
    doc_type: docType || existing?.doc_type || null,
    doc_label: label || null,
    file_path: path,
    file_name: file.name,
    mime_type: file.type || null,
    file_size: file.size,
    uploaded_at: new Date().toISOString(),
    uploaded_by: uploadedBy,
  };

  try {
    if (existing?.id) {
      const { error } = await supabase
        .from("teacher_documents")
        .update(payload)
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("teacher_documents")
        .insert({ id, ...payload });
      if (error) throw error;
    }
  } catch (err) {
    await supabase.storage.from(TEACHER_DOCUMENTS_BUCKET).remove([path]);
    throw err;
  }

  if (oldPath && oldPath !== path) {
    await supabase.storage.from(TEACHER_DOCUMENTS_BUCKET).remove([oldPath]);
  }
  return { id, path };
}

export async function deleteTeacherDocument(supabase, row) {
  if (!row?.id) return;
  const { error } = await supabase.from("teacher_documents").delete().eq("id", row.id);
  if (error) throw error;
  if (row.file_path) {
    await supabase.storage.from(TEACHER_DOCUMENTS_BUCKET).remove([row.file_path]);
  }
}
