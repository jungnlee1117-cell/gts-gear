/**
 * 지티 15일 리포트 — 집계 + Claude 개선 제안 + Apps Script(Docs) 저장 + 푸시
 *
 * Secrets:
 *   ANTHROPIC_API_KEY
 *   GITI_APPS_SCRIPT_URL          (Apps Script 웹앱 배포 URL)
 *   GITI_APPS_SCRIPT_SECRET       (선택 — Apps Script와 동일 토큰)
 *   GITI_REPORT_FOLDER_ID         (기본: 1uKmiizsoyteFx1wqOo__YwdT3AXwe-B0)
 *   SUPER_ADMIN_ID                (선택)
 *   SERVICE_ROLE_KEY / SUPABASE_URL (자동)
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_FOLDER_ID = "1uKmiizsoyteFx1wqOo__YwdT3AXwe-B0";
const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const CATEGORIES = ["수업운영", "아이대처", "교구활동", "영어표현", "이벤트", "기타"];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractBearerToken(authHeader: string | null) {
  if (!authHeader) return "";
  return authHeader.replace(/^Bearer\s+/i, "").trim();
}

function kstParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return {
    ymd: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    dow: weekdayMap[parts.weekday] ?? 0,
  };
}

function addDaysYmd(ymd: string, days: number) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function periodIsoRange(periodEndYmd: string, days = 15) {
  const periodStart = addDaysYmd(periodEndYmd, -(days - 1));
  const startIso = `${periodStart}T00:00:00+09:00`;
  const endIso = `${periodEndYmd}T23:59:59.999+09:00`;
  return { periodStart, periodEnd: periodEndYmd, startIso, endIso };
}

/**
 * Google Apps Script 웹앱으로 리포트 전송 → Docs 생성
 * Apps Script는 리다이렉트를 쓰므로 redirect: "follow" 유지
 */
async function createDocViaAppsScript(opts: {
  webAppUrl: string;
  secret?: string;
  folderId: string;
  title: string;
  bodyText: string;
  periodStart: string;
  periodEnd: string;
  summary: string;
  stats: unknown;
  suggestions: string;
}) {
  const payload = {
    secret: opts.secret || undefined,
    folderId: opts.folderId,
    title: opts.title,
    body: opts.bodyText,
    periodStart: opts.periodStart,
    periodEnd: opts.periodEnd,
    summary: opts.summary,
    suggestions: opts.suggestions,
    stats: opts.stats,
  };

  const res = await fetch(opts.webAppUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    redirect: "follow",
  });

  const raw = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`Apps Script non-JSON response (${res.status}): ${raw.slice(0, 200)}`);
  }

  if (!res.ok || data.ok === false) {
    throw new Error(String(data.error || data.message || `Apps Script error ${res.status}`));
  }

  const docId = String(data.docId || data.id || "");
  const docUrl = String(
    data.docUrl
      || data.url
      || (docId ? `https://docs.google.com/document/d/${docId}/edit` : ""),
  );
  if (!docId && !docUrl) {
    throw new Error("Apps Script response missing docId/docUrl");
  }

  return { id: docId || null, url: docUrl };
}

