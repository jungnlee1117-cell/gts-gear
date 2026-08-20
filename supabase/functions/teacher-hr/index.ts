import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "npm:pdf-lib@1.17.1";
import {
  assertContractMutable,
  buildHrStatusMap,
  buildSettlementRevealResult,
  canAccessHr,
  canListHrStatus,
  canRevealSettlement,
  isHrSuperAdmin,
  maskAccountNumber,
  maskResidentId,
  publicSettlementPayload,
  requireEncryptionKey,
  requireSignAgreement,
  safeErrorMessage,
  settlementRevealAuditRow,
  validateSettlementInput,
} from "./hrRules.js";
import { generateGtsContractPdf, appendSignedPartyPage } from "./contractPdf.js";
import { formatResidentFront, formatSignedAtKst } from "./contractTemplate.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(code, message, status = 500, extra = {}) {
  console.error("[teacher-hr]", { code, status });
  return jsonResponse({ error: message, code, ...extra }, status);
}

function classifyThrown(err) {
  const code = err?.code;
  if (code === "ENCRYPTION_KEY_MISSING") {
    return { code, status: 500, message: "정산정보 암호화 키가 설정되지 않았습니다." };
  }
  if (code === "VALIDATION_ERROR") {
    return { code, status: 400, message: safeErrorMessage(err), field: err.field };
  }
  const pg = String(err?.code || "");
  const msg = String(err?.message || "");
  if (pg === "42P01" || /does not exist/i.test(msg)) {
    if (/reveal_audit/i.test(msg)) {
      return { code: "SETTLEMENT_AUDIT_TABLE_MISSING", status: 500, message: "정산정보 조회 기록을 저장할 수 없습니다." };
    }
    if (/teacher_contract_rates/i.test(msg)) {
      return { code: "CONTRACT_RATES_TABLE_MISSING", status: 500, message: "계약 급여 조건 테이블이 없습니다." };
    }
    return { code: "SETTLEMENT_TABLE_MISSING", status: 500, message: "정산정보 테이블이 없습니다." };
  }
  if (pg === "42501" || /row-level security|permission denied/i.test(msg)) {
    return { code: "RLS_DENIED", status: 403, message: "정산정보를 저장할 권한이 없습니다." };
  }
  if (/encrypt|decrypt|AES|OperationError|data provided/i.test(msg)) {
    return { code: "ENCRYPT_FAILED", status: 500, message: "정산정보 처리에 실패했습니다." };
  }
  return { code: "INTERNAL_ERROR", status: 500, message: "정산정보 처리에 실패했습니다." };
}

function textEncoder() {
  return new TextEncoder();
}

