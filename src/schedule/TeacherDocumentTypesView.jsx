import { useEffect, useState } from "react";
import { ChevronLeft, Pencil, Plus, Trash2 } from "lucide-react";
import {
  createTeacherDocumentType,
  deleteTeacherDocumentType,
  fetchTeacherDocumentTypes,
  teacherDocumentsErrorMessage,
  updateTeacherDocumentType,
} from "../teacherDocuments.js";
import { scheduleSupabase } from "./api.js";

export default function TeacherDocumentTypesView({ onBack }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [label, setLabel] = useState("");
  const [allowsCustomLabel, setAllowsCustomLabel] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await fetchTeacherDocumentTypes(scheduleSupabase));
    } catch (err) {
      setRows([]);
      alert(teacherDocumentsErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setEditing(null);
    setLabel("");
    setAllowsCustomLabel(false);
  };

  const startEdit = (row) => {
    setEditing(row);
    setLabel(row.label || "");
    setAllowsCustomLabel(Boolean(row.allows_custom_label));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    const name = label.trim();
    if (!name) return alert("서류 종류 이름을 입력해 주세요.");
    setSaving(true);
    try {
      if (editing?.id) {
        await updateTeacherDocumentType(scheduleSupabase, editing.id, {
          label: name,
          allows_custom_label: allowsCustomLabel,
        });
      } else {
        await createTeacherDocumentType(scheduleSupabase, {
          label: name,
          allowsCustomLabel,
        });
      }
      resetForm();
      await load();
    } catch (err) {
      alert(teacherDocumentsErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (row) => {
    setSaving(true);
    try {
      await updateTeacherDocumentType(scheduleSupabase, row.id, { is_active: !row.is_active });
      await load();
    } catch (err) {
      alert(teacherDocumentsErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`“${row.label}” 종류를 삭제할까요?\n이미 올라간 서류가 있으면 삭제 대신 비활성화해 주세요.`)) return;
    setSaving(true);
    try {
      await deleteTeacherDocumentType(scheduleSupabase, row.id);
      if (editing?.id === row.id) resetForm();
      await load();
    } catch (err) {
      const msg = teacherDocumentsErrorMessage(err);
      if (/비활성화해 주세요/.test(msg)) {
        if (window.confirm(`${msg}\n지금 비활성화할까요?`)) {
          await updateTeacherDocumentType(scheduleSupabase, row.id, { is_active: false });
          await load();
        }
      } else {
        alert(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  const move = async (row, direction) => {
    const ordered = [...rows];
    const index = ordered.findIndex((item) => item.id === row.id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= ordered.length) return;
    const swap = ordered[nextIndex];
    setSaving(true);
    try {
      await Promise.all([
        updateTeacherDocumentType(scheduleSupabase, row.id, { sort_order: swap.sort_order }),
        updateTeacherDocumentType(scheduleSupabase, swap.id, { sort_order: row.sort_order }),
      ]);
      await load();
    } catch (err) {
      alert(teacherDocumentsErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sch-view">
      <div className="sch-view-header">
        <button type="button" className="sch-back-btn" onClick={onBack}>
          <ChevronLeft size={18} /> 스케줄 홈
        </button>
        <h2 className="sch-view-title">서류 종류 관리</h2>
      </div>
      <p className="sch-muted">
        선생님이 내 정보에서 올리는 서류의 종류입니다. 이미 파일이 있는 종류는 삭제 대신 비활성화하세요.
      </p>

      <form className="sch-card" onSubmit={handleSave} style={{ marginBottom: 16 }}>
        <div className="sch-toolbar" style={{ alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
          <label className="sch-field">
            <span>{editing ? "이름 수정" : "새 종류"}</span>
            <input
              className="sch-input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="예: 주민등록등본"
              aria-label="서류 종류 이름"
            />
          </label>
          <label className="sch-field sch-field--inline" style={{ paddingBottom: 8 }}>
            <input
              type="checkbox"
              checked={allowsCustomLabel}
              onChange={(e) => setAllowsCustomLabel(e.target.checked)}
            />
            업로드 시 이름 직접 입력
          </label>
          <button type="submit" className="sch-btn sch-btn--primary" disabled={saving}>
            <Plus size={14} />
            {saving ? "저장 중..." : editing ? "수정 저장" : "종류 추가"}
          </button>
          {editing ? (
            <button type="button" className="sch-btn sch-btn--ghost" onClick={resetForm} disabled={saving}>
              취소
            </button>
          ) : null}
        </div>
      </form>

      {loading ? (
        <p className="sch-muted">불러오는 중...</p>
      ) : (
        <div className="sch-table-wrap">
          <table className="sch-table">
            <thead>
              <tr>
                <th>순서</th>
                <th>종류</th>
                <th>상태</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.id}>
                  <td>
                    <button type="button" className="sch-btn sch-btn--ghost" onClick={() => move(row, -1)} disabled={saving || index === 0}>위</button>
                    {" "}
                    <button type="button" className="sch-btn sch-btn--ghost" onClick={() => move(row, 1)} disabled={saving || index === rows.length - 1}>아래</button>
                  </td>
                  <td>
                    <strong>{row.label}</strong>
                    {row.allows_custom_label ? <span className="sch-muted"> · 이름 직접 입력</span> : null}
                  </td>
                  <td>{row.is_active ? "사용 중" : "비활성"}</td>
                  <td>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      <button type="button" className="sch-btn sch-btn--ghost" onClick={() => startEdit(row)} disabled={saving}>
                        <Pencil size={14} /> 이름
                      </button>
                      <button type="button" className="sch-btn sch-btn--ghost" onClick={() => toggleActive(row)} disabled={saving}>
                        {row.is_active ? "비활성화" : "다시 사용"}
                      </button>
                      <button type="button" className="sch-btn sch-btn--ghost" onClick={() => handleDelete(row)} disabled={saving}>
                        <Trash2 size={14} /> 삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
