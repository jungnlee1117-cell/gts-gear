import { useEffect, useState } from "react";
import { Award, Briefcase, Plus } from "lucide-react";
import FormField, { EmptyState, ProfileGrid } from "./MyProfileFormField.jsx";

function formatDotDate(value) {
  if (!value) return "";
  const [y, m, d] = String(value).slice(0, 10).split("-");
  if (!y || !m) return "";
  return d ? `${y}.${m}.${d}` : `${y}.${m}`;
}

function formatMonth(value) {
  if (!value) return "";
  const [y, m] = String(value).slice(0, 7).split("-");
  if (!y || !m) return "";
  return `${y}.${m}`;
}

function emptyCert() {
  return { name: "", issuing_organization: "", acquired_date: "", note: "" };
}

function emptyCareer() {
  return {
    organization: "",
    role: "",
    start_date: "",
    end_date: "",
    is_current: false,
    note: "",
  };
}

function EntryModal({ title, children, onClose, onSubmit, saving }) {
  return (
    <div className="sch-modal-overlay" onClick={() => !saving && onClose()}>
      <div className="sch-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sch-modal-head">
          <h3>{title}</h3>
          <button type="button" className="sch-icon-btn" onClick={onClose} disabled={saving}>닫기</button>
        </div>
        <form onSubmit={onSubmit}>
          {children}
          <div className="my-profile-actions">
            <button type="submit" className="my-profile-save" disabled={saving}>
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function MyProfileCertificationsSection({ supabase, teacherId, canEdit }) {
  const [rows, setRows] = useState([]);
  const [editor, setEditor] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from("teacher_certifications")
      .select("id, teacher_id, name, issuing_organization, acquired_date, note")
      .eq("teacher_id", teacherId)
      .order("acquired_date", { ascending: false, nullsFirst: false });
    if (error) {
      if (!/schema cache|does not exist|42P01/i.test(error.message || "")) {
        console.warn("[teacher_certifications]", error.code || error.message);
      }
      setRows([]);
      return;
    }
    setRows(data || []);
  };

  useEffect(() => {
    if (!teacherId) return undefined;
    load();
    return undefined;
  }, [teacherId]);

  const save = async (e) => {
    e.preventDefault();
    if (!canEdit || !editor) return;
    if (!editor.name.trim()) return alert("자격증명을 입력해 주세요.");
    setSaving(true);
    try {
      const payload = {
        teacher_id: teacherId,
        name: editor.name.trim(),
        issuing_organization: editor.issuing_organization.trim() || null,
        acquired_date: editor.acquired_date || null,
        note: editor.note.trim() || null,
        updated_at: new Date().toISOString(),
      };
      const query = editor.id
        ? supabase.from("teacher_certifications").update(payload).eq("id", editor.id)
        : supabase.from("teacher_certifications").insert(payload);
      const { error } = await query;
      if (error) throw error;
      setEditor(null);
      await load();
    } catch (err) {
      alert(err.message || "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row) => {
    if (!canEdit) return;
    if (!confirm("이 자격증을 삭제할까요?")) return;
    const { error } = await supabase.from("teacher_certifications").delete().eq("id", row.id);
    if (error) return alert(error.message || "삭제에 실패했습니다.");
    await load();
  };

  return (
    <section className="my-profile-card">
      <div className="my-profile-section-head">
        <h2 className="my-profile-card-title">자격증</h2>
        {canEdit ? (
          <button type="button" className="my-profile-btn-mint" onClick={() => setEditor(emptyCert())} aria-label="자격증 추가">
            <Plus size={14} strokeWidth={2.2}/> 자격증 추가
          </button>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <EmptyState
          compact
          icon={Award}
          title="등록된 자격증이 없습니다."
          hint="자격증을 추가하여 관리해 보세요."
          actionLabel={canEdit ? "지금 등록하기 >" : undefined}
          onAction={canEdit ? () => setEditor(emptyCert()) : undefined}
        />
      ) : (
        <div className="my-profile-entry-list">
          {rows.map((row) => (
            <div key={row.id} className="my-profile-entry">
              <div>
                <div className="my-profile-entry-title">{row.name || "—"}</div>
                <div className="my-profile-entry-sub">
                  {[
                    row.issuing_organization,
                    formatDotDate(row.acquired_date) && `취득 ${formatDotDate(row.acquired_date)}`,
                  ].filter(Boolean).join(" · ") || "—"}
                </div>
              </div>
              {canEdit ? (
                <div className="my-profile-entry-actions">
                  <button type="button" className="my-profile-btn-ghost my-profile-btn-ghost--sm" onClick={() => setEditor({
                    ...row,
                    name: row.name || "",
                    issuing_organization: row.issuing_organization || "",
                    acquired_date: String(row.acquired_date || "").slice(0, 10),
                    note: row.note || "",
                  })}>
                    수정
                  </button>
                  <button type="button" className="my-profile-btn-ghost my-profile-btn-ghost--sm" onClick={() => remove(row)}>
                    삭제
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
      {editor ? (
        <EntryModal title={editor.id ? "자격증 수정" : "자격증 추가"} onClose={() => setEditor(null)} onSubmit={save} saving={saving}>
          <ProfileGrid>
            <FormField label="자격증명" full>
              <input className="my-profile-input" value={editor.name} onChange={(e) => setEditor((p) => ({ ...p, name: e.target.value }))} required />
            </FormField>
            <FormField label="발급기관">
              <input className="my-profile-input" value={editor.issuing_organization || ""} onChange={(e) => setEditor((p) => ({ ...p, issuing_organization: e.target.value }))} />
            </FormField>
            <FormField label="취득일">
              <input type="date" className="my-profile-input" value={editor.acquired_date || ""} onChange={(e) => setEditor((p) => ({ ...p, acquired_date: e.target.value }))} />
            </FormField>
            <FormField label="비고" full>
              <input className="my-profile-input" value={editor.note || ""} onChange={(e) => setEditor((p) => ({ ...p, note: e.target.value }))} />
            </FormField>
          </ProfileGrid>
        </EntryModal>
      ) : null}
    </section>
  );
}

export function MyProfileCareersSection({ supabase, teacherId, canEdit }) {
  const [rows, setRows] = useState([]);
  const [editor, setEditor] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from("teacher_careers")
      .select("id, teacher_id, organization, role, start_date, end_date, is_current, note")
      .eq("teacher_id", teacherId)
      .order("start_date", { ascending: false, nullsFirst: false });
    if (error) {
      if (!/schema cache|does not exist|42P01/i.test(error.message || "")) {
        console.warn("[teacher_careers]", error.code || error.message);
      }
      setRows([]);
      return;
    }
    setRows(data || []);
  };

  useEffect(() => {
    if (!teacherId) return undefined;
    load();
    return undefined;
  }, [teacherId]);

  const save = async (e) => {
    e.preventDefault();
    if (!canEdit || !editor) return;
    if (!editor.organization.trim()) return alert("기관/회사명을 입력해 주세요.");
    setSaving(true);
    try {
      const payload = {
        teacher_id: teacherId,
        organization: editor.organization.trim(),
        role: editor.role.trim() || null,
        start_date: editor.start_date || null,
        end_date: editor.is_current ? null : (editor.end_date || null),
        is_current: Boolean(editor.is_current),
        note: editor.note.trim() || null,
        updated_at: new Date().toISOString(),
      };
      const query = editor.id
        ? supabase.from("teacher_careers").update(payload).eq("id", editor.id)
        : supabase.from("teacher_careers").insert(payload);
      const { error } = await query;
      if (error) throw error;
      setEditor(null);
      await load();
    } catch (err) {
      alert(err.message || "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row) => {
    if (!canEdit) return;
    if (!confirm("이 경력을 삭제할까요?")) return;
    const { error } = await supabase.from("teacher_careers").delete().eq("id", row.id);
    if (error) return alert(error.message || "삭제에 실패했습니다.");
    await load();
  };

  return (
    <section className="my-profile-card">
      <div className="my-profile-section-head">
        <h2 className="my-profile-card-title">경력</h2>
        {canEdit ? (
          <button type="button" className="my-profile-btn-mint" onClick={() => setEditor(emptyCareer())} aria-label="경력 추가">
            <Plus size={14} strokeWidth={2.2}/> 경력 추가
          </button>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <EmptyState
          compact
          icon={Briefcase}
          title="등록된 경력이 없습니다."
          hint="경력을 추가하여 관리해 보세요."
          actionLabel={canEdit ? "지금 등록하기 >" : undefined}
          onAction={canEdit ? () => setEditor(emptyCareer()) : undefined}
        />
      ) : (
        <div className="my-profile-entry-list">
          {rows.map((row) => (
            <div key={row.id} className="my-profile-entry">
              <div>
                <div className="my-profile-entry-title">{row.organization || "—"}</div>
                <div className="my-profile-entry-sub">
                  {[
                    row.role,
                    `${formatMonth(row.start_date) || "—"} ~ ${row.is_current ? "현재" : (formatMonth(row.end_date) || "—")}`,
                  ].filter(Boolean).join(" · ")}
                </div>
              </div>
              {canEdit ? (
                <div className="my-profile-entry-actions">
                  <button type="button" className="my-profile-btn-ghost my-profile-btn-ghost--sm" onClick={() => setEditor({
                    ...row,
                    organization: row.organization || "",
                    role: row.role || "",
                    start_date: String(row.start_date || "").slice(0, 10),
                    end_date: String(row.end_date || "").slice(0, 10),
                    is_current: Boolean(row.is_current),
                    note: row.note || "",
                  })}>
                    수정
                  </button>
                  <button type="button" className="my-profile-btn-ghost my-profile-btn-ghost--sm" onClick={() => remove(row)}>
                    삭제
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
      {editor ? (
        <EntryModal title={editor.id ? "경력 수정" : "경력 추가"} onClose={() => setEditor(null)} onSubmit={save} saving={saving}>
          <ProfileGrid>
            <FormField label="기관/회사명" full>
              <input className="my-profile-input" value={editor.organization} onChange={(e) => setEditor((p) => ({ ...p, organization: e.target.value }))} required />
            </FormField>
            <FormField label="직책 또는 역할" full>
              <input className="my-profile-input" value={editor.role || ""} onChange={(e) => setEditor((p) => ({ ...p, role: e.target.value }))} />
            </FormField>
            <FormField label="시작일">
              <input type="date" className="my-profile-input" value={editor.start_date || ""} onChange={(e) => setEditor((p) => ({ ...p, start_date: e.target.value }))} />
            </FormField>
            <FormField label="종료일">
              <input
                type="date"
                className="my-profile-input"
                value={editor.end_date || ""}
                onChange={(e) => setEditor((p) => ({ ...p, end_date: e.target.value }))}
                disabled={Boolean(editor.is_current)}
              />
            </FormField>
            <label className="my-profile-agree my-profile-field--full">
              <input
                type="checkbox"
                checked={Boolean(editor.is_current)}
                onChange={(e) => setEditor((p) => ({ ...p, is_current: e.target.checked, end_date: e.target.checked ? "" : p.end_date }))}
              />
              <span>재직중</span>
            </label>
            <FormField label="비고" full>
              <input className="my-profile-input" value={editor.note || ""} onChange={(e) => setEditor((p) => ({ ...p, note: e.target.value }))} />
            </FormField>
          </ProfileGrid>
        </EntryModal>
      ) : null}
    </section>
  );
}