function bytesToB64(bytes: Uint8Array) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function b64ToBytes(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function sha256Hex(bytes: Uint8Array) {
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function importAesKey(secret: string) {
  const raw = await crypto.subtle.digest("SHA-256", textEncoder().encode(secret));
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encryptText(plain: string, secret: string) {
  const key = await importAesKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    textEncoder().encode(plain),
  );
  const packed = new Uint8Array(iv.length + cipher.byteLength);
  packed.set(iv, 0);
  packed.set(new Uint8Array(cipher), iv.length);
  return bytesToB64(packed);
}

async function decryptText(packedB64: string, secret: string) {
  const packed = b64ToBytes(packedB64);
  if (packed.length < 13) throw new Error("decrypt failed");
  const iv = packed.slice(0, 12);
  const cipher = packed.slice(12);
  const key = await importAesKey(secret);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
  return new TextDecoder().decode(plain);
}

async function loadCaller(adminClient, userId: string) {
  const { data, error } = await adminClient
    .from("teachers")
    .select("id, name, role")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getSettlement(adminClient, teacherId: string) {
  const { data, error } = await adminClient
    .from("teacher_settlement_profiles")
    .select("teacher_id, bank_name, account_holder, account_number_mask, resident_id_mask, account_number_ciphertext, resident_id_ciphertext, updated_at")
    .eq("teacher_id", teacherId)
    .maybeSingle();
  if (error) throw error;
  return publicSettlementPayload(data, teacherId);
}

async function revealSettlement(adminClient, {
  teacherId,
  viewerId,
  secret,
}: {
  teacherId: string;
  viewerId: string;
  secret: string;
}) {
  requireEncryptionKey(secret);

  const { data, error } = await adminClient
    .from("teacher_settlement_profiles")
    .select("account_number_ciphertext, resident_id_ciphertext")
    .eq("teacher_id", teacherId)
    .maybeSingle();
  if (error) throw error;

  let accountPlain = "";
  let residentPlain = "";
  try {
    if (data?.account_number_ciphertext) {
      accountPlain = await decryptText(String(data.account_number_ciphertext), secret);
    }
    if (data?.resident_id_ciphertext) {
      residentPlain = await decryptText(String(data.resident_id_ciphertext), secret);
    }
  } catch {
    const err = new Error("decrypt failed");
    err.code = "ENCRYPT_FAILED";
    throw err;
  }

  const revealed = buildSettlementRevealResult(accountPlain, residentPlain);
  if (revealed.revealed_fields.length) {
    const audit = settlementRevealAuditRow(viewerId, teacherId, revealed.revealed_fields);
    const { error: auditErr } = await adminClient
      .from("teacher_settlement_reveal_audit")
      .insert(audit);
    if (auditErr) throw auditErr;
  }
  return revealed;
}

async function upsertSettlement(adminClient, {
  teacherId,
  callerId,
  bankName,
  accountHolder,
  accountNumber,
  residentId,
  secret,
}: {
  teacherId: string;
  callerId: string;
  bankName: string;
  accountHolder: string;
  accountNumber?: string;
  residentId?: string;
  secret: string;
}) {
  requireEncryptionKey(secret);

  const { data: existing, error: exErr } = await adminClient
    .from("teacher_settlement_profiles")
    .select("teacher_id, bank_name, account_holder, account_number_mask, resident_id_mask")
    .eq("teacher_id", teacherId)
    .maybeSingle();
  if (exErr) throw exErr;

  const parsed = validateSettlementInput(existing, {
    bankName,
    accountHolder,
    accountNumber,
    residentId,
  });

  const row: Record<string, unknown> = {
    teacher_id: teacherId,
    bank_name: parsed.bankName,
    account_holder: parsed.accountHolder,
    updated_at: new Date().toISOString(),
    updated_by: callerId,
  };

  if (parsed.accountDigits) {
    try {
      row.account_number_ciphertext = await encryptText(parsed.accountDigits, secret);
      row.account_number_mask = maskAccountNumber(parsed.accountDigits);
    } catch {
      const err = new Error("encrypt failed");
      err.code = "ENCRYPT_FAILED";
      throw err;
    }
  }
  if (parsed.residentDigits) {
    try {
      row.resident_id_ciphertext = await encryptText(parsed.residentDigits, secret);
      row.resident_id_mask = maskResidentId(parsed.residentDigits);
    } catch {
      const err = new Error("encrypt failed");
      err.code = "ENCRYPT_FAILED";
      throw err;
    }
  }

  const { error } = await adminClient
    .from("teacher_settlement_profiles")
    .upsert(row, { onConflict: "teacher_id" });
  if (error) throw error;
  return getSettlement(adminClient, teacherId);
}

async function listHrStatus(adminClient) {
  const [{ data: settlements, error: sErr }, { data: contracts, error: cErr }] = await Promise.all([
    adminClient
      .from("teacher_settlement_profiles")
      .select("teacher_id, bank_name, account_holder, account_number_mask, resident_id_mask"),
    adminClient
      .from("teacher_contracts")
      .select("teacher_id, status"),
  ]);
  if (sErr) throw sErr;
  if (cErr) throw cErr;
  return buildHrStatusMap(settlements || [], contracts || []);
}

async function residentFrontOnly(adminClient, teacherId: string, secret: string) {
  if (!secret) return "";
  const { data, error } = await adminClient
    .from("teacher_settlement_profiles")
    .select("resident_id_ciphertext")
    .eq("teacher_id", teacherId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.resident_id_ciphertext) return "";
  try {
    const plain = await decryptText(String(data.resident_id_ciphertext), secret);
    const front = String(plain || "").replace(/\D/g, "").slice(0, 6);
    return front.length === 6 ? front : "";
  } catch {
    return "";
  }
}

async function getIssueContext(adminClient, teacherId: string, secret: string) {
  const { data: teacher, error } = await adminClient
    .from("teachers")
    .select("id, name, phone, contract_type")
    .eq("id", teacherId)
    .maybeSingle();
  if (error) throw error;
  if (!teacher) {
    const err = new Error("선생님을 찾을 수 없습니다.");
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  const residentFront = await residentFrontOnly(adminClient, teacherId, secret);
  return {
    teacher_id: teacher.id,
    teacher_name: teacher.name || "",
    teacher_phone: teacher.phone || "",
    contract_type: teacher.contract_type || "위탁계약",
    resident_id_front: residentFront,
    resident_number_front: formatResidentFront(residentFront),
  };
}

function dataUrlToBytes(dataUrl: string) {
  const raw = String(dataUrl || "");
  const comma = raw.indexOf(",");
  const b64 = comma >= 0 ? raw.slice(comma + 1) : raw;
  return b64ToBytes(b64.replace(/\s/g, ""));
}

async function stampSignaturePdf(originalBytes: Uint8Array, signaturePng: Uint8Array, signedAtLabel: string) {
  const pdf = await PDFDocument.load(originalBytes);
  const png = await pdf.embedPng(signaturePng);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pages = pdf.getPages();
  const last = pages[pages.length - 1];
  const { width } = last.getSize();
  const sigWidth = Math.min(180, width * 0.28);
  const sigHeight = sigWidth * (png.height / png.width);
  const x = width - sigWidth - 36;
  const y = 36;
  last.drawRectangle({
    x: x - 8,
    y: y - 8,
    width: sigWidth + 16,
    height: sigHeight + 28,
    color: rgb(1, 1, 1),
    opacity: 0.86,
    borderColor: rgb(0.8, 0.8, 0.8),
    borderWidth: 0.6,
  });
  last.drawImage(png, { x, y: y + 12, width: sigWidth, height: sigHeight });
  last.drawText(signedAtLabel, {
    x,
    y,
    size: 8,
    font,
    color: rgb(0.25, 0.25, 0.25),
  });
  return new Uint8Array(await pdf.save());
}

async function signContract(adminClient, {
  contractId,
  callerId,
  signatureDataUrl,
  agreed,
}: {
  contractId: string;
  callerId: string;
  signatureDataUrl: string;
  agreed: boolean;
}) {
  requireSignAgreement(agreed);

  const { data: contract, error } = await adminClient
    .from("teacher_contracts")
    .select("*")
    .eq("id", contractId)
    .maybeSingle();
  if (error) throw error;
  if (!contract) throw new Error("계약서를 찾을 수 없습니다.");
  if (contract.teacher_id !== callerId) throw new Error("본인 계약서만 서명할 수 있습니다.");
  assertContractMutable(contract, "update");
  if (!contract.original_pdf_path) throw new Error("원본 PDF가 없습니다.");

  const { data: originalFile, error: dlErr } = await adminClient.storage
    .from("teacher-contracts")
    .download(contract.original_pdf_path);
  if (dlErr || !originalFile) throw new Error("원본 PDF를 불러오지 못했습니다.");

  const originalBytes = new Uint8Array(await originalFile.arrayBuffer());
  const signatureBytes = dataUrlToBytes(signatureDataUrl);
  if (signatureBytes.length < 80) throw new Error("서명을 입력해 주세요.");

  const signedAt = new Date();
  const signedLabel = `Signed ${signedAt.toISOString().slice(0, 10)}`;
  let signedBytes;
  if (contract.source === "generated") {
    const { data: teacherRow } = await adminClient
      .from("teachers")
      .select("name, phone")
      .eq("id", contract.teacher_id)
      .maybeSingle();
    signedBytes = await appendSignedPartyPage(originalBytes, {
      teacherName: teacherRow?.name || "",
      teacherPhone: contract.phone_snapshot || teacherRow?.phone || "",
      residentFront: contract.resident_id_front || "",
      signedAt: formatSignedAtKst(signedAt),
      signaturePng: signatureBytes,
    });
  } else {
    signedBytes = await stampSignaturePdf(originalBytes, signatureBytes, signedLabel);
  }

  const prefix = `${contract.teacher_id}/${contract.id}`;
  const signaturePath = `${prefix}/signature.png`;
  const signedPath = `${prefix}/signed.pdf`;

  const { error: sigUpErr } = await adminClient.storage
    .from("teacher-contracts")
    .upload(signaturePath, signatureBytes, {
      contentType: "image/png",
      upsert: true,
    });
  if (sigUpErr) throw new Error("서명 이미지를 저장하지 못했습니다.");

  const { error: pdfUpErr } = await adminClient.storage
    .from("teacher-contracts")
    .upload(signedPath, signedBytes, {
      contentType: "application/pdf",
      upsert: true,
    });
  if (pdfUpErr) throw new Error("서명완료 PDF를 저장하지 못했습니다.");

  const originalHash = contract.original_pdf_hash || await sha256Hex(originalBytes);
  const signedHash = await sha256Hex(signedBytes);

  const { data: updated, error: upErr } = await adminClient
    .from("teacher_contracts")
    .update({
      status: "서명완료",
      signature_path: signaturePath,
      original_pdf_url: contract.original_pdf_url || contract.original_pdf_path,
      signed_pdf_path: signedPath,
      signed_pdf_url: signedPath,
      original_pdf_hash: originalHash,
      signed_pdf_hash: signedHash,
      signed_at: signedAt.toISOString(),
      signed_by: callerId,
      agreed_at: signedAt.toISOString(),
      updated_at: signedAt.toISOString(),
    })
    .eq("id", contractId)
    .eq("status", "서명대기")
    .select("id, teacher_id, title, contract_date, status, original_pdf_path, original_pdf_url, signed_pdf_path, signed_pdf_url, original_pdf_hash, signed_pdf_hash, signed_at, signed_by, agreed_at")
    .single();
  if (upErr) throw upErr;
  return updated;
}

async function issueContract(adminClient, {
  teacherId,
  callerId,
  startDate,
  endDate,
  contractDate,
  rates,
  secret,
}: {
  teacherId: string;
  callerId: string;
  startDate: string;
  endDate: string;
  contractDate: string;
  rates: unknown;
  secret: string;
}) {
  const ctx = await getIssueContext(adminClient, teacherId, secret);

  const { bytes, document } = await generateGtsContractPdf({
    teacherName: ctx.teacher_name,
    teacherPhone: ctx.teacher_phone,
    residentFront: ctx.resident_id_front,
    contractType: ctx.contract_type,
    startDate,
    endDate,
    contractDate,
    rates,
  });

  const { count, error: cErr } = await adminClient
    .from("teacher_contracts")
    .select("id", { count: "exact", head: true })
    .eq("teacher_id", teacherId);
  if (cErr) throw cErr;

  const id = crypto.randomUUID();
  const path = `${teacherId}/${id}/original.pdf`;
  const hash = await sha256Hex(bytes);

  const { error: upErr } = await adminClient.storage
    .from("teacher-contracts")
    .upload(path, bytes, {
      contentType: "application/pdf",
      upsert: false,
    });
  if (upErr) throw upErr;

  const { data: contract, error: insErr } = await adminClient
    .from("teacher_contracts")
    .insert({
      id,
      teacher_id: teacherId,
      title: document.fileTitle,
      contract_date: document.contractDate,
      contract_type: document.contractType,
      start_date: document.startDate,
      end_date: document.endDate,
      phone_snapshot: ctx.teacher_phone || null,
      resident_id_front: ctx.resident_id_front || null,
      version: (count || 0) + 1,
      source: "generated",
      status: "서명대기",
      original_pdf_path: path,
      original_pdf_url: path,
      original_pdf_hash: hash,
      created_by: callerId,
    })
    .select("id, teacher_id, title, contract_date, contract_type, start_date, end_date, version, source, status, original_pdf_path, original_pdf_hash, created_at")
    .single();
  if (insErr) {
    await adminClient.storage.from("teacher-contracts").remove([path]);
    throw insErr;
  }

  const rateRows = document.rates.map((r) => ({
    contract_id: id,
    teacher_id: teacherId,
    rate_type: r.rate_type,
    rate_name: r.rate_name,
    amount: r.amount,
    unit: r.unit,
    sort_order: r.sort_order,
  }));
  const { error: rateErr } = await adminClient.from("teacher_contract_rates").insert(rateRows);
  if (rateErr) {
    await adminClient.from("teacher_contracts").delete().eq("id", id).eq("status", "서명대기");
    await adminClient.storage.from("teacher-contracts").remove([path]);
    throw rateErr;
  }
  return { ...contract, rates: rateRows };
}

async function cancelPendingContract(adminClient, contractId: string) {
  const { data: contract, error } = await adminClient
    .from("teacher_contracts")
    .select("id, status, original_pdf_path, signed_pdf_path, signature_path")
    .eq("id", contractId)
    .maybeSingle();
  if (error) throw error;
  if (!contract) throw new Error("계약서를 찾을 수 없습니다.");
  assertContractMutable(contract, "delete");
  if (contract.status !== "서명대기") {
    throw new Error("서명 대기 중인 계약서만 발행 취소할 수 있습니다.");
  }
  const paths = [contract.original_pdf_path, contract.signed_pdf_path, contract.signature_path].filter(Boolean);
  if (paths.length) {
    await adminClient.storage.from("teacher-contracts").remove(paths);
  }
  const { error: delErr } = await adminClient
    .from("teacher_contracts")
    .delete()
    .eq("id", contractId)
    .eq("status", "서명대기");
  if (delErr) throw delErr;
  return { id: contractId, cancelled: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const secret = Deno.env.get("SETTLEMENT_ENCRYPTION_KEY") ?? "";
    const superAdminId = Deno.env.get("SUPER_ADMIN_ID") ?? "";
    const authHeader = req.headers.get("Authorization") || "";

    if (!authHeader) return jsonError("NO_AUTHORIZATION", "Unauthorized", 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return jsonError("INVALID_SESSION", "Unauthorized", 401);

    const adminClient = createClient(supabaseUrl, serviceKey);
    const caller = await loadCaller(adminClient, user.id);
    if (!caller) return jsonError("TEACHER_NOT_FOUND", "Forbidden", 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    const targetTeacherId = String(body.teacher_id || caller.id);

    if (action === "get_settlement" || action === "upsert_settlement" || action === "reveal_settlement") {
      const allowed = action === "reveal_settlement"
        ? canRevealSettlement(caller, targetTeacherId, superAdminId)
        : canAccessHr(caller, targetTeacherId, superAdminId);
      if (!allowed) {
        return jsonError("FORBIDDEN", "정산정보에 접근할 수 없습니다.", 403);
      }
      if (action === "get_settlement") {
        const data = await getSettlement(adminClient, targetTeacherId);
        return jsonResponse({ data });
      }
      try {
        requireEncryptionKey(secret);
      } catch {
        return jsonError("ENCRYPTION_KEY_MISSING", "정산정보 암호화 키가 설정되지 않았습니다.", 500);
      }
      if (action === "reveal_settlement") {
        const data = await revealSettlement(adminClient, {
          teacherId: targetTeacherId,
          viewerId: caller.id,
          secret,
        });
        return jsonResponse({ data });
      }
      const data = await upsertSettlement(adminClient, {
        teacherId: targetTeacherId,
        callerId: caller.id,
        bankName: body.bank_name,
        accountHolder: body.account_holder,
        accountNumber: body.account_number,
        residentId: body.resident_id,
        secret,
      });
      return jsonResponse({ data });
    }

    if (action === "list_hr_status") {
      if (!canListHrStatus(caller, superAdminId)) {
        return jsonError("FORBIDDEN", "상태 목록에 접근할 수 없습니다.", 403);
      }
      const data = await listHrStatus(adminClient);
      return jsonResponse({ data });
    }

    if (action === "get_contract_issue_context") {
      if (!isHrSuperAdmin(caller, superAdminId)) {
        return jsonError("FORBIDDEN", "계약서를 발행할 권한이 없습니다.", 403);
      }
      const data = await getIssueContext(adminClient, targetTeacherId, secret);
      return jsonResponse({ data });
    }

    if (action === "issue_contract") {
      if (!isHrSuperAdmin(caller, superAdminId)) {
        return jsonError("FORBIDDEN", "계약서를 발행할 권한이 없습니다.", 403);
      }
      const data = await issueContract(adminClient, {
        teacherId: targetTeacherId,
        callerId: caller.id,
        startDate: body.start_date,
        endDate: body.end_date,
        contractDate: body.contract_date,
        rates: body.rates,
        secret,
      });
      return jsonResponse({ data });
    }

    if (action === "cancel_pending_contract") {
      if (!isHrSuperAdmin(caller, superAdminId)) {
        return jsonError("FORBIDDEN", "계약서를 취소할 권한이 없습니다.", 403);
      }
      const data = await cancelPendingContract(adminClient, String(body.contract_id || ""));
      return jsonResponse({ data });
    }

    if (action === "sign_contract") {
      const contract = await signContract(adminClient, {
        contractId: String(body.contract_id || ""),
        callerId: caller.id,
        signatureDataUrl: String(body.signature_data_url || ""),
        agreed: body.agreed === true,
      });
      return jsonResponse({ data: contract });
    }

    return jsonError("UNKNOWN_ACTION", "Unknown action", 400);
  } catch (err) {
    const classified = classifyThrown(err);
    console.error("[teacher-hr]", { code: classified.code, status: classified.status });
    return jsonError(classified.code, classified.message, classified.status, classified.field ? { field: classified.field } : {});
  }
});