function aggregate(events: Array<Record<string, unknown>>, teacherNameById: Map<string, string>) {
  const totalQuestions = events.length;
  const byNorm = new Map<string, { question: string; count: number }>();
  const byCategory: Record<string, number> = Object.fromEntries(CATEGORIES.map((c) => [c, 0]));
  const byTeacher = new Map<string, number>();
  const byDow = Array.from({ length: 7 }, () => 0);
  const byHour = Array.from({ length: 24 }, () => 0);

  for (const e of events) {
    const norm = String(e.question_norm || e.question || "").trim();
    if (norm) {
      const prev = byNorm.get(norm);
      if (prev) prev.count += 1;
      else byNorm.set(norm, { question: String(e.question || norm).slice(0, 200), count: 1 });
    }
    const cat = String(e.category || "기타");
    byCategory[cat] = (byCategory[cat] || 0) + 1;

    const tid = String(e.teacher_id || "");
    if (tid) byTeacher.set(tid, (byTeacher.get(tid) || 0) + 1);

    const created = e.created_at ? new Date(String(e.created_at)) : null;
    if (created && !Number.isNaN(created.getTime())) {
      const k = kstParts(created);
      byDow[k.dow] += 1;
      byHour[k.hour] += 1;
    }
  }

  const topQuestions = [...byNorm.values()]
    .sort((a, b) => b.count - a.count || a.question.localeCompare(b.question, "ko"))
    .slice(0, 10)
    .map((r, i) => ({ rank: i + 1, question: r.question, count: r.count }));

  const teacherRanking = [...byTeacher.entries()]
    .map(([id, count]) => ({
      teacher_id: id,
      name: teacherNameById.get(id) || "(알 수 없음)",
      count,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ko"))
    .slice(0, 20)
    .map((r, i) => ({ ...r, rank: i + 1 }));

  const peakDow = byDow
    .map((count, dow) => ({ dow, label: DAY_LABELS[dow], count }))
    .sort((a, b) => b.count - a.count);
  const peakHour = byHour
    .map((count, hour) => ({ hour, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalQuestions,
    topQuestions,
    categoryDistribution: CATEGORIES.map((c) => ({
      category: c,
      count: byCategory[c] || 0,
      pct: totalQuestions ? Math.round(((byCategory[c] || 0) / totalQuestions) * 1000) / 10 : 0,
    })),
    teacherRanking,
    peakDays: peakDow.filter((d) => d.count > 0).slice(0, 3),
    peakHours: peakHour.filter((h) => h.count > 0).slice(0, 5),
    byDow: peakDow,
    byHour,
  };
}

function buildDocBody(stats: ReturnType<typeof aggregate>, periodStart: string, periodEnd: string, suggestions: string) {
  const lines: string[] = [];
  lines.push(`지티(GiTi) 사용 통계 리포트`);
  lines.push(`기간: ${periodStart} ~ ${periodEnd} (KST, 15일)`);
  lines.push(`생성: ${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}`);
  lines.push("");
  lines.push(`1. 총 질문 수`);
  lines.push(`- ${stats.totalQuestions}건`);
  lines.push("");
  lines.push(`2. 가장 많이 묻는 질문 TOP 10`);
  if (!stats.topQuestions.length) lines.push(`- (없음)`);
  else {
    for (const q of stats.topQuestions) {
      lines.push(`${q.rank}. (${q.count}회) ${q.question}`);
    }
  }
  lines.push("");
  lines.push(`3. 카테고리별 질문 분포`);
  for (const c of stats.categoryDistribution) {
    lines.push(`- ${c.category}: ${c.count}건 (${c.pct}%)`);
  }
  lines.push("");
  lines.push(`4. 선생님별 질문 횟수 순위`);
  if (!stats.teacherRanking.length) lines.push(`- (없음)`);
  else {
    for (const t of stats.teacherRanking) {
      lines.push(`${t.rank}. ${t.name}: ${t.count}회`);
    }
  }
  lines.push("");
  lines.push(`5. 질문이 많았던 요일/시간대`);
  lines.push(
    stats.peakDays.length
      ? `- 요일: ${stats.peakDays.map((d) => `${d.label}요일 ${d.count}건`).join(", ")}`
      : `- 요일: (없음)`,
  );
  lines.push(
    stats.peakHours.length
      ? `- 시간대: ${stats.peakHours.map((h) => `${h.hour}시 ${h.count}건`).join(", ")}`
      : `- 시간대: (없음)`,
  );
  lines.push("");
  lines.push(`6. Claude 개선 제안`);
  lines.push(suggestions || "(생성 실패)");
  lines.push("");
  return lines.join("\n");
}

function buildSummary(stats: ReturnType<typeof aggregate>) {
  const topCat = [...stats.categoryDistribution].sort((a, b) => b.count - a.count)[0];
  const topQ = stats.topQuestions[0];
  const topT = stats.teacherRanking[0];
  const bits = [
    `총 ${stats.totalQuestions}건`,
    topCat ? `최다 카테고리 ${topCat.category}(${topCat.count})` : null,
    topQ ? `TOP질문 「${topQ.question.slice(0, 40)}」` : null,
    topT ? `최다 이용 ${topT.name}(${topT.count})` : null,
  ].filter(Boolean);
  return bits.join(" · ");
}

async function askClaudeSuggestions(apiKey: string, stats: ReturnType<typeof aggregate>, periodStart: string, periodEnd: string) {
  const prompt = `당신은 GTS 영어체육 앱의 AI 어시스턴트 "지티" 개선 컨설턴트입니다.
아래 지난 15일(${periodStart}~${periodEnd}) 사용 통계를 보고, 서비스/프롬프트/기능 개선 제안을 한국어로 5~8개 bullet로 작성하세요.
구체적이고 실행 가능하게 쓰세요.

통계 JSON:
${JSON.stringify({
  totalQuestions: stats.totalQuestions,
  topQuestions: stats.topQuestions,
  categoryDistribution: stats.categoryDistribution,
  teacherRanking: stats.teacherRanking.slice(0, 10),
  peakDays: stats.peakDays,
  peakHours: stats.peakHours,
}, null, 2)}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || `Claude error ${res.status}`);
  }
  return (data?.content || [])
    .filter((b: { type?: string }) => b?.type === "text")
    .map((b: { text?: string }) => b.text)
    .join("\n")
    .trim();
}

async function getSuperAdminIds(client: ReturnType<typeof createClient>) {
  const superAdminEnvId = Deno.env.get("SUPER_ADMIN_ID") ?? "";
  const { data } = await client
    .from("teachers")
    .select("id")
    .eq("active", true)
    .eq("role", "superadmin");
  const ids = new Set((data || []).map((row: { id: string }) => row.id));
  if (superAdminEnvId) ids.add(superAdminEnvId);
  return [...ids];
}

async function notifySuperAdmins(
  supabaseUrl: string,
  serviceKey: string,
  payload: { doc_url: string; title: string; period_start: string; period_end: string },
) {
  const res = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      event: "giti_report_ready",
      payload,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.warn("[giti-report] push failed", data);
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SERVICE_ROLE_KEY") ?? "";
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
    const folderId = Deno.env.get("GITI_REPORT_FOLDER_ID") || DEFAULT_FOLDER_ID;
    const appsScriptUrl = (Deno.env.get("GITI_APPS_SCRIPT_URL") ?? "").trim();
    const appsScriptSecret = (Deno.env.get("GITI_APPS_SCRIPT_SECRET") ?? "").trim();

    if (!supabaseUrl || !serviceKey) {
      return jsonResponse({ error: "Supabase env missing" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    const bearer = extractBearerToken(authHeader);
    const apiKeyHeader = req.headers.get("apikey")?.trim() ?? "";
    const isServiceRole = bearer === serviceKey || apiKeyHeader === serviceKey;

    let body: { force?: boolean } = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const admin = createClient(supabaseUrl, serviceKey);

    if (!isServiceRole) {
      if (!authHeader) return jsonResponse({ error: "Unauthorized" }, 401);
      const userClient = createClient(
        supabaseUrl,
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: { user }, error: userError } = await userClient.auth.getUser();
      if (userError || !user) return jsonResponse({ error: "Unauthorized" }, 401);
      const { data: me } = await admin
        .from("teachers")
        .select("id, role")
        .eq("id", user.id)
        .maybeSingle();
      const envSuper = Deno.env.get("SUPER_ADMIN_ID") ?? "";
      const isSuper = me?.role === "superadmin" || (envSuper && user.id === envSuper);
      if (!isSuper) return jsonResponse({ error: "Forbidden" }, 403);
      body = { ...body, force: true };
    }

    const force = Boolean(body.force);

    if (!force) {
      const { data: latest } = await admin
        .from("giti_reports")
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latest?.created_at) {
        const ageMs = Date.now() - new Date(latest.created_at).getTime();
        if (ageMs < 14 * 24 * 60 * 60 * 1000) {
          return jsonResponse({
            skipped: true,
            reason: "Last report within 14 days",
            last_created_at: latest.created_at,
          });
        }
      }
    }

    const todayKst = kstParts().ymd;
    const { periodStart, periodEnd, startIso, endIso } = periodIsoRange(todayKst, 15);

    const { data: events, error: evErr } = await admin
      .from("giti_usage_events")
      .select("id, teacher_id, question, question_norm, category, created_at")
      .gte("created_at", startIso)
      .lte("created_at", endIso)
      .order("created_at", { ascending: false });
    if (evErr) throw new Error(evErr.message);

    const teacherIds = [...new Set((events || []).map((e) => e.teacher_id).filter(Boolean))];
    const teacherNameById = new Map<string, string>();
    if (teacherIds.length) {
      const { data: teachers } = await admin
        .from("teachers")
        .select("id, name")
        .in("id", teacherIds);
      for (const t of teachers || []) teacherNameById.set(t.id, t.name || "(이름 없음)");
    }

    const stats = aggregate(events || [], teacherNameById);

    let suggestions = "통계 기반 제안을 생성하지 못했습니다.";
    if (anthropicKey) {
      try {
        suggestions = await askClaudeSuggestions(anthropicKey, stats, periodStart, periodEnd);
      } catch (err) {
        console.warn("[giti-report] Claude suggestions failed", err);
        suggestions = `개선 제안 생성 실패: ${err instanceof Error ? err.message : String(err)}`;
      }
    } else {
      suggestions = "ANTHROPIC_API_KEY 미설정으로 개선 제안을 생략했습니다.";
    }

    const title = `지티리포트_${periodEnd}`;
    const docBody = buildDocBody(stats, periodStart, periodEnd, suggestions);
    const summary = buildSummary(stats);

    if (!appsScriptUrl) {
      const { data: row, error } = await admin
        .from("giti_reports")
        .insert({
          period_start: periodStart,
          period_end: periodEnd,
          title,
          summary: `${summary} (Apps Script URL 미설정 — Docs 미생성)`,
          stats,
          suggestions,
          google_doc_id: null,
          google_doc_url: null,
          drive_folder_id: folderId,
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return jsonResponse({
        ok: true,
        warning: "GITI_APPS_SCRIPT_URL missing — report saved without Drive doc",
        report: row,
      });
    }

    const doc = await createDocViaAppsScript({
      webAppUrl: appsScriptUrl,
      secret: appsScriptSecret || undefined,
      folderId,
      title,
      bodyText: docBody,
      periodStart,
      periodEnd,
      summary,
      stats,
      suggestions,
    });

    const { data: report, error: insErr } = await admin
      .from("giti_reports")
      .insert({
        period_start: periodStart,
        period_end: periodEnd,
        title,
        summary,
        stats,
        suggestions,
        google_doc_id: doc.id,
        google_doc_url: doc.url,
        drive_folder_id: folderId,
      })
      .select("*")
      .single();
    if (insErr) throw new Error(insErr.message);

    await notifySuperAdmins(supabaseUrl, serviceKey, {
      doc_url: doc.url,
      title,
      period_start: periodStart,
      period_end: periodEnd,
    });

    const adminIds = await getSuperAdminIds(admin);
    console.log("[giti-report] done", {
      title,
      docId: doc.id,
      questions: stats.totalQuestions,
      superAdmins: adminIds.length,
    });

    return jsonResponse({ ok: true, report, doc });
  } catch (err) {
    console.error("[giti-report] error", err);
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
