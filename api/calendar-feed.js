/**
 * 구글 캘린더 구독용 iCal 피드
 * 주소: /api/calendar-feed?token=...  (구글 캘린더 → 다른 캘린더 추가 → URL로 추가)
 * 토큰은 calendar_feed_tokens 테이블의 비밀 값이며, 일정 조회는 DB 함수 get_calendar_feed 가 처리합니다.
 */
function esc(text) {
  const B = String.fromCharCode(92);
  return String(text ?? "")
    .split(B).join(B + B)
    .split(";").join(B + ";")
    .split(",").join(B + ",")
    .replace(/\r?\n/g, B + "n");
}

function fold(line) {
  // iCal 75바이트 줄바꿈 규칙 (UTF-8 안전하게 문자 단위로 처리)
  const out = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const b = Buffer.byteLength(ch, "utf8");
    if (bytes + b > 73) { out.push(cur); cur = " " + ch; bytes = 1 + b; }
    else { cur += ch; bytes += b; }
  }
  out.push(cur);
  return out.join("\r\n");
}

function ymdCompact(value) {
  return String(value).slice(0, 10).replace(/-/g, "");
}

function nextDayCompact(value) {
  const [y, m, d] = String(value).slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  return `${dt.getUTCFullYear()}${String(dt.getUTCMonth() + 1).padStart(2, "0")}${String(dt.getUTCDate()).padStart(2, "0")}`;
}

export default async function handler(req, res) {
  const token = String(req.query?.token || "").trim();
  if (!/^[a-f0-9]{32,64}$/i.test(token)) {
    res.status(404).send("Not found");
    return;
  }
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    res.status(500).send("Calendar feed is not configured");
    return;
  }

  let rows = [];
  try {
    const r = await fetch(`${url}/rest/v1/rpc/get_calendar_feed`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_token: token }),
    });
    if (!r.ok) {
      res.status(502).send("Upstream error");
      return;
    }
    rows = await r.json();
  } catch {
    res.status(502).send("Upstream error");
    return;
  }

  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//GTS//gts-gear calendar//KO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:GTS 일정",
    "X-WR-TIMEZONE:Asia/Seoul",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  for (const row of Array.isArray(rows) ? rows : []) {
    const start = row.start_date || row.end_date;
    const end = row.end_date || row.start_date;
    if (!start) continue;
    const people = Number(row.people || 0);
    const prefix = row.kind === "birthday" ? "🎂 " : (row.all_done ? "✓ " : "");
    const title = `${prefix}${row.title || "일정"}${people > 1 ? ` (${people}명)` : ""}`;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${esc(row.uid)}@gts-gear`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymdCompact(start)}`,
      `DTEND;VALUE=DATE:${nextDayCompact(end)}`,
      ...(row.kind === "birthday" ? ["RRULE:FREQ=YEARLY"] : []),
      `SUMMARY:${esc(title)}`,
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");

  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
  res.status(200).send(lines.map(fold).join("\r\n") + "\r\n");
}
