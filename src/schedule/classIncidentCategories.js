export const INCIDENT_CATEGORY = {
  schedule: "schedule",
  safety: "safety",
  institution_request: "institution_request",
  equipment_facility: "equipment_facility",
  other: "other",
};

export const INCIDENT_SUBTYPE = {
  substitute: "substitute",
  cancelled: "cancelled",
  time_change: "time_change",
  teacher_injured: "teacher_injured",
  child_injured: "child_injured",
  equipment_damaged: "equipment_damaged",
  equipment_broken: "equipment_broken",
  facility_damaged: "facility_damaged",
  other: "other",
};

export const INCIDENT_CATEGORY_LABEL = {
  schedule: "스케줄 관련",
  safety: "안전사고",
  institution_request: "원 요청",
  equipment_facility: "교구/시설 문제",
  other: "기타",
};

export const INCIDENT_SUBTYPE_LABEL = {
  substitute: "대강",
  cancelled: "휴강",
  time_change: "시간변경",
  teacher_injured: "선생님 다침",
  child_injured: "아이 다침",
  equipment_damaged: "교구 파손",
  equipment_broken: "교구 고장",
  facility_damaged: "시설 파손",
  other: "기타",
};

export const INCIDENT_CATEGORIES = [
  {
    value: INCIDENT_CATEGORY.schedule,
    label: INCIDENT_CATEGORY_LABEL.schedule,
    subtypes: [
      { value: INCIDENT_SUBTYPE.substitute, label: INCIDENT_SUBTYPE_LABEL.substitute },
      { value: INCIDENT_SUBTYPE.cancelled, label: INCIDENT_SUBTYPE_LABEL.cancelled },
      { value: INCIDENT_SUBTYPE.time_change, label: INCIDENT_SUBTYPE_LABEL.time_change },
    ],
  },
  {
    value: INCIDENT_CATEGORY.safety,
    label: INCIDENT_CATEGORY_LABEL.safety,
    urgent: true,
    subtypes: [
      { value: INCIDENT_SUBTYPE.teacher_injured, label: INCIDENT_SUBTYPE_LABEL.teacher_injured },
      { value: INCIDENT_SUBTYPE.child_injured, label: INCIDENT_SUBTYPE_LABEL.child_injured },
    ],
  },
  {
    value: INCIDENT_CATEGORY.institution_request,
    label: INCIDENT_CATEGORY_LABEL.institution_request,
    subtypes: [],
  },
  {
    value: INCIDENT_CATEGORY.equipment_facility,
    label: INCIDENT_CATEGORY_LABEL.equipment_facility,
    subtypes: [
      { value: INCIDENT_SUBTYPE.equipment_damaged, label: INCIDENT_SUBTYPE_LABEL.equipment_damaged },
      { value: INCIDENT_SUBTYPE.equipment_broken, label: INCIDENT_SUBTYPE_LABEL.equipment_broken },
      { value: INCIDENT_SUBTYPE.facility_damaged, label: INCIDENT_SUBTYPE_LABEL.facility_damaged },
      { value: INCIDENT_SUBTYPE.other, label: INCIDENT_SUBTYPE_LABEL.other },
    ],
  },
  {
    value: INCIDENT_CATEGORY.other,
    label: INCIDENT_CATEGORY_LABEL.other,
    subtypes: [],
  },
];

const GENERATED_BODIES = new Set([
  "대강",
  "시간변경",
  "교구 파손",
  "교구 고장",
  "시설 파손",
  "교구/시설 문제",
]);

export function emptyIncidentForm() {
  return {
    incident_category: "",
    incident_subtype: "",
    substitute_teacher_id: "",
    changed_start_time: "",
    changed_end_time: "",
    body: "",
  };
}

export function formFromIncidentReport(report) {
  if (!report) return emptyIncidentForm();
  const body = String(report.body || "").trim();
  return {
    incident_category: report.incident_category || "",
    incident_subtype: report.incident_subtype || "",
    substitute_teacher_id: report.substitute_teacher_id || "",
    changed_start_time: String(report.changed_start_time || "").slice(0, 5),
    changed_end_time: String(report.changed_end_time || "").slice(0, 5),
    body: GENERATED_BODIES.has(body) ? "" : body,
  };
}

export function incidentCategoryMeta(category) {
  return INCIDENT_CATEGORIES.find((item) => item.value === category) || null;
}

export function incidentNeedsSubtype(category) {
  const meta = incidentCategoryMeta(category);
  return Boolean(meta?.subtypes?.length);
}

export function incidentNeedsDetail(category, subtype) {
  if (!category) return true;
  if (category === INCIDENT_CATEGORY.schedule) {
    return subtype === INCIDENT_SUBTYPE.cancelled;
  }
  if (category === INCIDENT_CATEGORY.equipment_facility) {
    return subtype === INCIDENT_SUBTYPE.other;
  }
  return true;
}

export function incidentBodyPlaceholder(category, subtype) {
  if (category === INCIDENT_CATEGORY.schedule && subtype === INCIDENT_SUBTYPE.cancelled) {
    return "휴강 사유를 적어 주세요";
  }
  if (category === INCIDENT_CATEGORY.safety) {
    return "언제, 어디서, 어떻게 다쳤는지 적어 주세요";
  }
  if (category === INCIDENT_CATEGORY.institution_request) {
    return "원에서 요청한 내용을 적어 주세요";
  }
  if (category === INCIDENT_CATEGORY.equipment_facility && subtype === INCIDENT_SUBTYPE.other) {
    return "교구/시설 문제를 적어 주세요";
  }
  if (category === INCIDENT_CATEGORY.other) {
    return "특이사항을 적어 주세요";
  }
  return "상세 설명이 있으면 적어 주세요 (선택)";
}

