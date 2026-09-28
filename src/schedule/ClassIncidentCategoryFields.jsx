import {
  INCIDENT_CATEGORIES,
  INCIDENT_CATEGORY,
  emptyIncidentForm,
  incidentBodyPlaceholder,
  incidentCategoryLabel,
  incidentCategoryMeta,
  incidentNeedsDetail,
  incidentNeedsSubtype,
  incidentStructuredSummary,
} from "./classIncidentCategories.js";

export function ClassIncidentCategoryBadge({ category, subtype }) {
  if (!category) return null;
  const safety = category === INCIDENT_CATEGORY.safety;
  return (
    <span className={`sch-incident-cat-badge${safety ? " sch-incident-cat-badge--safety" : ""}`}>
      {incidentCategoryLabel(category, subtype)}
    </span>
  );
}

export function ClassIncidentStructuredLine({ row }) {
  const extra = incidentStructuredSummary(row);
  if (!extra) return null;
  return <p className="sch-incident-structured">{extra}</p>;
}

export default function ClassIncidentCategoryFields({
  value,
  onChange,
  teachers = [],
  excludeTeacherId = "",
  disabled = false,
  bodyRows = 3,
}) {
  const form = value || emptyIncidentForm();
  const meta = incidentCategoryMeta(form.incident_category);
  const showSubtypes = incidentNeedsSubtype(form.incident_category);
  const showBody = Boolean(form.incident_category)
    && (!showSubtypes || Boolean(form.incident_subtype));
  const bodyRequired = incidentNeedsDetail(form.incident_category, form.incident_subtype);
  const teacherChoices = (teachers || []).filter((teacher) => teacher.id !== excludeTeacherId);

  const patch = (next) => onChange?.({ ...form, ...next });

  return (
    <div className="sch-incident-category-fields">
      <div className="sch-field">
        <span>카테고리</span>
        <div className="sch-chip-row">
          {INCIDENT_CATEGORIES.map((item) => (
            <button
              key={item.value}
              type="button"
              className={`sch-chip${form.incident_category === item.value ? " active" : ""}${item.urgent ? " sch-chip--danger" : ""}`}
              disabled={disabled}
              onClick={() => patch({
                incident_category: item.value,
                incident_subtype: item.subtypes.length === 0 ? "" : (
                  form.incident_category === item.value ? form.incident_subtype : ""
                ),
                substitute_teacher_id: "",
                changed_start_time: "",
                changed_end_time: "",
              })}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {showSubtypes ? (
        <div className="sch-field">
          <span>세부항목</span>
          <div className="sch-chip-row">
            {meta.subtypes.map((item) => (
              <button
                key={item.value}
                type="button"
                className={`sch-chip${form.incident_subtype === item.value ? " active" : ""}${form.incident_category === INCIDENT_CATEGORY.safety ? " sch-chip--danger" : ""}`}
                disabled={disabled}
                onClick={() => patch({
                  incident_subtype: item.value,
                  substitute_teacher_id: item.value === "substitute" ? form.substitute_teacher_id : "",
                  changed_start_time: item.value === "time_change" ? form.changed_start_time : "",
                  changed_end_time: item.value === "time_change" ? form.changed_end_time : "",
                })}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {form.incident_subtype === "substitute" ? (
        <label className="sch-field">
          <span>대신한 선생님</span>
          <select
            className="sch-select"
            required
            disabled={disabled}
            value={form.substitute_teacher_id}
            onChange={(e) => patch({ substitute_teacher_id: e.target.value })}
          >
            <option value="">선택</option>
            {teacherChoices.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
            ))}
          </select>
        </label>
      ) : null}

      {form.incident_subtype === "time_change" ? (
        <div className="sch-time-row">
          <label className="sch-field">
            <span>새 시작시간</span>
            <input
              type="time"
              className="sch-input"
              required
              disabled={disabled}
              value={form.changed_start_time}
              onChange={(e) => patch({ changed_start_time: e.target.value })}
            />
          </label>
          <label className="sch-field">
            <span>새 종료시간</span>
            <input
              type="time"
              className="sch-input"
              required
              disabled={disabled}
              value={form.changed_end_time}
              onChange={(e) => patch({ changed_end_time: e.target.value })}
            />
          </label>
        </div>
      ) : null}

      {showBody ? (
        <label className="sch-field">
          <span>{bodyRequired ? "상세 설명" : "상세 설명 (선택)"}</span>
          <textarea
            className="sch-input sch-incident-textarea"
            rows={bodyRows}
            disabled={disabled}
            required={bodyRequired}
            value={form.body}
            onChange={(e) => patch({ body: e.target.value })}
            placeholder={incidentBodyPlaceholder(form.incident_category, form.incident_subtype)}
          />
        </label>
      ) : null}
    </div>
  );
}
