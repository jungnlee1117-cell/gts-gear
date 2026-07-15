/**
 * 공지사항 읽음 확인 (notice_reads)
 */

/** 활성 수업 선생님만 (읽음 집계·목록용) */
export function activeAudienceTeachers(teachers = []) {
  return (teachers || []).filter(
    (t) => t.role === "teacher" && t.active !== false && !t.resigned_at,
  );
}

/**
 * 기관별 수신 선생님 id 맵 구축
 * @param {Record<string, string[]>} institutionTeacherMap
 */
export function resolveNoticeRecipientIds(notice, teachers = [], institutionTeacherMap = {}) {
  const type = notice?.audience_type
    || (notice?.institution_id ? "institution_teachers" : "all");
  const active = activeAudienceTeachers(teachers);

  if (type === "specific") {
    const set = new Set(notice?.audience_teacher_ids || []);
    return active.filter((t) => set.has(t.id)).map((t) => t.id);
  }

  if (type === "institution_teachers") {
    const instId = notice?.institution_id;
    const set = new Set(institutionTeacherMap[instId] || []);
    return active.filter((t) => set.has(t.id)).map((t) => t.id);
  }

  // all | teachers — 집계는 선생님 역할만
  return active.map((t) => t.id);
}

export async function fetchInstitutionTeacherIdMap(client, institutionIds = []) {
  const ids = [...new Set((institutionIds || []).filter(Boolean))];
  const map = {};
  ids.forEach((id) => { map[id] = []; });
  if (!ids.length) return map;

  const [assignmentsRes, weeklyRes] = await Promise.all([
    client
      .from("institution_teacher_assignments")
      .select("institution_id, teacher_id, role")
      .in("institution_id", ids)
      .eq("is_active", true),
    client
      .from("institution_weekly_schedule")
      .select("institution_id, teacher_id")
      .in("institution_id", ids)
      .not("teacher_id", "is", null),
  ]);

  const sets = Object.fromEntries(ids.map((id) => [id, new Set()]));

  for (const row of assignmentsRes.data || []) {
    if (!row.institution_id || !row.teacher_id) continue;
    if (row.role != null && row.role !== "teacher") continue;
    sets[row.institution_id]?.add(row.teacher_id);
  }
  for (const row of weeklyRes.data || []) {
    if (!row.institution_id || !row.teacher_id) continue;
    sets[row.institution_id]?.add(row.teacher_id);
  }

  for (const id of ids) {
    map[id] = [...(sets[id] || [])];
  }
  return map;
}

export async function fetchNoticeReads(client, noticeIds = []) {
  const ids = [...new Set((noticeIds || []).filter(Boolean))];
  if (!ids.length) return [];
  const { data, error } = await client
    .from("notice_reads")
    .select("id, notice_id, teacher_id, read_at")
    .in("notice_id", ids);
  if (error) {
    console.warn("[notice_reads] fetch failed", error.message);
    return [];
  }
  return data || [];
}

export async function fetchMyNoticeReadIds(client, teacherId, noticeIds = []) {
  if (!teacherId) return new Set();
  const ids = [...new Set((noticeIds || []).filter(Boolean))];
  if (!ids.length) return new Set();
  const { data, error } = await client
    .from("notice_reads")
    .select("notice_id")
    .eq("teacher_id", teacherId)
    .in("notice_id", ids);
  if (error) {
    console.warn("[notice_reads] my reads failed", error.message);
    return new Set();
  }
  return new Set((data || []).map((r) => r.notice_id));
}

export async function markNoticeAsRead(client, noticeId, teacherId) {
  if (!noticeId || !teacherId) return false;
  const { error } = await client.from("notice_reads").upsert(
    {
      notice_id: noticeId,
      teacher_id: teacherId,
      read_at: new Date().toISOString(),
    },
    { onConflict: "notice_id,teacher_id" },
  );
  if (error) {
    console.warn("[notice_reads] mark failed", error.message);
    return false;
  }
  return true;
}

/**
 * @returns {Map<string, { readIds: Set<string>, readCount: number, totalCount: number, recipientIds: string[] }>}
 */
export function buildNoticeReadStats(notices, teachers, reads, institutionTeacherMap = {}) {
  const readsByNotice = new Map();
  for (const row of reads || []) {
    if (!row.notice_id || !row.teacher_id) continue;
    if (!readsByNotice.has(row.notice_id)) readsByNotice.set(row.notice_id, new Set());
    readsByNotice.get(row.notice_id).add(row.teacher_id);
  }

  const stats = new Map();
  for (const notice of notices || []) {
    if (!notice?.id) continue;
    const recipientIds = resolveNoticeRecipientIds(notice, teachers, institutionTeacherMap);
    const recipientSet = new Set(recipientIds);
    const readIds = readsByNotice.get(notice.id) || new Set();
    const readAmongRecipients = [...readIds].filter((id) => recipientSet.has(id));
    stats.set(notice.id, {
      recipientIds,
      readIds: new Set(readAmongRecipients),
      readCount: readAmongRecipients.length,
      totalCount: recipientIds.length,
    });
  }
  return stats;
}

export function splitReadUnreadTeachers(teachers, recipientIds, readIds) {
  const byId = new Map((teachers || []).map((t) => [t.id, t]));
  const readSet = readIds instanceof Set ? readIds : new Set(readIds || []);
  const read = [];
  const unread = [];
  for (const id of recipientIds || []) {
    const t = byId.get(id) || { id, name: "알 수 없음" };
    if (readSet.has(id)) read.push(t);
    else unread.push(t);
  }
  read.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ko"));
  unread.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ko"));
  return { read, unread };
}
