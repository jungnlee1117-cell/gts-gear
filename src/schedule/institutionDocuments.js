import { scheduleSupabase } from "./api.js";
import {
  formatDocumentSize,
  formatDocumentWhen,
  isDocumentImage,
  validateTeacherDocumentFile,
} from "../teacherDocuments.js";

export const INSTITUTION_DOCUMENTS_BUCKET = "institution-documents";
export const INSTITUTION_DOCUMENT_ACCEPT = "application/pdf,image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.pdf,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif";
export const BIZ_REG_DOC_TYPE = "business_registration";

export { formatDocumentSize, formatDocumentWhen, isDocumentImage };

export function institutionDocumentStoragePath(institutionId, docId, fileName) {
  const ext = String(fileName || "").split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toLowerCase() || "bin";
  return `${institutionId}/${docId}/${crypto.randomUUID()}.${ext}`;
}

export function institutionDocumentsErrorMessage(error) {
  const msg = String(error?.message || error || "").trim();
  if (!msg) return "사업자등록증을 처리하지 못했습니다.";
  if (/schema cache|does not exist|42P01|PGRST205/i.test(msg)) {
    return "사업자등록증 기능을 위한 데이터베이스 업데이트가 필요합니다. supabase/institution_invoice_emails_and_documents.sql 을 실행해 주세요.";
  }
  return msg;
}

export function isMissingInstitutionDocumentsTable(error) {
  return /schema cache|does not exist|42P01|PGRST205/i.test(String(error?.message || error || ""));
}

export async function fetchInstitutionDocuments(institutionId, { docType = BIZ_REG_DOC_TYPE } = {}) {
  const { data, error } = await scheduleSupabase
    .from("institution_documents")
    .select("id, institution_id, doc_type, file_path, file_name, mime_type, file_size, uploaded_at, uploaded_by")
    .eq("institution_id", institutionId)
    .eq("doc_type", docType)
    .order("uploaded_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createInstitutionDocumentSignedUrl(path, { downloadName, expiresIn = 60 * 60 } = {}) {
  if (!path) throw new Error("파일을 찾을 수 없습니다.");
  const options = downloadName ? { download: downloadName } : undefined;
  const { data, error } = await scheduleSupabase.storage
    .from(INSTITUTION_DOCUMENTS_BUCKET)
    .createSignedUrl(path, expiresIn, options);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error("파일을 열 수 없습니다.");
  return data.signedUrl;
}

export async function uploadInstitutionDocument({
  institutionId,
  uploadedBy,
  file,
  docType = BIZ_REG_DOC_TYPE,
} = {}) {
  const fileError = validateTeacherDocumentFile(file);
  if (fileError) throw new Error(fileError);
  if (!institutionId) throw new Error("원을 찾을 수 없습니다.");

  const id = crypto.randomUUID();
  const path = institutionDocumentStoragePath(institutionId, id, file.name);

  const { error: upErr } = await scheduleSupabase.storage
    .from(INSTITUTION_DOCUMENTS_BUCKET)
    .upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (upErr) throw upErr;

  const { error } = await scheduleSupabase
    .from("institution_documents")
    .insert({
      id,
      institution_id: institutionId,
      doc_type: docType,
      file_path: path,
      file_name: file.name,
      mime_type: file.type || null,
      file_size: file.size,
      uploaded_at: new Date().toISOString(),
      uploaded_by: uploadedBy,
    });
  if (error) {
    await scheduleSupabase.storage.from(INSTITUTION_DOCUMENTS_BUCKET).remove([path]);
    throw error;
  }
  return { id, path };
}

export async function deleteInstitutionDocument(row) {
  if (!row?.id) return;
  const { error } = await scheduleSupabase.from("institution_documents").delete().eq("id", row.id);
  if (error) throw error;
  if (row.file_path) {
    await scheduleSupabase.storage.from(INSTITUTION_DOCUMENTS_BUCKET).remove([row.file_path]);
  }
}
