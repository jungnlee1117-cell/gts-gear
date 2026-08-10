/**
 * 지티(GiTi) — 로그인한 선생님의 GTS 앱 데이터를 조회해 시스템 컨텍스트로 만듭니다.
 */
import {
  assignedLetterForMonth,
  classifyCalendarWeek,
  enumerateMajorityMonthWeeks,
  findCurrentRotationWeekSlot,
  getWeekItemsForLetter,
  rotationWeekRangeForSlot,
  yearMonthKey as gearYearMonthKey,
} from "../itemRotation.js";
import { fetchMyNoticeReadIds } from "../noticeReads.js";
import { resolveTeacherMonthlyGross } from "../schedule/additionalPayments.js";
import {
  DAY_LABELS,
  EXCEPTION_LABELS,
  formatWon,
  yearMonthFirstDay,
  yearMonthKey,
  yearMonthLastDay,
  fmtLocalDate,
} from "../schedule/constants.js";
import {
  syncScheduleAuthSession,
  fetchInstitutions,
  fetchWeeklySchedule,
  fetchHomeVisitPatterns,
  fetchPayrollEntries,
  fetchPayRates,
  fetchAdditionalPayments,
  fetchScheduleExceptions,
  scheduleSupabase,
} from "../schedule/api.js";
import {
  countUnconfirmedDays,
  confirmedEntries,
  expandMonthSchedule,
} from "../schedule/payrollCalendar.js";
import { patternsForCalendarMonth } from "../schedule/homeVisitPatterns.js";
import { estimateTeacherPayByEntry } from "../schedule/settlement.js";
import { filterExceptionsForMonth } from "../schedule/scheduleExceptions.js";
import { fetchTeacherGearExtras, buildCurrentRentals, formatShortDate } from "../teacherGearStatus.js";
import {
  DEFAULT_GEAR_CATEGORIES,
  categoriesToMap,
  getCategoryMeta,
  mergeCategoriesWithDefaults,
  normalizeCategoryKey,
} from "../gearCategoryData.js";

const ROLE_LABEL = {
  teacher: "선생님",
  admin: "관리자",
  superadmin: "슈퍼관리자",
};

