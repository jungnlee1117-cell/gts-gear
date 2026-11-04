import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import XLSX from "npm:xlsx-js-style@1.2.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function firstDay(yearMonth: string) {
  const value = String(yearMonth || "").slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(value)) throw new Error("INVALID_YEAR_MONTH");
  return `${value}-01`;
}

function previousMonthKst() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const date = new Date(Date.UTC(Number(values.year), Number(values.month) - 2, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const size = 0x8000;
  for (let i = 0; i < bytes.length; i += size) {
    binary += String.fromCharCode(...bytes.subarray(i, i + size));
  }
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function importAesKey(secret: string) {
  const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["decrypt"]);
}

async function decryptText(value: string, secret: string) {
  const packed = base64ToBytes(value);
  if (packed.length < 13) throw new Error("DECRYPT_FAILED");
  const key = await importAesKey(secret);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: packed.slice(0, 12) },
    key,
    packed.slice(12),
  );
  return new TextDecoder().decode(plain);
}

function floorTen(value: number) {
  return Math.floor((Number(value) || 0) / 10) * 10;
}

function filenameFor(yearMonth: string) {
  const [year, month] = yearMonth.split("-");
  return `사업소득${Number(month)}월_지티에스_${year}.xlsx`;
}

async function loadCaller(adminClient, userId: string) {
  const { data, error } = await adminClient
    .from("teachers").select("id, role").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

async function authenticate(req: Request, adminClient, serviceKey: string) {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (token && token === serviceKey) return { service: true, caller: null };
  if (!token) throw new Error("UNAUTHORIZED");
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) throw new Error("UNAUTHORIZED");
  const caller = await loadCaller(adminClient, user.id);
  if (!caller || caller.role !== "superadmin") throw new Error("FORBIDDEN");
  return { service: false, caller };
}

async function saveSnapshot(adminClient, yearMonth: string, rows, callerId: string) {
  const month = firstDay(yearMonth);
  const cleaned = (Array.isArray(rows) ? rows : [])
    .filter((row) => row?.teacher_name)
    .map((row, index) => ({
      year_month: month,
      teacher_id: row.teacher_id ? String(row.teacher_id) : null, // 임시 선생님은 null
      teacher_name: String(row.teacher_name).slice(0, 100),
      income_type: ["계약직", "사업자"].includes(row.income_type) ? row.income_type : "위탁수업",
      deductions: row.deductions && typeof row.deductions === "object" ? row.deductions : null,
      gross_amount: Math.max(0, Math.round(Number(row.gross_amount) || 0)),
      sort_order: Number.isInteger(row.sort_order) ? row.sort_order : index,
      created_by: callerId,
      updated_at: new Date().toISOString(),
    }));
  if (!cleaned.length) throw new Error("EMPTY_REPORT");
  // 해당 월 스냅샷을 통째로 교체: 퇴사 처리된 선생님·삭제된 행이 남지 않고, 임시 선생님(teacher_id 없음)도 중복 없이 저장
  const { error: deleteError } = await adminClient.from("payroll_tax_report_snapshots")
    .delete().eq("year_month", month);
  if (deleteError) throw deleteError;
  const { error } = await adminClient.from("payroll_tax_report_snapshots").insert(cleaned);
  if (error) throw error;
  return { year_month: yearMonth, row_count: cleaned.length };
}

const SECTION_ORDER = ["위탁수업", "계약직", "사업자"];

