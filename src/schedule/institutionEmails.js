const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MAX_INVOICE_EMAILS = 8;

export function normalizeInvoiceEmails(list) {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const email = String(raw || "").trim();
    if (!email) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(email);
  }
  return out.slice(0, MAX_INVOICE_EMAILS);
}

export function invoiceEmailsDraft(list) {
  const emails = normalizeInvoiceEmails(list);
  return emails.length ? emails : [""];
}

export function validateInvoiceEmails(list) {
  const emails = normalizeInvoiceEmails(list);
  const invalid = (Array.isArray(list) ? list : [])
    .map((raw) => String(raw || "").trim())
    .filter(Boolean)
    .find((email) => !EMAIL_RE.test(email));
  if (invalid) return `"${invalid}"은(는) 올바른 이메일이 아닙니다.`;
  if (emails.length > MAX_INVOICE_EMAILS) return `이메일은 최대 ${MAX_INVOICE_EMAILS}개까지 등록할 수 있습니다.`;
  return "";
}
