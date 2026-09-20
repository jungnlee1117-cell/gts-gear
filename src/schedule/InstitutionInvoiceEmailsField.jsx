import { Plus, Trash2 } from "lucide-react";
import { MAX_INVOICE_EMAILS } from "./institutionEmails.js";

export default function InstitutionInvoiceEmailsField({ values, onChange, disabled = false }) {
  const emails = Array.isArray(values) && values.length ? values : [""];

  const setAt = (index, next) => {
    onChange(emails.map((email, i) => (i === index ? next : email)));
  };
  const add = () => {
    if (emails.length >= MAX_INVOICE_EMAILS) return;
    onChange([...emails, ""]);
  };
  const remove = (index) => {
    if (emails.length <= 1) {
      onChange([""]);
      return;
    }
    onChange(emails.filter((_, i) => i !== index));
  };

  return (
    <div className="sch-field sch-invoice-emails">
      <span>이메일 주소</span>
      <p className="sch-muted sch-field-hint">세금계산서 발행용입니다. 보통 1곳이고, 필요하면 추가하세요.</p>
      {emails.map((email, index) => (
        <div key={index} className="sch-invoice-emails-row">
          <input
            type="email"
            className="sch-input"
            value={email}
            disabled={disabled}
            placeholder={`이메일 ${index + 1}`}
            aria-label={`이메일 ${index + 1}`}
            onChange={(e) => setAt(index, e.target.value)}
          />
          {emails.length > 1 ? (
            <button
              type="button"
              className="sch-btn sch-btn--ghost sch-btn--sm"
              disabled={disabled}
              onClick={() => remove(index)}
            >
              <Trash2 size={13} /> 삭제
            </button>
          ) : null}
        </div>
      ))}
      {emails.length < MAX_INVOICE_EMAILS ? (
        <button
          type="button"
          className="sch-btn sch-btn--ghost sch-btn--sm"
          disabled={disabled}
          onClick={add}
        >
          <Plus size={14} /> 이메일 추가
        </button>
      ) : null}
    </div>
  );
}