async function reportRows(adminClient, yearMonth: string, secret: string) {
  if (!secret) throw new Error("ENCRYPTION_KEY_MISSING");
  const { data: snapshots, error } = await adminClient
    .from("payroll_tax_report_snapshots")
    .select("teacher_id, teacher_name, income_type, gross_amount, sort_order, deductions")
    .eq("year_month", firstDay(yearMonth))
    .order("sort_order", { ascending: true });
  if (error) throw error;
  if (!snapshots?.length) throw new Error("SNAPSHOT_NOT_FOUND");

  const teacherIds = snapshots.map((row) => row.teacher_id).filter(Boolean);
  const { data: settlements, error: settlementError } = await adminClient
    .from("teacher_settlement_profiles")
    .select("teacher_id, resident_id_ciphertext")
    .in("teacher_id", teacherIds);
  if (settlementError) throw settlementError;
  const cipherByTeacher = new Map((settlements || []).map((row) => [row.teacher_id, row.resident_id_ciphertext]));

  const missing: string[] = [];
  const rows = [];
  for (const snapshot of snapshots) {
    // 세무 제출 대상에서 항상 제외하는 내부 운영 규칙입니다.
    if (snapshot.teacher_name === "김민욱") continue;
    let residentId = "";
    const cipher = snapshot.teacher_id ? cipherByTeacher.get(snapshot.teacher_id) : null;
    if (cipher) {
      try {
        residentId = await decryptText(String(cipher), secret);
      } catch {
        // 한 명의 이전/손상된 암호문 때문에 전체 Excel 생성을 중단하지 않습니다.
        residentId = "";
      }
    }
    const digits = residentId.replace(/\D/g, "");
    const formattedResident = digits.length === 13
      ? `${digits.slice(0, 6)}-${digits.slice(6)}`
      : (digits.length === 10 ? `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}` : "미등록");
    if (formattedResident === "미등록" && snapshot.teacher_id) missing.push(snapshot.teacher_name);
    const gross = Number(snapshot.gross_amount) || 0;
    const type = ["계약직", "사업자"].includes(snapshot.income_type) ? snapshot.income_type : "위탁수업";
    const ded = (snapshot.deductions || {}) as Record<string, number>;
    const insurance = ["국민연금", "건강보험", "장기요양보험", "고용보험"]
      .reduce((sum, key) => sum + (Number(ded[key]) || 0), 0);
    const taxes = ["소득세", "지방소득세", "농특세"]
      .reduce((sum, key) => sum + (Number(ded[key]) || 0), 0);
    let a = 0;
    let b = 0;
    if (type === "위탁수업") {
      a = floorTen(gross * 0.03);
      b = floorTen(gross * 0.003);
    } else if (type === "계약직") {
      a = insurance;
      b = taxes;
    }
    if (type === "사업자" && formattedResident === "미등록") {
      // 사업자번호 미등록도 누락 목록에 포함 (위에서 이미 추가됨)
    }
    rows.push({
      ...snapshot,
      income_type: type,
      resident_id: formattedResident,
      gross,
      col_a: a,
      col_b: b,
      net: gross - a - b,
    });
  }
  rows.sort((x, y) => SECTION_ORDER.indexOf(x.income_type) - SECTION_ORDER.indexOf(y.income_type)
    || (x.sort_order ?? 0) - (y.sort_order ?? 0));
  return { rows, missing };
}

const SECTION_META: Record<string, { title: string; idLabel: string; headers: string[] }> = {
  "위탁수업": {
    title: "위탁수업 (사업소득 3.3% 원천징수)",
    idLabel: "주민등록번호",
    headers: ["지급액(세전)", "소득세(3%)", "지방세(0.3%)", "지급액(세후)"],
  },
  "계약직": {
    title: "계약직 (근로소득 · 급여명세서 기준)",
    idLabel: "주민등록번호",
    headers: ["지급액(세전)", "4대보험 공제", "소득세·지방세", "차인지급액"],
  },
  "사업자": {
    title: "사업자 (사업자 대 사업자 · 원천징수 없음)",
    idLabel: "사업자등록번호",
    headers: ["지급액", "원천징수", "—", "지급액(실지급)"],
  },
};