function parseLocalDay(value) {
  if (!value) return null;
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return null;
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

function daysUntilDue(dueDate) {
  const due = parseLocalDay(dueDate);
  if (!due) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((due - today) / 86400000);
}

function dDayLabel(diff) {
  if (diff === null) return "-";
  if (diff < 0) return `D+${Math.abs(diff)} (연체)`;
  if (diff === 0) return "D-Day (오늘 반납)";
  return `D-${diff}`;
}

function formatTime(t) {
  if (!t) return "";
  return String(t).slice(0, 5);
}

function gearDisplayFromWeek(gear) {
  if (!gear) return null;
  if (gear.merged) return gear.item_name;
  if (gear.parts?.length) {
    return gear.parts.map((p) => `${p.label}: ${p.name}`).join(" / ");
  }
  return gear.item_name || null;
}

function weekItemsByTarget(weeklyLists, letter, weekNumber) {
  const gear = getWeekItemsForLetter(weeklyLists, letter, weekNumber);
  if (!gear) return { kindergarten: null, daycare: null };
  if (gear.merged) {
    return { kindergarten: gear.item_name, daycare: gear.item_name };
  }
  const kg = gear.parts?.find((p) => p.label === "유치원")?.name || null;
  const dc = gear.parts?.find((p) => p.label === "어린이집")?.name || null;
  return {
    kindergarten: kg || (gear.item_name && !dc ? gear.item_name : null),
    daycare: dc || null,
  };
}

function settled(value, fallback = null) {
  return value?.status === "fulfilled" ? value.value : fallback;
}

function withQueryTimeout(promise, label, ms = 4000) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`[giti] ${label} timeout ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** 채팅 열자마자 바로 넣을 최소 컨텍스트 (DB 대기 전) */
export function buildGitiMinimalContext(me) {
  if (!me?.id) return "";
  const role = ROLE_LABEL[me.role] || me.role || "선생님";
  return [
    "## 현재 로그인한 선생님 실시간 앱 데이터",
    "[GITI_LIVE_DATA_ATTACHED=true]",
    `조회 시각: ${new Date().toLocaleString("ko-KR")} (기본 정보)`,
    "상세 교구·스케줄·급여는 곧 이어서 갱신됩니다. '연동되지 않았다'고 말하지 마세요.",
    "",
    "### 선생님 기본 정보",
    `- 이름: ${me.name || "(이름 없음)"}`,
    `- 역할: ${role} (${me.role || "teacher"})`,
    `- teacher_id: ${me.id}`,
  ].join("\n");
}

async function fetchActiveRentals(supabase, teacherId) {
  const { data: reqs, error: reqErr } = await supabase
    .from("rental_requests")
    .select("id, teacher_id, dispatch_start, dispatch_end, dispatch_location, status")
    .eq("teacher_id", teacherId);
  if (reqErr) throw reqErr;
  const reqIds = (reqs || []).map((r) => r.id);
  if (!reqIds.length) return [];

  const [risRes, itemsRes] = await Promise.all([
    supabase
      .from("rental_items")
      .select("id, request_id, item_id, quantity, status, due_date, approved_at, created_at")
      .in("request_id", reqIds)
      .in("status", ["rented", "partial_returned"]),
    supabase.from("items").select("id, name"),
  ]);

  const ris = risRes.error ? [] : risRes.data || [];
  const riIds = ris.map((r) => r.id);
  let rets = [];
  if (riIds.length) {
    const { data, error } = await supabase
      .from("return_requests")
      .select("rental_item_id, quantity, status")
      .in("rental_item_id", riIds);
    if (!error) rets = data || [];
  }

  const items = itemsRes.error ? [] : itemsRes.data || [];
  return buildCurrentRentals({ id: teacherId }, reqs || [], ris, items, rets);
}

async function fetchTeacherNotices(supabase, teacherId) {
  const { data, error } = await supabase
    .from("notices")
    .select("id, title, body, content, created_at, audience_type, institution_id, institutions(id, name)")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) {
    const fallback = await supabase
      .from("notices")
      .select("id, title, body, content, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (fallback.error) throw fallback.error;
    return { notices: fallback.data || [], readIds: new Set() };
  }
  const notices = data || [];
  const readIds = await fetchMyNoticeReadIds(
    supabase,
    teacherId,
    notices.map((n) => n.id),
  );
  return { notices, readIds };
}

async function fetchTeacherScheduleChanges(teacherId, yearMonth) {
  const { data, error } = await scheduleSupabase
    .from("schedule_change_notifications")
    .select("*")
    .eq("teacher_id", teacherId)
    .gte("class_date", yearMonthFirstDay(yearMonth))
    .lte("class_date", yearMonthLastDay(yearMonth))
    .order("class_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw error;
  return data || [];
}

async function fetchAllCatalogItems(supabase) {
  const { data, error } = await supabase
    .from("items")
    .select("id, name, code, category")
    .order("name");
  if (error) throw error;
  return data || [];
}

async function fetchCatalogCategories(supabase) {
  const { data, error } = await supabase
    .from("gear_categories")
    .select("id, label, color, icon, sort_order")
    .order("sort_order", { ascending: true });
  if (error) {
    console.warn("[giti] gear_categories load failed, using defaults", error.message);
    return [...DEFAULT_GEAR_CATEGORIES];
  }
  return mergeCategoriesWithDefaults(data || []);
}

/** items → 카테고리별 이름 목록 */
function buildCatalogByCategory(items, categories) {
  const categoryMap = categoriesToMap(categories);
  const order = categories.map((c) => c.id);
  const orderIndex = new Map(order.map((id, i) => [id, i]));
  /** @type {Map<string, { key: string, label: string, names: string[] }>} */
  const groups = new Map();

  for (const item of items || []) {
    const name = String(item?.name || "").trim();
    if (!name) continue;
    const meta = getCategoryMeta(item.category, categoryMap);
    const key = normalizeCategoryKey(meta.key) || "ETC";
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: meta.label || key,
        names: [],
      });
    }
    const g = groups.get(key);
    if (!g.names.includes(name)) g.names.push(name);
  }

  for (const g of groups.values()) {
    g.names.sort((a, b) => a.localeCompare(b, "ko"));
  }

  return [...groups.values()].sort((a, b) => {
    const ai = orderIndex.has(a.key) ? orderIndex.get(a.key) : 999;
    const bi = orderIndex.has(b.key) ? orderIndex.get(b.key) : 999;
    if (ai !== bi) return ai - bi;
    return a.label.localeCompare(b.label, "ko");
  });
}

function formatContextText(ctx) {
  const lines = [];
  lines.push("## 현재 로그인한 선생님 실시간 앱 데이터");
  lines.push("[GITI_LIVE_DATA_ATTACHED=true]");
  lines.push(`조회 시각: ${ctx.loadedAt}`);
  lines.push("아래 데이터는 GTS 앱 DB에서 조회한 실제 값입니다. 개인 일정·교구·급여·공지 질문에는 반드시 이 데이터를 근거로 정확히 답하세요. 특정 항목이 비어 있으면 그 항목만 '앱에 등록된 정보가 없어요'라고 하세요. '연동되지 않았다'고 말하지 마세요.");
  lines.push("");

  const t = ctx.teacher;
  lines.push("### 선생님 기본 정보");
  lines.push(`- 이름: ${t.name}`);
  lines.push(`- 역할: ${t.roleLabel} (${t.role})`);
  lines.push(
    t.institutions.length
      ? `- 담당 기관: ${t.institutions.join(", ")}`
      : "- 담당 기관: (없음)",
  );
  lines.push("");

  const g = ctx.gear;
  lines.push(`### 이번 달 교구 배정 (${g.yearMonth})`);
  lines.push(`- 알파벳: ${g.letter || "(미배정)"}`);
  if (g.weeklyByWeek.length) {
    lines.push("- 주차별 교구:");
    for (const w of g.weeklyByWeek) {
      const kg = w.kindergarten || "-";
      const dc = w.daycare || "-";
      lines.push(
        `  · ${w.weekLabel}: 유치원 ${kg} / 어린이집 ${dc}${w.range ? ` (${w.range})` : ""}`,
      );
    }
  } else {
    lines.push("- 주차별 교구: (없음)");
  }
  lines.push(
    g.thisWeek
      ? `- 이번 주 교구 (${g.thisWeek.range || ""}): ${g.thisWeek.display || "(없음)"}`
      : "- 이번 주 교구: (해당 주차 없음)",
  );
  lines.push("");

  const catalog = ctx.catalog;
  lines.push("### GTS 전체 교구 목록 (items DB 실데이터)");
  if (!catalog?.total) {
    lines.push("- (조회된 교구 없음)");
  } else {
    lines.push(`- 총 ${catalog.total}개`);
    lines.push("- \"OO 교구 있어?\" / \"XX 있어?\" 질문은 이 목록만 기준으로 답하세요. 띄어쓰기·영문·약칭·유사 표기도 매칭하세요. 목록에 없으면 없다고 답하고, 비슷한 교구가 있으면 함께 제안하세요.");
    for (const group of catalog.groups) {
      lines.push(`#### ${group.label} (${group.key}) — ${group.names.length}개`);
      lines.push(`- ${group.names.join(", ")}`);
    }
  }
  lines.push("");

  lines.push("### 대여 중인 교구");
  if (!ctx.rentals.length) {
    lines.push("- (없음)");
  } else {
    for (const r of ctx.rentals) {
      lines.push(
        `- ${r.itemName} ×${r.quantity} · 반납예정 ${r.dueLabel} · ${r.dDay}`,
      );
    }
  }
  lines.push("");

  lines.push("### 수업 일정 (주간)");
  if (!ctx.schedule.weekly.length) {
    lines.push("- (등록된 주간 일정 없음)");
  } else {
    for (const s of ctx.schedule.weekly) {
      lines.push(
        `- ${s.dayLabel} ${s.time} · ${s.institution}${s.classType ? ` (${s.classType})` : ""}`,
      );
    }
  }
  lines.push(
    ctx.schedule.todayClasses.length
      ? `- 오늘 수업: 있음 — ${ctx.schedule.todayClasses.join(" / ")}`
      : "- 오늘 수업: 없음",
  );
  lines.push("");

  const p = ctx.payroll;
  lines.push(`### 급여 현황 (${p.yearMonth})`);
  lines.push(`- 확정된 수업 수: ${p.confirmedCount}건`);
  lines.push(`- 예상 급여(세전): ${p.expectedPayLabel}`);
  lines.push(`- 미확정 수업(일수): ${p.unconfirmedDays}일`);
  lines.push("");

  lines.push("### 공지사항");
  if (!ctx.notices.recent.length) {
    lines.push("- 최근 공지: (없음)");
  } else {
    lines.push("- 최근 공지:");
    for (const n of ctx.notices.recent) {
      lines.push(`  · [${n.read ? "읽음" : "안읽음"}] ${n.title} (${n.date})`);
      if (n.summary) lines.push(`    ${n.summary}`);
    }
  }
  lines.push(
    ctx.notices.unreadCount
      ? `- 읽지 않은 공지: ${ctx.notices.unreadCount}건`
      : "- 읽지 않은 공지: 없음",
  );
  lines.push("");

  lines.push(`### 이번 달 행사/휴원 (${ctx.events.yearMonth})`);
  if (!ctx.events.items.length) {
    lines.push("- (없음)");
  } else {
    for (const e of ctx.events.items) {
      lines.push(`- ${e.line}`);
    }
  }
  lines.push("");

  lines.push("### 최근 수업 변동");
  if (!ctx.changes.length) {
    lines.push("- (없음)");
  } else {
    for (const c of ctx.changes) {
      lines.push(`- ${c.line}`);
    }
  }

  return lines.join("\n");
}

