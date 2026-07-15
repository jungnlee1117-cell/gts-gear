/** 공지사항 수신 대상 */

export const NOTICE_AUDIENCE_OPTIONS = [
  { value: "all", label: "전체", hint: "슈퍼관리자 · 관리자 · 선생님 모두" },
  { value: "teachers", label: "선생님만", hint: "관리자 제외, 선생님만" },
  { value: "institution_teachers", label: "특정 기관 선생님만", hint: "선택한 기관의 수업 선생님만" },
  { value: "specific", label: "특정 선생님 지정", hint: "체크박스로 개별 선택" },
];

export const EMPTY_NOTICE_AUDIENCE = {
  audience_type: "all",
  institution_id: "",
  audience_teacher_ids: [],
};

export function noticeToAudience(notice) {
  const type = notice?.audience_type
    || (notice?.institution_id ? "institution_teachers" : "all");
  return {
    audience_type: type,
    institution_id: notice?.institution_id || "",
    audience_teacher_ids: Array.isArray(notice?.audience_teacher_ids)
      ? notice.audience_teacher_ids.filter(Boolean)
      : [],
  };
}

export function audienceLabel(notice, institutionName) {
  const type = notice?.audience_type
    || (notice?.institution_id ? "institution_teachers" : "all");
  if (type === "teachers") return "선생님만";
  if (type === "specific") {
    const n = Array.isArray(notice?.audience_teacher_ids)
      ? notice.audience_teacher_ids.length
      : 0;
    return n > 0 ? `지정 ${n}명` : "특정 선생님";
  }
  if (type === "institution_teachers") {
    return institutionName || notice?.institutions?.name || "기관 선생님";
  }
  return "전체";
}

export function audienceBadgeTone(notice) {
  const type = notice?.audience_type
    || (notice?.institution_id ? "institution_teachers" : "all");
  if (type === "all") return "global";
  if (type === "teachers") return "teachers";
  if (type === "specific") return "specific";
  return "institution";
}

/** 공지 저장용 수신/기관 필드 해석 */
export function resolveAudiencePersistFields(audience = {}, event = {}, kind = "normal") {
  const audience_type = audience.audience_type || "all";
  const audience_teacher_ids = audience_type === "specific"
    ? [...new Set((audience.audience_teacher_ids || []).filter(Boolean))]
    : [];

  let institution_id = null;
  if (audience_type === "institution_teachers") {
    institution_id = audience.institution_id || null;
  } else if (kind === "event") {
    institution_id = event.scope === "global"
      ? null
      : (event.institution_id || null);
  }

  return { audience_type, audience_teacher_ids, institution_id };
}

export function validateNoticeAudience(audience) {
  const type = audience?.audience_type || "all";
  if (type === "institution_teachers" && !audience?.institution_id) {
    return "수신 대상 기관을 선택하세요.";
  }
  if (type === "specific" && !(audience?.audience_teacher_ids || []).length) {
    return "수신할 선생님을 한 명 이상 선택하세요.";
  }
  return null;
}

export function selectableNoticeTeachers(teachers = []) {
  return (teachers || [])
    .filter((t) => t.role === "teacher" && t.active !== false && !t.resigned_at)
    .slice()
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ko"));
}
