export const NOTICE_ATTACHMENT_BUCKET = "notice-attachments";
export const NOTICE_ATTACHMENT_MAX_BYTES = 15 * 1024 * 1024;
export const NOTICE_ATTACHMENT_ACCEPT = "image/*,.pdf,.hwp,.hwpx,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip";

const SAFE_MIME_TYPES = new Set([
  "application/pdf",
  "application/haansofthwp",
  "application/vnd.hancom.hwp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
  "text/plain",
  "application/zip",
  "application/x-zip-compressed",
]);

export function formatAttachmentSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)}KB`;
  return `${(n / (1024 * 1024)).toFixed(1)}MB`;
}

export function isNoticeImage(attachment) {
  return String(attachment?.mime_type || attachment?.type || "").startsWith("image/");
}

export function validateNoticeFiles(files, existingCount = 0) {
  const list = Array.from(files || []);
  if (existingCount + list.length > 10) return "첨부파일은 공지당 최대 10개까지 등록할 수 있습니다.";
  for (const file of list) {
    if (file.size > NOTICE_ATTACHMENT_MAX_BYTES) return `${file.name}: 파일 크기는 15MB 이하여야 합니다.`;
    if (!file.type.startsWith("image/") && !SAFE_MIME_TYPES.has(file.type)) {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!["hwp", "hwpx", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "pdf", "txt", "zip"].includes(ext)) {
        return `${file.name}: 지원하지 않는 파일 형식입니다.`;
      }
    }
  }
  return "";
}

function safeFileName(name) {
  const ext = String(name || "").split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10);
  return `${crypto.randomUUID()}${ext ? `.${ext.toLowerCase()}` : ""}`;
}

export async function uploadNoticeAttachments(supabase, noticeId, files) {
  const uploaded = [];
  if (!noticeId) throw new Error("공지를 먼저 저장한 뒤 파일을 첨부할 수 있습니다.");
  try {
    for (const file of Array.from(files || [])) {
      const path = `${noticeId}/${safeFileName(file.name)}`;
      const { error } = await supabase.storage
        .from(NOTICE_ATTACHMENT_BUCKET)
        .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
      if (error) throw error;
      uploaded.push({
        id: crypto.randomUUID(),
        path,
        name: file.name,
        mime_type: file.type || "application/octet-stream",
        size: file.size,
      });
    }
    return uploaded;
  } catch (error) {
    if (uploaded.length) {
      await supabase.storage.from(NOTICE_ATTACHMENT_BUCKET).remove(uploaded.map(item => item.path));
    }
    throw error;
  }
}

export async function deleteNoticeAttachments(supabase, attachments) {
  const paths = (attachments || []).map(item => item?.path).filter(Boolean);
  if (!paths.length) return;
  const { error } = await supabase.storage.from(NOTICE_ATTACHMENT_BUCKET).remove(paths);
  if (error) throw error;
}

export async function createNoticeAttachmentUrls(supabase, attachments) {
  const rows = await Promise.all((attachments || []).map(async attachment => {
    const { data, error } = await supabase.storage
      .from(NOTICE_ATTACHMENT_BUCKET)
      .createSignedUrl(attachment.path, 60 * 60);
    return { ...attachment, url: error ? "" : data?.signedUrl || "" };
  }));
  return rows;
}
