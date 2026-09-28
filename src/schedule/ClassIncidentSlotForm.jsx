import { useEffect, useState } from "react";
import { fetchTeachers } from "./api.js";
import {
  CLASS_INCIDENT_STATUS,
  CLASS_INCIDENT_STATUS_LABEL,
  addClassIncidentReply,
  classIncidentErrorMessage,
  deleteClassIncidentReport,
  formatIncidentWhen,
  markClassIncidentReviewed,
  upsertClassIncidentReport,
} from "./classIncidentReports.js";
import {
  buildIncidentPayload,
  formFromIncidentReport,
  incidentFormEqualsReport,
  isIncidentFormEmpty,
  isSafetyIncident,
  validateIncidentForm,
} from "./classIncidentCategories.js";
import ClassIncidentCategoryFields, {
  ClassIncidentCategoryBadge,
  ClassIncidentStructuredLine,
} from "./ClassIncidentCategoryFields.jsx";
import { filterAssignableClassTeachers } from "./roles.js";

let assignableTeacherCache = null;
let assignableTeacherPromise = null;

function loadAssignableTeachers() {
  if (assignableTeacherCache) return Promise.resolve(assignableTeacherCache);
  if (!assignableTeacherPromise) {
    assignableTeacherPromise = fetchTeachers()
      .then((rows) => {
        assignableTeacherCache = filterAssignableClassTeachers(rows);
        return assignableTeacherCache;
      })
      .finally(() => { assignableTeacherPromise = null; });
  }
  return assignableTeacherPromise;
}

export function ClassIncidentStatusBadge({ status }) {
  const key = status === CLASS_INCIDENT_STATUS.reviewed ? "reviewed" : "needs_review";
  return (
    <span className={`sch-incident-badge sch-incident-badge--${key}`}>
      {CLASS_INCIDENT_STATUS_LABEL[key]}
    </span>
  );
}

