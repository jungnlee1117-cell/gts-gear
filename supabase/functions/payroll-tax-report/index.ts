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
    .filter((row) => row?.teacher_id && row?.teacher_name)
    .map((row, index) => ({
      year_month: month,
      teacher_id: String(row.teacher_id),
      teacher_name: String(row.teacher_name).slice(0, 100),
      income_type: row.income_type === "계약직" ? "계약직" : "위탁수업",
      gross_amount: Math.max(0, Math.round(Number(row.gross_amount) || 0)),
      sort_order: Number.isInteger(row.sort_order) ? row.sort_order : index,
      created_by: callerId,
      updated_at: new Date().toISOString(),
    }));
  if (!cleaned.length) throw new Error("EMPTY_REPORT");
  const { error } = await adminClient.from("payroll_tax_report_snapshots")
    .upsert(cleaned, { onConflict: "year_month,teacher_id" });
  if (error) throw error;
  return { year_month: yearMonth, row_count: cleaned.length };
}

async function reportRows(adminClient, yearMonth: string, secret: string) {
  if (!secret) throw new Error("ENCRYPTION_KEY_MISSING");
  const { data: snapshots, error } = await adminClient
    .from("payroll_tax_report_snapshots")
    .select("teacher_id, teacher_name, income_type, gross_amount, sort_order")
    .eq("year_month", firstDay(yearMonth))
    .order("income_type", { ascending: false })
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
    const cipher = cipherByTeacher.get(snapshot.teacher_id);
    if (cipher) {
      try {
        residentId = await decryptText(String(cipher), secret);
      } catch {
        // 한 명의 이전/손상된 암호문 때문에 전체 Excel 생성을 중단하지 않습니다.
        residentId = "";
      }
    }
    if (!/^\d{6}-?\d{7}$/.test(residentId.replace(/\s/g, ""))) {
      missing.push(snapshot.teacher_name);
    }
    const digits = residentId.replace(/\D/g, "");
    const formattedResident = digits.length === 13 ? `${digits.slice(0, 6)}-${digits.slice(6)}` : "미등록";
    const gross = Number(snapshot.gross_amount) || 0;
    const incomeTax = floorTen(gross * 0.03);
    const localTax = floorTen(gross * 0.003);
    rows.push({
      ...snapshot,
      // 오주영 선생님은 세무 엑셀에서 항상 계약직으로 분류합니다.
      income_type: snapshot.teacher_name === "오주영" ? "계약직" : snapshot.income_type,
      resident_id: formattedResident,
      gross,
      income_tax: incomeTax,
      local_tax: localTax,
      net: gross - incomeTax - localTax,
    });
  }
  return { rows, missing };
}

function makeWorkbook(yearMonth: string, rows) {
  const [year, monthText] = yearMonth.split("-");
  const month = Number(monthText);
  const data: unknown[][] = [
    [null, null, null, null, null, null, null, null],
    [null, "지티에스", null, null, null, null, null, null],
    [null, `${year}년 ${month}월 급여액`, null, null, 0.03, 0.003, null, null],
    [null, "성명", "주민등록번호", "지급액(세전)", "소득세(3%)", "지방세(0.3%)", "지급액(세후)", "지급일"],
  ];
  for (const row of rows) {
    data.push([
      row.income_type, row.teacher_name, row.resident_id,
      row.gross || null, row.income_tax || 0, row.local_tax || 0, row.net || 0, "10일",
    ]);
  }
  data.push([null, null, null, rows.reduce((sum, row) => sum + row.gross, 0), null, null, null, null]);

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [
    { wch: 12 }, { wch: 18 }, { wch: 21 }, { wch: 17 },
    { wch: 15 }, { wch: 16 }, { wch: 17 }, { wch: 12 },
  ];
  ws["!rows"] = data.map((_, index) => ({ hpt: index === 3 ? 25 : 22 }));
  ws["!merges"] = [];
  let start = 4;
  while (start < 4 + rows.length) {
    let end = start;
    while (end + 1 < 4 + rows.length && rows[end - 4].income_type === rows[end + 1 - 4].income_type) end += 1;
    if (end > start) ws["!merges"].push({ s: { r: start, c: 0 }, e: { r: end, c: 0 } });
    start = end + 1;
  }

  const border = { style: "thin", color: { rgb: "222222" } };
  const allBorder = { top: border, bottom: border, left: border, right: border };
  for (let row = 3; row < 4 + rows.length; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const ref = XLSX.utils.encode_cell({ r: row, c: col });
      if (!ws[ref]) ws[ref] = { t: "s", v: "" };
      ws[ref].s = {
        font: { name: "맑은 고딕", sz: 11, bold: row === 3 },
        alignment: { horizontal: "center", vertical: "center" },
        border: allBorder,
        fill: row === 3
          ? { fgColor: { rgb: [1, 2, 3, 7].includes(col) ? "FFF200" : "DDEBF7" } }
          : { fgColor: { rgb: "FFFFFF" } },
      };
    }
  }
  for (let row = 4; row < 4 + rows.length + 1; row += 1) {
    for (const col of [3, 4, 5, 6]) {
      const ref = XLSX.utils.encode_cell({ r: row, c: col });
      if (ws[ref]) ws[ref].z = "#,##0;[Red](#,##0);-";
    }
  }
  if (ws.E3) ws.E3.z = "0%";
  if (ws.F3) ws.F3.z = "0.0%";
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