export function isSafetyIncident(row) {
  return row?.incident_category === INCIDENT_CATEGORY.safety;
}

export function incidentCategoryLabel(category, subtype) {
  const cat = INCIDENT_CATEGORY_LABEL[category];
  const sub = INCIDENT_SUBTYPE_LABEL[subtype];
  if (cat && sub && sub !== cat) return `${cat} · ${sub}`;
  return cat || sub || "";
}

export function formatIncidentTimeRange(start, end) {
  const from = String(start || "").slice(0, 5);
  const to = String(end || "").slice(0, 5);
  if (from && to) return `${from}–${to}`;
  return from || to || "";
}

export function incidentStructuredSummary(row, { substituteName } = {}) {
  if (!row) return "";
  const name = substituteName
    || row.substitute_teacher?.name
    || "";
  if (row.incident_subtype === INCIDENT_SUBTYPE.substitute && name) {
    return `대신한 선생님: ${name}`;
  }
  if (row.incident_subtype === INCIDENT_SUBTYPE.time_change) {
    const range = formatIncidentTimeRange(row.changed_start_time, row.changed_end_time);
    return range ? `변경 시간 ${range}` : "";
  }
  return "";
}

export function formatIncidentPreview(row) {
  if (!row) return "";
  const label = incidentCategoryLabel(row.incident_category, row.incident_subtype);
  const extra = incidentStructuredSummary(row);
  const body = String(row.body || "").trim();
  const parts = [label, extra].filter(Boolean);
  if (body && !GENERATED_BODIES.has(body) && body !== label) {
    parts.push(body);
  } else if (!parts.length) {
    parts.push(body);
  }
  return parts.join(" · ");
}

export function buildIncidentPayload(form, { substituteName } = {}) {
  const incident_category = form.incident_category || null;
  const incident_subtype = incidentNeedsSubtype(incident_category)
    ? (form.incident_subtype || null)
    : null;
  const substitute_teacher_id = incident_subtype === INCIDENT_SUBTYPE.substitute
    ? (form.substitute_teacher_id || null)
    : null;
  const changed_start_time = incident_subtype === INCIDENT_SUBTYPE.time_change
    ? (form.changed_start_time || null)
    : null;
  const changed_end_time = incident_subtype === INCIDENT_SUBTYPE.time_change
    ? (form.changed_end_time || null)
    : null;
  let body = String(form.body || "").trim();
  if (!body) {
    if (incident_subtype === INCIDENT_SUBTYPE.substitute) {
      body = substituteName ? `대강 · ${substituteName}` : "대강";
    } else if (incident_subtype === INCIDENT_SUBTYPE.time_change) {
      const range = formatIncidentTimeRange(changed_start_time, changed_end_time);
      body = range ? `시간변경 · ${range}` : "시간변경";
    } else if (incident_category === INCIDENT_CATEGORY.equipment_facility) {
      body = INCIDENT_SUBTYPE_LABEL[incident_subtype] || "교구/시설 문제";
    }
  }
  return {
    incident_category,
    incident_subtype,
    substitute_teacher_id,
    changed_start_time,
    changed_end_time,
    body,
  };
}

export function isIncidentFormEmpty(form) {
  return !form?.incident_category && !String(form?.body || "").trim();
}

export function incidentFormEqualsReport(form, report) {
  const previous = formFromIncidentReport(report);
  return (
    (form?.incident_category || "") === previous.incident_category
    && (form?.incident_subtype || "") === previous.incident_subtype
    && (form?.substitute_teacher_id || "") === previous.substitute_teacher_id
    && (form?.changed_start_time || "") === previous.changed_start_time
    && (form?.changed_end_time || "") === previous.changed_end_time
    && String(form?.body || "").trim() === previous.body
  );
}

export function validateIncidentForm(form) {
  if (!form?.incident_category) return "카테고리를 선택해주세요.";
  if (incidentNeedsSubtype(form.incident_category) && !form.incident_subtype) {
    return "세부항목을 선택해주세요.";
  }
  if (form.incident_subtype === INCIDENT_SUBTYPE.substitute && !form.substitute_teacher_id) {
    return "대신한 선생님을 선택해주세요.";
  }
  if (form.incident_subtype === INCIDENT_SUBTYPE.time_change) {
    if (!form.changed_start_time || !form.changed_end_time) {
      return "변경된 시작·종료 시간을 입력해주세요.";
    }
    if (form.changed_start_time >= form.changed_end_time) {
      return "종료 시간은 시작 시간보다 늦어야 합니다.";
    }
  }
  if (incidentNeedsDetail(form.incident_category, form.incident_subtype)
      && !String(form.body || "").trim()) {
    return "상세 내용을 입력해주세요.";
  }
  return "";
}

export function sortIncidentRowsForAdmin(rows = []) {
  return [...(rows || [])].sort((a, b) => {
    const aSafety = isSafetyIncident(a) ? 0 : 1;
    const bSafety = isSafetyIncident(b) ? 0 : 1;
    if (aSafety !== bSafety) return aSafety - bSafety;
    const aPending = a.status === "needs_review" ? 0 : 1;
    const bPending = b.status === "needs_review" ? 0 : 1;
    if (aPending !== bPending) return aPending - bPending;
    const dateCmp = String(b.class_date || "").localeCompare(String(a.class_date || ""));
    if (dateCmp) return dateCmp;
    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
  });
}
