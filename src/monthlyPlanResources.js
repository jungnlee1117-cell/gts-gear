const CATEGORY_ID = "lesson-plans";

function monthPrefix(yearMonth) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(yearMonth || ""));
  if (!match) throw new Error("작성 월 형식이 올바르지 않습니다.");
  return `${match[1].slice(-2)}.${Number(match[2])}`;
}

const KOREAN_PDF_AGE_ORDER = ["3_4", "5", "7"];
const KOREAN_PDF_AGE_VARIANTS = {
  "3_4": { key: "ko-3_4", label: "3~4세" },
  "5": { key: "ko-5_6", label: "5~6세" },
  "7": { key: "ko-7", label: "7세" },
};

export function monthlyPlanPdfVariant({
  language,
  pdfAge,
  selectedEnglishAges = [],
  selectedKoreanAges = [],
}) {
  if (language === "ko") {
    const selectedIds = [...new Set((selectedKoreanAges.length ? selectedKoreanAges : [pdfAge]).map(String))]
      .filter((id) => KOREAN_PDF_AGE_VARIANTS[id]);
    const ages = KOREAN_PDF_AGE_ORDER.filter((id) => selectedIds.includes(id));
    if (!ages.length) throw new Error("한국어 PDF 연령을 하나 이상 선택해 주세요.");
    return {
      key: `ko-${ages.join("-")}`,
      label: ages.map((id) => KOREAN_PDF_AGE_VARIANTS[id].label).join("·"),
    };
  }

  const ages = [...new Set(selectedEnglishAges.map(String))]
    .filter((age) => ["4", "5", "6", "7"].includes(age))
    .sort();
  if (!ages.length) throw new Error("영어 PDF 연령을 하나 이상 선택해 주세요.");
  return {
    key: `en-${ages.join("-")}`,
    label: `영어${ages.join("·")}세`,
  };
}

export function monthlyPlanPdfFileName({ month, language, pdfAge, selectedEnglishAges, selectedKoreanAges }) {
  const variant = monthlyPlanPdfVariant({ language, pdfAge, selectedEnglishAges, selectedKoreanAges });
  return `${monthPrefix(month)}_${variant.label}_월간계획안.pdf`;
}

async function ensureTeacherFolder(supabase, teacherName) {
  const { data, error } = await supabase.rpc("ensure_lesson_plan_teacher_folder", {
    p_teacher_name: teacherName,
  });
  if (error) throw new Error(error.message || "선생님 자료실 폴더를 만들지 못했습니다.");
  return data;
}

/**
 * 작성 월·언어·연령 조합별 고정 경로를 사용한다.
 * 같은 조합은 Storage 객체와 resources 레코드를 갱신하고, 다른 연령은 별도 파일로 유지한다.
 */
export async function upsertMonthlyPlanResourceFile(supabase, {
  me,
  month,
  language,
  pdfAge,
  selectedEnglishAges,
  selectedKoreanAges,
  pdfBlob,
}) {
  if (!me?.id) throw new Error("로그인 정보가 없습니다.");
  if (!pdfBlob) throw new Error("PDF 파일이 없습니다.");

  const folderId = await ensureTeacherFolder(supabase, me.name || "선생님");
  const variant = monthlyPlanPdfVariant({ language, pdfAge, selectedEnglishAges, selectedKoreanAges });
  const fileName = monthlyPlanPdfFileName({
    month,
    language,
    pdfAge,
    selectedEnglishAges,
    selectedKoreanAges,
  });
  const displayTitle = fileName.replace(/\.pdf$/i, "");
  const path = `${CATEGORY_ID}/${me.id}/monthly/${month}/${variant.key}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from("pe-resources")
    .upload(path, pdfBlob, {
      upsert: true,
      contentType: "application/pdf",
      cacheControl: "0",
    });
  if (uploadError) throw new Error(uploadError.message || "월간 계획안 PDF 업로드에 실패했습니다.");

  const { data: urlData } = supabase.storage.from("pe-resources").getPublicUrl(path);
  const fileUrl = urlData.publicUrl;
  const { data: existingRows, error: findError } = await supabase
    .from("resources")
    .select("id")
    .eq("author_id", me.id)
    .eq("category_id", CATEGORY_ID)
    .eq("file_url", fileUrl)
    .limit(1);
  if (findError) throw new Error(findError.message);

  const now = new Date().toISOString();
  const payload = {
    category_id: CATEGORY_ID,
    folder_id: folderId,
    subcategory: null,
    title: displayTitle,
    description: `월간 계획안 · ${me.name || ""} · ${month} · ${variant.label}`,
    tags: ["월간계획안", month, variant.label, me.name || ""].filter(Boolean),
    file_url: fileUrl,
    file_name: fileName,
    file_type: "pdf",
    file_size: pdfBlob.size,
    author_id: me.id,
    author_name: me.name || "",
    updated_at: now,
  };

  const existingId = existingRows?.[0]?.id;
  if (existingId) {
    const { error } = await supabase
      .from("resources")
      .update(payload)
      .eq("id", existingId);
    if (error) throw new Error(error.message);
    return existingId;
  }

  const { data, error } = await supabase
    .from("resources")
    .insert({ ...payload, created_at: now })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}