export function ClassIncidentReplies({
  report,
  me,
  canReply,
  onChanged,
}) {
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const replies = report?.class_incident_replies || [];

  const handleReply = async (e) => {
    e?.preventDefault?.();
    const text = draft.trim();
    if (!text || !report?.id) return;
    setSaving(true);
    try {
      await addClassIncidentReply({
        report_id: report.id,
        author_id: me.id,
        body: text,
      });
      setDraft("");
      await onChanged?.();
    } catch (err) {
      alert(classIncidentErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sch-incident-thread">
      {replies.length ? (
        <ul className="sch-incident-replies">
          {replies.map((reply) => {
            const name = reply.teachers?.name || "작성자";
            const isAdminReply = reply.teachers?.role === "admin"
              || reply.teachers?.role === "superadmin"
              || reply.author_id !== report.teacher_id;
            return (
              <li
                key={reply.id}
                className={`sch-incident-reply${isAdminReply ? " sch-incident-reply--admin" : ""}`}
              >
                <div className="sch-incident-reply-meta">
                  <strong>{name}</strong>
                  {isAdminReply ? <span className="sch-incident-reply-tag">관리자</span> : null}
                  <span>{formatIncidentWhen(reply.created_at)}</span>
                </div>
                <p className="sch-incident-reply-body">{reply.body}</p>
              </li>
            );
          })}
        </ul>
      ) : null}
      {canReply && report?.id ? (
        <form className="sch-incident-reply-form" onSubmit={handleReply}>
          <textarea
            className="sch-input sch-incident-textarea"
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="답장을 입력하세요"
          />
          <button
            type="submit"
            className="sch-btn sch-btn--ghost sch-btn--sm"
            disabled={saving || !draft.trim()}
          >
            {saving ? "보내는 중..." : "답장"}
          </button>
        </form>
      ) : null}
    </div>
  );
}

export default function ClassIncidentSlotForm({
  entry,
  report,
  me,
  canEditBody = false,
  isAdmin = false,
  onChanged,
}) {
  const [form, setForm] = useState(() => formFromIncidentReport(report));
  const [teachers, setTeachers] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(formFromIncidentReport(report));
  }, [report?.id, report?.body, report?.incident_category, report?.incident_subtype, report?.substitute_teacher_id, report?.changed_start_time, report?.changed_end_time, entry?.id]);

  useEffect(() => {
    if (!canEditBody) return;
    let cancelled = false;
    loadAssignableTeachers()
      .then((rows) => {
        if (!cancelled) setTeachers(rows);
      })
      .catch(() => {
        if (!cancelled) setTeachers([]);
      });
    return () => { cancelled = true; };
  }, [canEditBody]);

  if (!entry?.id) return null;

  const handleSave = async (e) => {
    e?.preventDefault?.();
    setSaving(true);
    try {
      if (isIncidentFormEmpty(form)) {
        if (report?.id) {
          if (!confirm("이 특이사항을 삭제할까요?")) return;
          await deleteClassIncidentReport(report.id);
          await onChanged?.();
        }
        return;
      }
      const error = validateIncidentForm(form);
      if (error) {
        alert(error);
        return;
      }
      const substituteName = teachers.find((t) => t.id === form.substitute_teacher_id)?.name || "";
      const payload = buildIncidentPayload(form, { substituteName });
      await upsertClassIncidentReport({
        id: report?.id,
        payroll_entry_id: entry.id,
        teacher_id: entry.teacher_id || me.id,
        institution_id: entry.institution_id || null,
        class_date: entry.class_date,
        notify: {
          teacher_name: me?.name,
          institution_name: entry.institutions?.name,
        },
        ...payload,
      });
      await onChanged?.();
    } catch (err) {
      alert(classIncidentErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleReview = async () => {
    if (!report?.id) return;
    setSaving(true);
    try {
      await markClassIncidentReviewed(report.id, me.id);
      await onChanged?.();
    } catch (err) {
      alert(classIncidentErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sch-incident-slot">
      <div className="sch-incident-slot-head">
        <span className="sch-incident-slot-label">특이사항</span>
        {report ? (
          <>
            {isSafetyIncident(report) ? (
              <ClassIncidentCategoryBadge
                category={report.incident_category}
                subtype={report.incident_subtype}
              />
            ) : null}
            <ClassIncidentStatusBadge status={report.status} />
          </>
        ) : (
          <span className="sch-muted sch-incident-optional">선택</span>
        )}
      </div>
      {canEditBody ? (
        <form onSubmit={handleSave}>
          <ClassIncidentCategoryFields
            value={form}
            onChange={setForm}
            teachers={teachers}
            excludeTeacherId={entry.teacher_id || me?.id}
            bodyRows={2}
          />
          <div className="sch-incident-slot-actions">
            <button
              type="submit"
              className="sch-btn sch-btn--ghost sch-btn--sm"
              disabled={saving || incidentFormEqualsReport(form, report)}
            >
              {saving ? "저장 중..." : report ? "수정" : "남기기"}
            </button>
            {report?.id && isIncidentFormEmpty(form) ? (
              <span className="sch-muted">비우고 저장하면 삭제됩니다</span>
            ) : null}
          </div>
        </form>
      ) : report?.body ? (
        <>
          <ClassIncidentCategoryBadge
            category={report.incident_category}
            subtype={report.incident_subtype}
          />
          <ClassIncidentStructuredLine row={report} />
          <p className="sch-incident-body">{report.body}</p>
        </>
      ) : (
        <p className="sch-muted sch-incident-hint">특이사항 없음</p>
      )}
      {report ? (
        <ClassIncidentReplies
          report={report}
          me={me}
          canReply={Boolean(me?.id) && (canEditBody || isAdmin)}
          onChanged={onChanged}
        />
      ) : null}
      {isAdmin && report?.status === CLASS_INCIDENT_STATUS.needs_review ? (
        <button
          type="button"
          className="sch-btn sch-btn--primary sch-btn--sm"
          disabled={saving}
          onClick={handleReview}
        >
          확인함
        </button>
      ) : null}
    </div>
  );
}
