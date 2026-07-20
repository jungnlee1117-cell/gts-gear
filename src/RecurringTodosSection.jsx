import { useCallback, useEffect, useMemo, useState } from "react";
import { isItemAdmin } from "./authRoles.js";
import { sendPushEvent } from "./pushNotifications.js";
import {
  TODO_AUDIENCE_OPTIONS,
  audienceTypeLabel,
  selectableTodoTeachers,
} from "./todoAudience.js";

/**
 * 슈퍼관리자 — 매달 반복 할 일 템플릿 CRUD
 * · 수정/삭제(비활성)는 템플릿만 변경. 이번 달 인스턴스는 유지, 다음 달부터 반영.
 */
export default function RecurringTodosSection({
  me,
  supabase,
  teachers,
  Btn,
  Modal,
  DS,
  card,
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null); // null | 'new' | row
  const [form, setForm] = useState(emptyForm());

  const teacherOptions = useMemo(
    () => (teachers || []).filter((t) => t?.active !== false),
    [teachers],
  );
  const singleAssigneeOptions = useMemo(
    () => teacherOptions.filter((t) => isItemAdmin(t) || t.role === "admin"),
    [teacherOptions],
  );
  const multiTeacherOptions = useMemo(
    () => selectableTodoTeachers(teachers),
    [teachers],
  );
  const superAdmins = useMemo(
    () => teacherOptions.filter((t) => t.role === "superadmin"),
    [teacherOptions],
  );
  const assigneeSelectPool = superAdmins.length ? superAdmins : (singleAssigneeOptions.length ? singleAssigneeOptions : teacherOptions);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("todo_recurrences")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) {
      console.warn("todo_recurrences load", error.message);
      setRows([]);
    } else {
      setRows(data || []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => {
    setForm(emptyForm());
    setEditing("new");
  };

  const openEdit = (row) => {
    const type = ["assignee", "all_teachers", "selected_teachers", "shared"].includes(row.audience_type)
      ? row.audience_type
      : "assignee";
    setForm({
      content: row.content || "",
      start_day: String(row.start_day ?? 1),
      end_day: String(row.end_day ?? 1),
      audience_type: type,
      assignee_id: row.assignee_id || "",
      teacher_ids: Array.isArray(row.teacher_ids) ? row.teacher_ids.filter(Boolean) : [],
      priority: row.priority || "important",
      active: row.active !== false,
    });
    setEditing(row);
  };

  const spawnThisMonth = async () => {
    const periodYm = kstYmNow();
    const result = await sendPushEvent(supabase, "todo_recurrence_spawn", { period_ym: periodYm });
    if (!result?.ok) {
      console.warn("spawn failed", result);
    }
    return result;
  };

  const handleSave = async () => {
    const content = form.content.trim();
    const startDay = Number(form.start_day);
    const endDay = Number(form.end_day);
    if (!content) return alert("내용을 입력하세요.");
    if (!Number.isInteger(startDay) || startDay < 1 || startDay > 31) {
      return alert("시작일은 1~31 사이여야 합니다.");
    }
    if (!Number.isInteger(endDay) || endDay < 1 || endDay > 31) {
      return alert("종료일은 1~31 사이여야 합니다.");
    }
    if (startDay > endDay) return alert("시작일은 종료일보다 클 수 없습니다.");
    if (form.audience_type === "assignee" && !form.assignee_id) {
      return alert("담당자를 선택하세요.");
    }
    if (form.audience_type === "selected_teachers" && !(form.teacher_ids || []).length) {
      return alert("선생님을 한 명 이상 선택하세요.");
    }

    const payload = {
      content,
      recurrence: "monthly",
      start_day: startDay,
      end_day: endDay,
      audience_type: form.audience_type,
      assignee_id: form.audience_type === "assignee" ? form.assignee_id : null,
      teacher_ids: form.audience_type === "selected_teachers"
        ? [...new Set((form.teacher_ids || []).filter(Boolean))]
        : [],
      priority: form.priority || "important",
      active: form.active !== false,
      updated_at: new Date().toISOString(),
    };

    setSaving(true);
    try {
      if (editing === "new") {
        const { error } = await supabase.from("todo_recurrences").insert({
          ...payload,
          created_by: me.id,
        });
        if (error) throw error;
      } else if (editing?.id) {
        const { error } = await supabase
          .from("todo_recurrences")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      }
      setEditing(null);
      await load();
      // 이번 달 인스턴스 보강(이미 있으면 skip). 수정 내용은 다음 달부터 적용.
      await spawnThisMonth();
      alert(
        editing === "new"
          ? "반복 할 일을 등록했습니다. 이번 달 인스턴스를 생성했습니다.\n(이후 수정은 다음 달부터 반영됩니다.)"
          : "템플릿을 수정했습니다.\n이미 만들어진 이번 달 할 일은 그대로 두고, 다음 달부터 새 설정이 적용됩니다.",
      );
    } catch (err) {
      alert(err?.message || "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (row) => {
    if (!row?.id) return;
    if (!confirm(`「${row.content}」을(를) 비활성화할까요?\n이번 달 할 일은 남고, 다음 달부터는 생성되지 않습니다.`)) {
      return;
    }
    const { error } = await supabase
      .from("todo_recurrences")
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("id", row.id);
    if (error) return alert(error.message || "비활성화 실패");
    await load();
  };

  const handleDelete = async (row) => {
    if (!row?.id) return;
    if (!confirm(
      `「${row.content}」템플릿을 완전히 삭제할까요?\n이번 달 이미 생성된 할 일 인스턴스는 그대로 남고, 다음 달부터는 더 이상 생성되지 않습니다.`,
    )) {
      return;
    }
    const { error } = await supabase.from("todo_recurrences").delete().eq("id", row.id);
    if (error) return alert(error.message || "삭제 실패");
    await load();
  };

  const audienceLabel = (row) => audienceTypeLabel(row.audience_type, {
    assigneeName: teacherOptions.find((t) => t.id === row.assignee_id)?.name,
    selectedCount: Array.isArray(row.teacher_ids) ? row.teacher_ids.length : 0,
  });

  const setAudienceType = (nextType) => {
    setForm((f) => ({
      ...f,
      audience_type: nextType,
      assignee_id: nextType === "assignee" ? f.assignee_id : "",
      teacher_ids: nextType === "selected_teachers" ? (f.teacher_ids || []) : [],
    }));
  };

  const toggleTeacherId = (id) => {
    setForm((f) => {
      const cur = new Set(f.teacher_ids || []);
      if (cur.has(id)) cur.delete(id);
      else cur.add(id);
      return { ...f, teacher_ids: [...cur] };
    });
  };

  return (
    <div className="admin-todo-table-card" style={{ marginTop: 16 }}>
      <div className="admin-todo-table-card__head">
        <div className="admin-todo-table-card__title-row">
          <span className="admin-todo-table-card__icon" aria-hidden>🔁</span>
          <h3 className="admin-todo-table-card__title">반복 할 일</h3>
          <span className="admin-todo-table-card__count">{rows.filter((r) => r.active).length}건</span>
        </div>
        <p style={{ margin: "0 0 12px", fontSize: 12, color: DS?.textSecondary || "#64748b", lineHeight: 1.5 }}>
          매달 자동 생성됩니다. 템플릿 수정·삭제는 다음 달부터 적용되고, 이번 달 인스턴스는 유지됩니다.
        </p>
        <Btn onClick={openNew}>+ 반복 할 일 등록</Btn>
      </div>

      {loading ? (
        <div style={{ padding: 12, color: "#94a3b8", fontSize: 13 }}>불러오는 중…</div>
      ) : rows.length === 0 ? (
        <div style={{ padding: 12, color: "#94a3b8", fontSize: 13 }}>등록된 반복 할 일이 없습니다.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map((row) => (
            <div
              key={row.id}
              style={{
                ...card,
                padding: "12px 14px",
                opacity: row.active ? 1 : 0.55,
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ minWidth: 0, flex: "1 1 200px" }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: "#0f172a" }}>
                  {row.content}
                  {!row.active ? (
                    <span style={{ marginLeft: 8, fontSize: 11, color: "#94a3b8" }}>비활성</span>
                  ) : null}
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                  매달 {row.start_day}일~{row.end_day}일 · {audienceLabel(row)} · {priorityLabel(row.priority)}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button type="button" className="admin-notice-action-btn" title="수정" onClick={() => openEdit(row)}>
                  ✏️
                </button>
                {row.active ? (
                  <button type="button" className="admin-notice-action-btn" title="비활성화" onClick={() => handleDeactivate(row)}>
                    ⏸
                  </button>
                ) : null}
                <button type="button" className="admin-notice-action-btn" title="삭제" onClick={() => handleDelete(row)}>
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing ? (
        <Modal
          title={editing === "new" ? "반복 할 일 등록" : "반복 할 일 수정"}
          onClose={() => setEditing(null)}
          center
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label style={labelStyle}>
              내용
              <input
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                style={inputStyle}
                placeholder="예: 세금계산서 발행"
              />
            </label>
            <div style={{ display: "flex", gap: 10 }}>
              <label style={{ ...labelStyle, flex: 1 }}>
                시작일(매월)
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={form.start_day}
                  onChange={(e) => setForm((f) => ({ ...f, start_day: e.target.value }))}
                  style={inputStyle}
                />
              </label>
              <label style={{ ...labelStyle, flex: 1 }}>
                종료일(매월)
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={form.end_day}
                  onChange={(e) => setForm((f) => ({ ...f, end_day: e.target.value }))}
                  style={inputStyle}
                />
              </label>
            </div>
            <div style={{ marginBottom: 4 }}>
              <span style={{ ...labelStyle, marginBottom: 8 }}>대상</span>
              <div className="notice-audience-radios" role="radiogroup" aria-label="담당자 대상">
                {TODO_AUDIENCE_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`notice-audience-radio${form.audience_type === opt.value ? " is-active" : ""}`}
                  >
                    <input
                      type="radio"
                      name="recurring-todo-audience"
                      value={opt.value}
                      checked={form.audience_type === opt.value}
                      onChange={() => setAudienceType(opt.value)}
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
              <p className="sch-muted" style={{ margin: "6px 0 0", fontSize: 12 }}>
                {TODO_AUDIENCE_OPTIONS.find((o) => o.value === form.audience_type)?.hint}
              </p>
            </div>
            {form.audience_type === "assignee" ? (
              <label style={labelStyle}>
                담당자
                <select
                  value={form.assignee_id}
                  onChange={(e) => setForm((f) => ({ ...f, assignee_id: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="">선택</option>
                  {assigneeSelectPool.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.role})</option>
                  ))}
                </select>
              </label>
            ) : null}
            {form.audience_type === "selected_teachers" ? (
              <div className="notice-audience-teachers" style={{ marginTop: 4 }}>
                <div className="notice-audience-teachers__count">
                  {(form.teacher_ids || []).length}명 선택됨
                </div>
                <div className="notice-audience-teachers__list">
                  {multiTeacherOptions.length === 0 ? (
                    <p className="sch-muted" style={{ margin: 0 }}>선택 가능한 선생님이 없습니다.</p>
                  ) : multiTeacherOptions.map((t) => (
                    <label key={t.id} className="notice-audience-teachers__item">
                      <input
                        type="checkbox"
                        checked={(form.teacher_ids || []).includes(t.id)}
                        onChange={() => toggleTeacherId(t.id)}
                      />
                      <span>{t.name || "이름 없음"}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
            <label style={labelStyle}>
              우선순위
              <select
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                style={inputStyle}
              >
                <option value="urgent">긴급</option>
                <option value="important">중요</option>
                <option value="normal">일반</option>
                <option value="low">낮음</option>
              </select>
            </label>
            {editing !== "new" ? (
              <label style={{ ...labelStyle, flexDirection: "row", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                />
                활성 (끄면 다음 달부터 생성 안 함)
              </label>
            ) : null}
            <p style={{ margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
              저장 시 이번 달 인스턴스가 없으면 생성합니다. 내용·기간·대상 변경은 다음 달부터 적용됩니다.
            </p>
            <Btn full onClick={handleSave} disabled={saving}>
              {saving ? "저장 중…" : "저장"}
            </Btn>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

/** 선생님 — 나에게 배정된 할 일(반복 포함) 완료 */
export function MyAssignedTodosSection({
  me,
  todos,
  onToggle,
  DS,
  card,
}) {
  const mine = useMemo(() => {
    const now = Date.now();
    return (todos || [])
      .filter((t) => t.assignee_id === me?.id)
      .filter((t) => {
        if (t.is_completed && t.completed_at) {
          return now - new Date(t.completed_at).getTime() < 24 * 3600 * 1000;
        }
        return true;
      })
      .sort((a, b) => String(a.due_date || "").localeCompare(String(b.due_date || "")));
  }, [todos, me?.id]);

  if (!mine.length) return null;

  return (
    <div className="admin-todo-table-card" style={{ marginBottom: 18 }}>
      <div className="admin-todo-table-card__title-row" style={{ marginBottom: 12 }}>
        <span className="admin-todo-table-card__icon" aria-hidden>✓</span>
        <h3 className="admin-todo-table-card__title">내 할 일</h3>
        <span className="admin-todo-table-card__count">
          {mine.filter((t) => !t.is_completed).length}건
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {mine.map((t) => (
          <div
            key={t.id}
            style={{
              ...card,
              padding: "12px 14px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              opacity: t.is_completed ? 0.55 : 1,
            }}
          >
            <input
              type="checkbox"
              checked={!!t.is_completed}
              onChange={(e) => onToggle?.(t.id, e.target.checked)}
              aria-label="완료"
            />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                fontWeight: 700,
                fontSize: 14,
                textDecoration: t.is_completed ? "line-through" : "none",
                color: DS?.textPrimary || "#0f172a",
              }}>
                {t.content}
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                {t.start_date && t.due_date
                  ? `${String(t.start_date).slice(5)} ~ ${String(t.due_date).slice(5)}`
                  : (t.due_date ? `마감 ${t.due_date}` : "")}
                {t.recurrence_id ? " · 매달 반복" : ""}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function emptyForm() {
  return {
    content: "",
    start_day: "5",
    end_day: "10",
    audience_type: "assignee",
    assignee_id: "",
    teacher_ids: [],
    priority: "important",
    active: true,
  };
}

function priorityLabel(p) {
  if (p === "urgent") return "긴급";
  if (p === "important") return "중요";
  if (p === "low") return "낮음";
  return "일반";
}

function kstYmNow() {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
  });
  // en-CA gives YYYY-MM-DD; take YYYY-MM
  const parts = fmt.formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  return `${y}-${m}`;
}

const labelStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  fontSize: 13,
  fontWeight: 600,
  color: "#334155",
};

const inputStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  padding: "10px 12px",
  fontSize: 14,
  fontFamily: "inherit",
};
