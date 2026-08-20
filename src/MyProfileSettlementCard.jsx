import { useEffect, useState } from "react";
import { Eye, EyeOff, Lock, Pencil } from "lucide-react";
import { invokeTeacherHr, TeacherHrError } from "./teacherHr.js";
import { SETTLEMENT_REVEAL_TTL_MS, validateSettlementInput } from "../supabase/functions/teacher-hr/hrRules.js";
import FormField, { MaskedValue, ProfileGrid, ProfileValue } from "./MyProfileFormField.jsx";

function emptyForm(saved = {}) {
  return {
    bank_name: saved.bank_name || "",
    account_holder: saved.account_holder || "",
    account_number: "",
    resident_id: "",
  };
}

function hasSavedSettlement(saved) {
  return Boolean(
    saved?.has_account_number
    || saved?.has_resident_id
    || saved?.bank_name
    || saved?.account_holder,
  );
}

function sanitizeLooseNumber(value) {
  return String(value || "").replace(/[^\d-]/g, "");
}

function formatRemain(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function SettlementEditForm({
  saved,
  hasSaved,
  onCancel,
  onSave,
}) {
  const [form, setForm] = useState(() => emptyForm(saved));
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => (prev[key] ? { ...prev, [key]: "" } : prev));
    setSaveError("");
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaveError("");
    try {
      validateSettlementInput(
        hasSaved ? { teacher_id: true } : null,
        {
          bankName: form.bank_name,
          accountHolder: form.account_holder,
          accountNumber: form.account_number,
          residentId: form.resident_id,
        },
      );
    } catch (err) {
      const field = err.field || "_";
      setFieldErrors({ [field]: err.message || "입력값을 확인해 주세요." });
      return;
    }
    setSaving(true);
    try {
      await onSave(form);
    } catch (err) {
      if (err instanceof TeacherHrError && err.field) {
        setFieldErrors({ [err.field]: err.message });
      } else {
        setSaveError(err.message || "정산정보 저장에 실패했습니다. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <ProfileGrid>
        <FormField label="은행명" error={fieldErrors.bank_name}>
          <input
            className="my-profile-input"
            value={form.bank_name}
            onChange={(e) => setField("bank_name", e.target.value)}
            placeholder="예: 국민은행"
            autoComplete="off"
          />
        </FormField>
        <FormField label="예금주" error={fieldErrors.account_holder}>
          <input
            className="my-profile-input"
            value={form.account_holder}
            onChange={(e) => setField("account_holder", e.target.value)}
            autoComplete="off"
          />
        </FormField>
        <FormField label="계좌번호" error={fieldErrors.account_number}>
          <input
            className="my-profile-input"
            value={form.account_number}
            onChange={(e) => setField("account_number", sanitizeLooseNumber(e.target.value))}
            placeholder={saved.account_number_mask || "숫자만 입력"}
            inputMode="numeric"
            autoComplete="off"
          />
        </FormField>
        <FormField label="주민등록번호" error={fieldErrors.resident_id}>
          <input
            className="my-profile-input"
            value={form.resident_id}
            onChange={(e) => setField("resident_id", sanitizeLooseNumber(e.target.value))}
            placeholder={saved.resident_id_mask || "000000-0000000"}
            inputMode="numeric"
            autoComplete="off"
          />
        </FormField>
      </ProfileGrid>
      {saveError ? <p className="my-profile-field-error" style={{ marginTop: 10 }}>{saveError}</p> : null}
      <div className="my-profile-actions">
        <button type="button" className="my-profile-btn-ghost" onClick={onCancel} disabled={saving}>
          취소
        </button>
        <button type="submit" className="my-profile-save" disabled={saving}>
          {saving ? "저장 중..." : "저장"}
        </button>
      </div>
    </form>
  );
}

export default function MyProfileSettlementCard({
  supabase,
  teacherId,
  canEdit,
  canReveal,
  onSaved,
  editing: editingProp,
  onEditingChange,
}) {
  const [loading, setLoading] = useState(true);
  const [internalEditing, setInternalEditing] = useState(false);
  const editing = typeof editingProp === "boolean" ? editingProp : internalEditing;
  const setEditing = (next) => {
    if (typeof editingProp === "boolean") onEditingChange?.(next);
    else setInternalEditing(next);
  };
  const [loadError, setLoadError] = useState("");
  const [revealError, setRevealError] = useState("");
  const [revealing, setRevealing] = useState(false);
  const [revealed, setRevealed] = useState(null);
  const [revealedUntil, setRevealedUntil] = useState(0);
  const [remainMs, setRemainMs] = useState(0);
  const [saved, setSaved] = useState({
    bank_name: "",
    account_holder: "",
    account_number_mask: "",
    resident_id_mask: "",
    has_account_number: false,
    has_resident_id: false,
  });

  const hasSaved = hasSavedSettlement(saved);
  const hasSensitive = Boolean(saved.has_account_number || saved.has_resident_id);
  const showRevealed = Boolean(revealed && remainMs > 0);

  const clearReveal = () => {
    setRevealed(null);
    setRevealedUntil(0);
    setRemainMs(0);
    setRevealError("");
  };

  useEffect(() => {
    if (!teacherId) return undefined;
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    setEditing(false);
    clearReveal();
    invokeTeacherHr(supabase, "get_settlement", { teacher_id: teacherId })
      .then((data) => {
        if (cancelled) return;
        setSaved({
          bank_name: data.bank_name || "",
          account_holder: data.account_holder || "",
          account_number_mask: data.account_number_mask || "",
          resident_id_mask: data.resident_id_mask || "",
          has_account_number: Boolean(data.has_account_number),
          has_resident_id: Boolean(data.has_resident_id),
        });
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message || "정산정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [teacherId]);

  useEffect(() => {
    if (!revealedUntil) return undefined;
    const tick = () => {
      const left = revealedUntil - Date.now();
      if (left <= 0) {
        setRevealed(null);
        setRevealedUntil(0);
        setRemainMs(0);
        return;
      }
      setRemainMs(left);
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [revealedUntil]);

  const handleReveal = async () => {
    if (!canReveal || revealing) return;
    setRevealError("");
    setRevealing(true);
    try {
      const data = await invokeTeacherHr(supabase, "reveal_settlement", { teacher_id: teacherId });
      setRevealed({
        account_number: data.account_number || "",
        resident_id: data.resident_id || "",
      });
      setRevealedUntil(Date.now() + SETTLEMENT_REVEAL_TTL_MS);
      setRemainMs(SETTLEMENT_REVEAL_TTL_MS);
    } catch (err) {
      setRevealError(err.message || "정산정보를 확인할 수 없습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setRevealing(false);
    }
  };

  const handleSave = async (form) => {
    const data = await invokeTeacherHr(supabase, "upsert_settlement", {
      teacher_id: teacherId,
      bank_name: form.bank_name,
      account_holder: form.account_holder,
      account_number: form.account_number.trim() || undefined,
      resident_id: form.resident_id.trim() || undefined,
    });
    setSaved({
      bank_name: data.bank_name || form.bank_name,
      account_holder: data.account_holder || form.account_holder,
      account_number_mask: data.account_number_mask || "",
      resident_id_mask: data.resident_id_mask || "",
      has_account_number: Boolean(data.has_account_number),
      has_resident_id: Boolean(data.has_resident_id),
    });
    clearReveal();
    setEditing(false);
    onSaved?.();
  };

  if (loading) {
    return (
      <section className="my-profile-card">
        <h2 className="my-profile-card-title">급여 정산정보</h2>
        <p className="my-profile-muted" style={{ margin: "8px 0 0" }}>불러오는 중...</p>
      </section>
    );
  }

  const showForm = canEdit && editing;

  return (
    <section className="my-profile-card my-profile-card--secure">
      <div className="my-profile-section-head">
        <h2 className="my-profile-card-title">급여 정산정보</h2>
        {!showForm ? (
          <div className="my-profile-section-actions">
            {canReveal && hasSensitive ? (
              showRevealed ? (
                <button type="button" className="my-profile-btn-ghost" onClick={clearReveal} aria-label="정산정보 숨기기">
                  <EyeOff size={14} strokeWidth={2.2} />
                  숨기기 {formatRemain(remainMs)}
                </button>
              ) : (
                <button type="button" className="my-profile-btn-ghost" onClick={handleReveal} disabled={revealing} aria-label="정산정보 전체보기">
                  <Eye size={14} strokeWidth={2.2} />
                  {revealing ? "확인 중..." : "전체보기"}
                </button>
              )
            ) : null}
            {canEdit ? (
              <button
                type="button"
                className="my-profile-btn-mint"
                aria-label="정산정보 수정하기"
                onClick={() => {
                  clearReveal();
                  setEditing(true);
                }}
              >
                <Pencil size={14} strokeWidth={2.2} />
                수정하기
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {loadError ? <p className="my-profile-empty">{loadError}</p> : null}
      {revealError ? <p className="my-profile-field-error" style={{ marginBottom: 10 }}>{revealError}</p> : null}

      {!showForm ? (
        <ProfileGrid className="my-profile-settlement-read-grid">
          <FormField label="은행명">
            <ProfileValue>{saved.bank_name}</ProfileValue>
          </FormField>
          <FormField label="예금주">
            <ProfileValue>{saved.account_holder}</ProfileValue>
          </FormField>
          <FormField label="계좌번호">
            <MaskedValue
              value={showRevealed && revealed.account_number ? revealed.account_number : saved.account_number_mask}
              revealed={showRevealed && Boolean(revealed?.account_number)}
              locked={Boolean(saved.account_number_mask) && !(showRevealed && revealed?.account_number)}
            />
          </FormField>
          <FormField label="주민등록번호">
            <MaskedValue
              value={showRevealed && revealed.resident_id ? revealed.resident_id : saved.resident_id_mask}
              revealed={showRevealed && Boolean(revealed?.resident_id)}
              locked={Boolean(saved.resident_id_mask) && !(showRevealed && revealed?.resident_id)}
            />
          </FormField>
        </ProfileGrid>
      ) : (
        <SettlementEditForm
          key={`${teacherId}-edit`}
          saved={saved}
          hasSaved={hasSaved}
          onCancel={() => setEditing(false)}
          onSave={handleSave}
        />
      )}
      <div className="my-profile-secure-banner">
        <Lock size={14} strokeWidth={2} />
        <span>정산정보는 암호화되어 안전하게 관리됩니다.</span>
      </div>
    </section>
  );
}
