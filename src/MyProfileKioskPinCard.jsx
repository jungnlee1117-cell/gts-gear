import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import FormField, { ProfileGrid } from "./MyProfileFormField.jsx";
import { invokeKiosk, KioskError } from "./kioskApi.js";

export default function MyProfileKioskPinCard({ supabase, teacherId, canEdit }) {
  const [hasPin, setHasPin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [currentPin, setCurrentPin] = useState("");
  const [nextPin, setNextPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!teacherId) return undefined;
    let cancelled = false;
    setLoading(true);
    invokeKiosk(supabase, "get_pin_status", { teacher_id: teacherId }, { withAuth: true })
      .then((data) => {
        if (!cancelled) setHasPin(Boolean(data?.has_kiosk_pin));
      })
      .catch(() => {
        if (!cancelled) setHasPin(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [supabase, teacherId]);

  const submit = async (e) => {
    e.preventDefault();
    if (!canEdit) return;
    setError("");
    if (!/^\d{4}$/.test(nextPin)) {
      setError("새 PIN은 숫자 4자리여야 합니다.");
      return;
    }
    if (nextPin !== confirmPin) {
      setError("새 PIN 확인이 일치하지 않습니다.");
      return;
    }
    if (hasPin && !/^\d{4}$/.test(currentPin)) {
      setError("현재 PIN을 입력해 주세요.");
      return;
    }
    setSaving(true);
    try {
      await invokeKiosk(supabase, "set_pin", {
        teacher_id: teacherId,
        pin: nextPin,
        current_pin: hasPin ? currentPin : undefined,
      }, { withAuth: true });
      setHasPin(true);
      setEditing(false);
      setCurrentPin("");
      setNextPin("");
      setConfirmPin("");
    } catch (err) {
      setError(err instanceof KioskError ? err.message : (err.message || "저장에 실패했습니다."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="my-profile-card">
      <div className="my-profile-section-head">
        <h2 className="my-profile-card-title">키오스크 PIN</h2>
        {canEdit && !editing ? (
          <button
            type="button"
            className="my-profile-btn-mint"
            onClick={() => setEditing(true)}
            aria-label="키오스크 PIN 설정"
          >
            <KeyRound size={14} strokeWidth={2.2} />
            {hasPin ? "변경하기" : "설정하기"}
          </button>
        ) : null}
      </div>
      <p className="my-profile-hint" style={{ marginTop: 0 }}>
        교구 키오스크에서 대여·반납할 때 사용하는 개인 4자리 PIN입니다. 숫자만 저장되며 원문은 서버에 보관되지 않습니다.
      </p>
      {loading ? (
        <p className="my-profile-muted">불러오는 중...</p>
      ) : !editing ? (
        <p className="my-profile-value" style={{ margin: 0 }}>
          {hasPin ? "PIN 설정됨" : "PIN 미설정 — 키오스크 사용 전 설정이 필요합니다"}
        </p>
      ) : (
        <form onSubmit={submit}>
          <ProfileGrid>
            {hasPin ? (
              <FormField label="현재 PIN" full>
                <input
                  className="my-profile-input"
                  inputMode="numeric"
                  maxLength={4}
                  value={currentPin}
                  onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  autoComplete="off"
                  aria-label="현재 PIN"
                />
              </FormField>
            ) : null}
            <FormField label="새 PIN (4자리)">
              <input
                className="my-profile-input"
                inputMode="numeric"
                maxLength={4}
                value={nextPin}
                onChange={(e) => setNextPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                autoComplete="off"
                aria-label="새 PIN"
              />
            </FormField>
            <FormField label="새 PIN 확인">
              <input
                className="my-profile-input"
                inputMode="numeric"
                maxLength={4}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                autoComplete="off"
                aria-label="새 PIN 확인"
              />
            </FormField>
          </ProfileGrid>
          {error ? <p className="my-profile-field-error" style={{ marginTop: 10 }}>{error}</p> : null}
          <div className="my-profile-actions">
            <button
              type="button"
              className="my-profile-btn-ghost"
              disabled={saving}
              onClick={() => {
                setEditing(false);
                setError("");
                setCurrentPin("");
                setNextPin("");
                setConfirmPin("");
              }}
            >
              취소
            </button>
            <button type="submit" className="my-profile-save" disabled={saving}>
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