/**
 * @param {{ me: object, session?: object, supabase: import("@supabase/supabase-js").SupabaseClient }} args
 */
export async function loadGitiTeacherContext({ me, session, supabase }) {
  const t0 = performance.now();
  console.log("[giti] loadGitiTeacherContext start", {
    teacherId: me?.id,
    teacherName: me?.name,
    hasSession: Boolean(session?.access_token),
    hasSupabase: Boolean(supabase),
  });

  if (!me?.id || !supabase) {
    console.warn("[giti] load aborted — missing me/supabase");
    return { text: "", data: null, error: "로그인이 필요해요." };
  }

  try {
    await withQueryTimeout(
      syncScheduleAuthSession(session),
      "syncScheduleAuthSession",
      3000,
    );
  } catch (err) {
    console.warn("[giti] schedule auth sync failed", err?.message || err);
  }

  const yearMonth = yearMonthKey();
  const today = new Date();
  const todayStr = fmtLocalDate(today);
  const todayDow = today.getDay();
  const [y, m] = yearMonth.split("-").map(Number);
  const monthStart = yearMonthFirstDay(yearMonth);
  const monthEnd = yearMonthLastDay(yearMonth);

  console.log("[giti] querying tables", {
    teacherId: me.id,
    yearMonth,
    tables: [
      "items (전체 교구 목록)",
      "gear_categories",
      "item_rotation_schedule",
      "item_weekly_lists",
      "item_rotation_month_weeks",
      "rental_requests/rental_items",
      "institution_weekly_schedule",
      "payroll_entries",
      "notices",
      "institution_schedule_exceptions",
      "schedule_change_notifications",
    ],
  });

  const settledAll = await Promise.allSettled([
    withQueryTimeout(fetchInstitutions({ teacherScope: true }).catch(() => []), "institutions"),
    withQueryTimeout(fetchTeacherGearExtras(supabase, me), "gearExtras"),
    withQueryTimeout(fetchActiveRentals(supabase, me.id), "rentals"),
    withQueryTimeout(fetchWeeklySchedule(null, me.id), "weeklySchedule"),
    withQueryTimeout(
      fetchHomeVisitPatterns({ teacherId: me.id, status: "active" }).catch(() => []),
      "homeVisits",
    ),
    withQueryTimeout(fetchPayrollEntries({ teacherId: me.id, yearMonth }), "payroll"),
    withQueryTimeout(fetchPayRates(me.id).catch(() => []), "payRates"),
    withQueryTimeout(
      fetchAdditionalPayments({ teacherId: me.id, yearMonth }).catch(() => []),
      "additionalPayments",
    ),
    withQueryTimeout(
      fetchScheduleExceptions(null, monthStart, monthEnd).catch(() => []),
      "exceptions",
    ),
    withQueryTimeout(fetchTeacherNotices(supabase, me.id), "notices"),
    withQueryTimeout(
      fetchTeacherScheduleChanges(me.id, yearMonth).catch(() => []),
      "scheduleChanges",
    ),
    withQueryTimeout(fetchAllCatalogItems(supabase), "catalogItems"),
    withQueryTimeout(fetchCatalogCategories(supabase), "catalogCategories"),
  ]);

  const labels = [
    "institutions",
    "gearExtras",
    "rentals",
    "weeklySchedule",
    "homeVisits",
    "payroll",
    "payRates",
    "additionalPayments",
    "exceptions",
    "notices",
    "scheduleChanges",
    "catalogItems",
    "catalogCategories",
  ];
  console.log(
    "[giti] query settled",
    labels.map((label, i) => ({
      label,
      status: settledAll[i].status,
      reason: settledAll[i].status === "rejected"
        ? String(settledAll[i].reason?.message || settledAll[i].reason)
        : undefined,
    })),
  );

  const institutions = settled(settledAll[0], []) || [];
  const gearExtras = settled(settledAll[1], {
    schedules: [],
    weeklyLists: [],
    monthWeeks: [],
    weeklySlots: [],
  });
  const rentalsRaw = settled(settledAll[2], []) || [];
  const weeklySlots = settled(settledAll[3], []) || [];
  const homeVisitPatterns = settled(settledAll[4], []) || [];
  const payrollEntries = settled(settledAll[5], []) || [];
  const rates = settled(settledAll[6], []) || [];
  const additionalPayments = settled(settledAll[7], []) || [];
  const exceptions = settled(settledAll[8], []) || [];
  const noticeBundle = settled(settledAll[9], { notices: [], readIds: new Set() });
  const changesRaw = settled(settledAll[10], []) || [];
  const catalogItems = settled(settledAll[11], []) || [];
  const catalogCategories = settled(settledAll[12], DEFAULT_GEAR_CATEGORIES) || DEFAULT_GEAR_CATEGORIES;
  const catalogGroups = buildCatalogByCategory(catalogItems, catalogCategories);
  const catalogTotal = catalogGroups.reduce((s, g) => s + g.names.length, 0);

  console.log("[giti] gear raw", {
    teacherId: me.id,
    rotationRows: (gearExtras.schedules || []).length,
    weeklyListRows: (gearExtras.weeklyLists || []).length,
    monthWeekRows: (gearExtras.monthWeeks || []).length,
    rotationSample: (gearExtras.schedules || []).slice(0, 3),
    weeklyListSample: (gearExtras.weeklyLists || []).slice(0, 3).map((w) => ({
      letter: w.letter,
      week_number: w.week_number,
      target_type: w.target_type,
      item_name: w.item_name,
    })),
  });
  console.log("[giti] catalog items", {
    total: catalogTotal,
    categories: catalogGroups.map((g) => ({
      key: g.key,
      label: g.label,
      count: g.names.length,
      sample: g.names.slice(0, 5),
    })),
  });

  const institutionNames = [...new Set(
    (institutions || []).map((i) => i.name).filter(Boolean),
  )];

  const letter = assignedLetterForMonth(
    gearExtras.schedules || [],
    me,
    gearYearMonthKey(today),
  );
  const classified = classifyCalendarWeek(today);
  let monthWeeks = (gearExtras.monthWeeks || []).filter((w) =>
    String(w.year_month || "").startsWith(yearMonth),
  );
  if (!monthWeeks.length) {
    // DB에 이번 달 주차 시드가 없으면 과반수 달 규칙으로 가상 주차 생성
    monthWeeks = enumerateMajorityMonthWeeks(y, m).map((w) => ({
      year_month: `${yearMonth}-01`,
      week_number: w.week_number,
      week_start_date: w.week_start_date,
      week_end_date: w.week_end_date,
      _synthetic: true,
    }));
    console.warn("[giti] month_weeks missing — using synthetic weeks", {
      yearMonth,
      syntheticCount: monthWeeks.length,
      classified,
    });
  }
  const weeklyByWeek = monthWeeks.map((w) => {
    const byTarget = letter
      ? weekItemsByTarget(gearExtras.weeklyLists, letter, w.week_number)
      : { kindergarten: null, daycare: null };
    return {
      weekNumber: w.week_number,
      weekLabel: `${w.week_number}주차`,
      range: rotationWeekRangeForSlot(w),
      ...byTarget,
    };
  });

  const currentSlot = findCurrentRotationWeekSlot(gearExtras.monthWeeks || [], today);
  let thisWeek = null;
  let matchedRows = [];
  if (currentSlot && letter) {
    const lists = gearExtras.weeklyLists || [];
    matchedRows = lists.filter(
      (w) =>
        String(w.letter || "").trim().toUpperCase() === String(letter).trim().toUpperCase()
        && Number(w.week_number) === Number(currentSlot.week_number),
    );
    const gear = getWeekItemsForLetter(lists, letter, currentSlot.week_number);
    thisWeek = {
      weekNumber: currentSlot.week_number,
      range: rotationWeekRangeForSlot(currentSlot),
      display: gearDisplayFromWeek(gear),
      syntheticSlot: Boolean(currentSlot._synthetic),
    };
  }

  console.log("[giti] gear week resolve", {
    today: todayStr,
    yearMonth,
    letter,
    classified: {
      yearMonth: classified.yearMonth,
      weekNumber: classified.weekNumber,
      label: classified.label,
      range: `${classified.startYmd}~${classified.endYmd}`,
    },
    currentSlot: currentSlot
      ? {
          year_month: currentSlot.year_month,
          week_number: currentSlot.week_number,
          range: `${currentSlot.week_start_date}~${currentSlot.week_end_date}`,
          synthetic: Boolean(currentSlot._synthetic),
        }
      : null,
    weeklyListRows: (gearExtras.weeklyLists || []).length,
    matchedRows: matchedRows.map((w) => ({
      letter: w.letter,
      week_number: w.week_number,
      target_type: w.target_type,
      item_name: w.item_name,
    })),
    thisWeek,
    weeklyByWeek: weeklyByWeek.map((w) => ({
      week: w.weekNumber,
      kg: w.kindergarten,
      dc: w.daycare,
    })),
  });

  const rentals = rentalsRaw.map((r) => {
    const diff = daysUntilDue(r.dueDate);
    return {
      itemName: r.itemName,
      quantity: r.quantity,
      dueLabel: formatShortDate(r.dueDate),
      dDay: dDayLabel(diff),
      daysLeft: diff,
    };
  });

  const weekly = (weeklySlots || []).map((s) => ({
    dayOfWeek: s.day_of_week,
    dayLabel: DAY_LABELS[s.day_of_week] ?? String(s.day_of_week),
    time: `${formatTime(s.start_time)}–${formatTime(s.end_time)}`,
    institution: s.institutions?.name || "기관",
    classType: s.class_type || s.label || "",
  }));

  const monthHomeVisitPatterns = patternsForCalendarMonth(
    homeVisitPatterns,
    monthStart,
    monthEnd,
  );
  const scheduleByDate = expandMonthSchedule(
    weeklySlots,
    y,
    m - 1,
    exceptions,
    monthHomeVisitPatterns,
  );
  const todayPlanned = scheduleByDate[todayStr] || [];
  const todayClasses = todayPlanned.map((p) => {
    const name = p.institutionName || p.institution?.name || "수업";
    const time = p.startTime && p.endTime
      ? `${formatTime(p.startTime)}–${formatTime(p.endTime)}`
      : "";
    return time ? `${name} ${time}` : name;
  });

  // also surface weekly-slot today if expand returned empty (fallback)
  if (!todayClasses.length) {
    for (const s of weekly) {
      if (s.dayOfWeek === todayDow) {
        todayClasses.push(`${s.institution} ${s.time}`);
      }
    }
  }

  const confirmed = confirmedEntries(payrollEntries, me.id);
  const slotById = Object.fromEntries(
    (weeklySlots || []).filter((s) => s.id).map((s) => [s.id, s]),
  );
  const lessonPay = estimateTeacherPayByEntry(payrollEntries, rates, slotById, me.id);
  const expectedGross = resolveTeacherMonthlyGross(
    me.id,
    yearMonth,
    lessonPay,
    additionalPayments,
    me.name || "",
  );
  const unconfirmedDays = countUnconfirmedDays(scheduleByDate, payrollEntries, today);

  const allNotices = noticeBundle.notices || [];
  const readIds = noticeBundle.readIds || new Set();
  const unreadNotices = allNotices.filter((n) => !readIds.has(n.id));
  const recent = allNotices.slice(0, 3).map((n) => {
    const body = String(n.body || n.content || "").replace(/\s+/g, " ").trim();
    return {
      title: n.title || "(제목 없음)",
      date: formatShortDate(n.created_at),
      read: readIds.has(n.id),
      summary: body ? body.slice(0, 80) + (body.length > 80 ? "…" : "") : "",
    };
  });

  const myInstIds = new Set(
    [
      ...(institutions || []).map((i) => i.id),
      ...(weeklySlots || []).map((s) => s.institution_id),
    ].filter(Boolean),
  );
  const monthExceptions = filterExceptionsForMonth(exceptions, y, m - 1)
    .filter((ex) => !myInstIds.size || myInstIds.has(ex.institution_id))
    .map((ex) => {
      const inst = ex.institutions?.name || "기관";
      const type = EXCEPTION_LABELS[ex.exception_type] || ex.exception_type;
      const end = ex.end_date && ex.end_date !== ex.exception_date
        ? `~${ex.end_date}`
        : "";
      const note = ex.note?.trim() ? ` — ${ex.note.trim()}` : "";
      return {
        line: `${ex.exception_date}${end} · ${inst} · ${type}${note}`,
      };
    });

  const changes = (changesRaw || []).slice(0, 8).map((c) => {
    const type = c.change_type || "변경";
    const reason = c.change_reason ? ` · ${c.change_reason}` : "";
    const handling = c.actual_handling ? ` → ${c.actual_handling}` : "";
    return {
      line: `${c.class_date} · ${type}${handling}${reason}`,
    };
  });

  const data = {
    loadedAt: new Date().toLocaleString("ko-KR"),
    teacher: {
      name: me.name || "(이름 없음)",
      role: me.role || "teacher",
      roleLabel: ROLE_LABEL[me.role] || me.role || "선생님",
      institutions: institutionNames,
    },
    gear: {
      yearMonth,
      letter: letter || null,
      weeklyByWeek,
      thisWeek,
    },
    catalog: {
      total: catalogTotal,
      groups: catalogGroups,
    },
    rentals,
    schedule: {
      weekly,
      todayClasses,
      hasTodayClass: todayClasses.length > 0,
    },
    payroll: {
      yearMonth,
      confirmedCount: confirmed.length,
      expectedPay: expectedGross,
      expectedPayLabel: formatWon(expectedGross),
      unconfirmedDays,
    },
    notices: {
      recent,
      unreadCount: unreadNotices.length,
    },
    events: {
      yearMonth,
      items: monthExceptions,
    },
    changes,
  };

  const text = formatContextText(data);
  console.log("[giti] context ready", {
    ms: Math.round(performance.now() - t0),
    chars: text.length,
    letter: data.gear.letter,
    thisWeek: data.gear.thisWeek,
    weeklyByWeekCount: data.gear.weeklyByWeek.length,
    rentals: data.rentals.length,
    catalogTotal: data.catalog?.total || 0,
    catalogCategories: data.catalog?.groups?.length || 0,
    weeklySlots: data.schedule.weekly.length,
    todayClasses: data.schedule.todayClasses,
    payroll: data.payroll,
    notices: data.notices.recent.map((n) => n.title),
    preview: text.slice(0, 400),
  });

  return {
    text,
    data,
    error: null,
  };
}