function makeWorkbook(yearMonth: string, rows) {
  const [year, monthText] = yearMonth.split("-");
  const month = Number(monthText);
  const data: unknown[][] = [
    [null, "지티에스"],
    [null, `${year}년 ${month}월 지급 내역`],
  ];
  type Kind = "title" | "head" | "body" | "sub" | "blank" | "total";
  const kinds: Kind[] = ["blank", "title"];
  const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [];
  const grandTotals = { gross: 0, net: 0 };

  for (const type of SECTION_ORDER) {
    const group = rows.filter((row) => row.income_type === type);
    if (!group.length) continue;
    const meta = SECTION_META[type];
    data.push([]); kinds.push("blank");
    data.push([meta.title]); kinds.push("title");
    merges.push({ s: { r: data.length - 1, c: 0 }, e: { r: data.length - 1, c: 7 } });
    data.push(["구분", "성명", meta.idLabel, ...meta.headers, "지급일"]); kinds.push("head");
    const startRow = data.length;
    for (const row of group) {
      data.push([
        type, row.teacher_name, row.resident_id,
        row.gross || 0, type === "사업자" ? "없음" : (row.col_a || 0),
        type === "사업자" ? "" : (row.col_b || 0), row.net || 0, "10일",
      ]);
      kinds.push("body");
    }
    if (group.length > 1) merges.push({ s: { r: startRow, c: 0 }, e: { r: data.length - 1, c: 0 } });
    const sumGross = group.reduce((sum, row) => sum + row.gross, 0);
    const sumA = group.reduce((sum, row) => sum + row.col_a, 0);
    const sumB = group.reduce((sum, row) => sum + row.col_b, 0);
    const sumNet = group.reduce((sum, row) => sum + row.net, 0);
    data.push(["소계", null, null, sumGross, type === "사업자" ? "" : sumA, type === "사업자" ? "" : sumB, sumNet, null]);
    kinds.push("sub");
    grandTotals.gross += sumGross;
    grandTotals.net += sumNet;
  }
  data.push([]); kinds.push("blank");
  data.push(["총계", null, null, grandTotals.gross, null, null, grandTotals.net, null]);
  kinds.push("total");

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [
    { wch: 12 }, { wch: 18 }, { wch: 21 }, { wch: 17 },
    { wch: 17 }, { wch: 17 }, { wch: 17 }, { wch: 10 },
  ];
  ws["!rows"] = data.map((_, index) => ({ hpt: kinds[index] === "blank" ? 10 : 22 }));
  ws["!merges"] = merges;

  const border = { style: "thin", color: { rgb: "222222" } };
  const allBorder = { top: border, bottom: border, left: border, right: border };
  const base = { name: "맑은 고딕", sz: 11 };
  data.forEach((_, r) => {
    const kind = kinds[r];
    for (let c = 0; c < 8; c += 1) {
      const ref = XLSX.utils.encode_cell({ r, c });
      if (kind === "blank") continue;
      if (!ws[ref]) ws[ref] = { t: "s", v: "" };
      if (r === 1 && c === 1) { ws[ref].s = { font: { ...base, sz: 14, bold: true } }; continue; }
      if (r === 1) continue;
      if (kind === "title") {
        ws[ref].s = { font: { ...base, bold: true, sz: 12 }, alignment: { horizontal: "left", vertical: "center" },
          fill: { fgColor: { rgb: "DDEBF7" } }, border: allBorder };
      } else if (kind === "head") {
        ws[ref].s = { font: { ...base, bold: true }, alignment: { horizontal: "center", vertical: "center" },
          fill: { fgColor: { rgb: "FFF200" } }, border: allBorder };
      } else {
        const money = c >= 3 && c <= 6;
        ws[ref].s = {
          font: { ...base, bold: kind !== "body" },
          alignment: { horizontal: money ? "right" : "center", vertical: "center" },
          border: allBorder,
          fill: { fgColor: { rgb: kind === "body" ? "FFFFFF" : "F2F2F2" } },
        };
        if (money) ws[ref].z = "#,##0;[Red](#,##0);0";
      }
    }
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `${month}월`);
  return XLSX.write(wb, { type: "array", bookType: "xlsx" });
}

async function buildReport(adminClient, yearMonth: string, secret: string) {
  const { rows, missing } = await reportRows(adminClient, yearMonth, secret);
  let workbook;
  try {
    workbook = makeWorkbook(yearMonth, rows);
  } catch (error) {
    console.error("[payroll-tax-report] workbook generation failed", {
      message: String(error?.message || error),
    });
    throw new Error("XLSX_GENERATION_FAILED");
  }
  const bytes = new Uint8Array(workbook);
  return { bytes, missing, filename: filenameFor(yearMonth), rowCount: rows.length };
}

function base64Url(bytes: Uint8Array) {
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pemToBytes(pem: string) {
  const value = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  return base64ToBytes(value);
}

async function googleAccessToken(serviceAccount) {
  if (!serviceAccount?.client_email || !serviceAccount?.private_key) throw new Error("DRIVE_CREDENTIALS_INVALID");
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const claims = base64Url(new TextEncoder().encode(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/drive",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })));
  const signingInput = `${header}.${claims}`;
  const key = await crypto.subtle.importKey(
    "pkcs8", pemToBytes(serviceAccount.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput),
  ));
  const assertion = `${signingInput}.${base64Url(signature)}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) throw new Error("DRIVE_AUTH_FAILED");
  return body.access_token;
}

async function findDriveFile(accessToken: string, folderId: string, filename: string) {
  const escapedName = filename.replace(/'/g, "\\'");
  const query = `'${folderId}' in parents and name = '${escapedName}' and trashed = false`;
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("q", query);
  url.searchParams.set("fields", "files(id,name,webViewLink)");
  url.searchParams.set("pageSize", "1");
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(res.status === 404 ? "DRIVE_FOLDER_NOT_FOUND" : "DRIVE_SEARCH_FAILED");
  return body.files?.[0] || null;
}

async function uploadDriveFile(accessToken: string, folderId: string, filename: string, bytes: Uint8Array) {
  const existing = await findDriveFile(accessToken, folderId, filename);
  const boundary = `gts_${crypto.randomUUID().replace(/-/g, "")}`;
  const metadata = existing ? { name: filename } : {
    name: filename,
    parents: [folderId],
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
  const prefix = new TextEncoder().encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`,
  );
  const suffix = new TextEncoder().encode(`\r\n--${boundary}--`);
  const payload = new Uint8Array(prefix.length + bytes.length + suffix.length);
  payload.set(prefix, 0);
  payload.set(bytes, prefix.length);
  payload.set(suffix, prefix.length + bytes.length);
  const fileUrl = existing
    ? `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=multipart&fields=id,name,webViewLink`
    : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink";
  const res = await fetch(fileUrl, {
    method: existing ? "PATCH" : "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body: payload,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.id) {
    if (res.status === 403 || res.status === 404) throw new Error("DRIVE_FOLDER_ACCESS_DENIED");
    throw new Error("DRIVE_UPLOAD_FAILED");
  }
  return { ...body, replaced: Boolean(existing) };
}

async function uploadToDrive(adminClient, yearMonth: string, secret: string) {
  const folderId = Deno.env.get("PAYROLL_DRIVE_FOLDER_ID") || "";
  const rawCredentials = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON") || "";
  if (!folderId || !rawCredentials) throw new Error("DRIVE_CONFIG_MISSING");
  let credentials;
  try {
    credentials = JSON.parse(rawCredentials);
  } catch {
    throw new Error("DRIVE_CREDENTIALS_INVALID");
  }
  const report = await buildReport(adminClient, yearMonth, secret);
  if (report.missing.length) throw new Error("RESIDENT_ID_MISSING");
  const accessToken = await googleAccessToken(credentials);
  let result;
  try {
    result = await uploadDriveFile(accessToken, folderId, report.filename, report.bytes);
  } catch (error) {
    if (String(error?.message || "") === "DRIVE_FOLDER_ACCESS_DENIED") {
      throw new Error(`DRIVE_FOLDER_ACCESS_DENIED|${credentials.client_email}`);
    }
    throw error;
  }
  const webViewLink = result.webViewLink || `https://drive.google.com/file/d/${result.id}/view`;
  await adminClient.from("payroll_tax_report_drive_uploads").insert({
    year_month: firstDay(yearMonth), filename: report.filename,
    drive_file_id: result.id, drive_file_url: webViewLink,
    status: "uploaded", uploaded_at: new Date().toISOString(),
  });
  return {
    filename: report.filename,
    drive_file_id: result.id,
    web_view_link: webViewLink,
    replaced: result.replaced,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const secret = Deno.env.get("SETTLEMENT_ENCRYPTION_KEY") || "";
    const adminClient = createClient(supabaseUrl, serviceKey);
    const auth = await authenticate(req, adminClient, serviceKey);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    if (action === "save_snapshot") {
      if (!auth.caller) throw new Error("FORBIDDEN");
      const data = await saveSnapshot(adminClient, String(body.year_month || ""), body.rows, auth.caller.id);
      return response({ data });
    }
    if (action === "download") {
      if (!auth.caller) throw new Error("FORBIDDEN");
      const yearMonth = String(body.year_month || "").slice(0, 7);
      const report = await buildReport(adminClient, yearMonth, secret);
      return response({ data: {
        filename: report.filename, file_base64: bytesToBase64(report.bytes),
        row_count: report.rowCount, missing_resident_ids: report.missing,
      } });
    }
    if (action === "upload_drive") {
      if (!auth.caller) throw new Error("FORBIDDEN");
      return response({ data: await uploadToDrive(adminClient, String(body.year_month || "").slice(0, 7), secret) });
    }
    if (action === "upload_previous_month") {
      if (!auth.service) throw new Error("FORBIDDEN");
      return response({ data: await uploadToDrive(adminClient, previousMonthKst(), secret) });
    }
    throw new Error("UNKNOWN_ACTION");
  } catch (error) {
    const rawCode = String(error?.message || "INTERNAL_ERROR");
    const [code, detail] = rawCode.split("|", 2);
    console.error("[payroll-tax-report]", { code });
    const messages: Record<string, string> = {
      UNAUTHORIZED: "로그인이 필요합니다.", FORBIDDEN: "권한이 없습니다.",
      INVALID_YEAR_MONTH: "정산 월을 확인해주세요.", EMPTY_REPORT: "급여 내역이 없습니다.",
      SNAPSHOT_NOT_FOUND: "해당 월 급여자료가 아직 준비되지 않았습니다.",
      ENCRYPTION_KEY_MISSING: "정산정보 암호화 설정을 확인해주세요.",
      DECRYPT_FAILED: "일부 선생님의 주민등록번호를 읽지 못했습니다. 정산정보를 다시 저장해주세요.",
      XLSX_GENERATION_FAILED: "세무 엑셀 파일을 만드는 중 오류가 발생했습니다.",
      RESIDENT_ID_MISSING: "주민등록번호가 등록되지 않은 선생님이 있습니다.",
      DRIVE_CONFIG_MISSING: "Google Drive 저장 설정이 완료되지 않았습니다.",
      DRIVE_CREDENTIALS_INVALID: "Google Drive 인증정보를 확인해주세요.",
      DRIVE_AUTH_FAILED: "Google Drive 인증에 실패했습니다.",
      DRIVE_FOLDER_NOT_FOUND: "Google Drive 저장 폴더를 찾지 못했습니다.",
      DRIVE_FOLDER_ACCESS_DENIED: "Google Drive 폴더 공유 권한을 확인해주세요.",
      DRIVE_SEARCH_FAILED: "Google Drive 파일 확인에 실패했습니다.",
      DRIVE_UPLOAD_FAILED: "Google Drive 파일 저장에 실패했습니다.",
    };
    const message = code === "DRIVE_FOLDER_ACCESS_DENIED" && detail
      ? `${messages[code]}\nDrive 폴더를 ${detail} 계정에 편집자로 공유해주세요.`
      : messages[code] || "세무 엑셀 처리에 실패했습니다.";
    return response({ error: message, code },
      code === "UNAUTHORIZED" ? 401 : code === "FORBIDDEN" ? 403 : 500);
  }
});
