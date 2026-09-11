export * from "./contractFields.js";
import { COMPANY_NAME, COMPANY_CEO, EDITABLE_CONTRACT_SECTIONS, contractParagraphEditKey, rateError, validateContractIssueInput, formatResidentFront, formatRateLine, formatWon, formatYmd } from "./contractFields.js";

function applySectionEdits(sections, edits) {
  if (edits == null) return sections;
  if (typeof edits !== "object" || Array.isArray(edits)) throw rateError("수정한 계약 내용을 확인해 주세요.", "section_edits");
  const paragraphTargets = sections.flatMap((section, si) => section.paragraphs.map((text, pi) => ({ si, pi, key: contractParagraphEditKey(si, pi, text) })));
  let total = 0;
  for (const [key, value] of Object.entries(edits)) {
    const index = Number(key);
    const paragraphTarget = paragraphTargets.find(item => item.key === key);
    if ((!paragraphTarget && (String(index) !== key || !EDITABLE_CONTRACT_SECTIONS.includes(index))) || typeof value !== "string") {
      throw rateError("이 항목은 계약정보 입력 화면에서 수정해 주세요.", "section_edits");
    }
    const text = value.trim();
    total += text.length;
    if (!text || text.length > 6000 || total > 30000 || /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(text)) {
      throw rateError("각 조항은 1~6,000자, 전체 수정 내용은 30,000자 이내로 입력해 주세요.", "section_edits");
    }
    if (paragraphTarget) {
      const section = sections[paragraphTarget.si];
      section.paragraphs[paragraphTarget.pi] = text;
    } else {
      sections[index] = { ...sections[index], paragraphs: text.split(/\n+/).filter(Boolean) };
    }
  }
  return sections;
}

export function buildContractDocument(input) {
  const parsed = validateContractIssueInput(input);
  const regular = parsed.rates.find((r) => r.rate_type === "regular");
  const afterSchool = parsed.rates.find((r) => r.rate_type === "after_school");
  const extras = parsed.rates.filter((r) => r.rate_type !== "regular" && r.rate_type !== "after_school");
  const additionalLines = extras.map(formatRateLine);
  const placeholders = {
    teacher_name: parsed.teacherName,
    teacher_phone: parsed.teacherPhone || "미등록",
    resident_number_front: formatResidentFront(parsed.residentFront),
    contract_start_date: formatYmd(parsed.startDate),
    contract_end_date: formatYmd(parsed.endDate),
    contract_date: formatYmd(parsed.contractDate),
    regular_rate: formatWon(regular?.amount),
    after_school_rate: formatWon(afterSchool?.amount),
    additional_rates_list: additionalLines.join("\n"),
    company_signature: `${COMPANY_NAME} / ${COMPANY_CEO}`,
    teacher_signature: "(전자서명)",
    signed_at: "",
    contract_type: parsed.contractType,
  };

  const amountParagraphs = [
    "1. ‘갑’은 ‘을’이 수행한 교육 용역에 대하여 수업 횟수 및 단가 기준으로 산정된 정산금을 지급한다.",
    "2. 수업료는 다음 단가 기준으로 진행한다.",
    ...(regular ? [`정규수업: 시간당 ${placeholders.regular_rate}원`] : []),
    `방과후수업: 시간당 ${placeholders.after_school_rate}원`,
    ...(additionalLines.length ? ["추가 지급 기준", ...additionalLines] : []),
    "3. 정산금은 근로의 대가가 아닌 교육용역 수행 결과에 대한 보수로 한다.",
    "4. ‘갑’은 매월 수행 내역 확인 후 익월 10일까지 사업소득세 및 지방소득세 3.3%를 공제한 금액을 지급한다.",
    "5. 실제 수행되지 않은 수업에 대해서는 정산하지 않는다.",
    "6. ‘을’이 지급받을 계좌를 변경할 경우 최소 7일 전에 통보하여야 한다.",
  ];

  const sections = [
    {
      heading: "",
      paragraphs: [
        `본 계약은 ${COMPANY_NAME}(이하 ‘갑’)와 ${placeholders.teacher_name}(이하 ‘을’) 간에 교육 서비스 제공과 관련하여, 양 당사자의 권리와 의무를 명확히 하고자 체결된다.`,
      ],
    },
    {
      heading: "제1조【 목 적 】",
      paragraphs: [
        "본 계약은 '갑'이 '을'에게 어린이집, 유치원, 학원 및 기타 유사 교육기관 수업을 진행하는 업무를 위탁하기 위함을 목적으로 하며, 이에 따른 업무 범위, 책임, 의무 등을 명확히 규정한다.",
      ],
    },
    {
      heading: "제2조【 계 약 기 간 】",
      paragraphs: [
        `계약 기간은 ${placeholders.contract_start_date}부터 ${placeholders.contract_end_date}까지로 한다.`,
        "본 계약은 종료일 이전 1개월 전 서면 통지에 따라 연장 여부를 논의할 수 있다.",
        "계약 종료 또는 해지 시 을은 최대 30일의 인수인계 기간 동안 성실히 업무를 수행하며, 갑은 그 기간 동안 정상적인 용역대금을 지급한다.",
      ],
    },
    {
      heading: "제3조【 계 약 금 액 】",
      paragraphs: amountParagraphs,
    },
    {
      heading: "제4조【 업 무 수 행 및 납 품 】",
      paragraphs: [
        "’을’은 ‘갑’이 제공한 커리큘럼을 참고하여 자율적으로 수업을 구성하며, 주요 결과물에 대한 품질 기준을 충족해야 한다.",
        "계약 종료 시 모든 자료를 즉시 반환하거나 폐기한다.",
        "수업 교구는 ‘갑’이 지원하며, 사용 여부는 ‘을’의 검토 후 확정한다.",
        "분실 또는 파손 시 고의 또는 중대한 과실이 있는 경우 실제 손해 범위 내에서 배상한다.",
      ],
    },
    {
      heading: "제5조【 비 밀 유 지 】",
      paragraphs: [
        "'을'은 본 계약과 관련된 모든 정보(수업 자료, 교구, 커리큘럼, 원, 학생 정보 등)를 외부에 유출하거나 무단으로 사용하지 않을 의무를 진다.",
        "본 비밀 유지 의무는 계약 종료 후에도 2년간 유효하며, 이를 위반할 경우 '갑'은 민·형사상 책임을 청구할 수 있다.",
        "'을'은 개인정보 보호법 및 관련 법규를 준수하며, 학생 및 기관의 정보를 철저히 보호해야 한다.",
      ],
    },
    {
      heading: "제6조【 근 무 조 건 】",
      paragraphs: [
        "'을'은 '갑'과 사전 협의된 장소(어린이집, 유치원, 학원 등)에서 업무를 수행하며, 수업 외 시간에 대한 출퇴근 통제는 받지 않는다.",
        "‘을'은 계약된 업무를 성실히 수행한다. 업무 조정이 필요한 경우 '갑'과 협의하여 진행한다.",
      ],
    },
    {
      heading: "제7조【 거래처 보호 】",
      paragraphs: [
        "1. '을'은 계약기간 중 및 계약 종료 후 2년간 '갑'을 통하여 알게 된 어린이집, 유치원, 학원 및 기타 교육기관과 '갑'의 사전 서면 동의 없이 직접 계약하거나 교육용역을 제공하지 않는다.",
        "2. '을'은 '갑'의 거래처 정보를 이용하여 직접 영업하거나 제3자를 통하여 우회적으로 계약을 체결하는 행위를 하지 않는다.",
        "3. 본 조항을 위반하여 '갑'에게 손해가 발생한 경우, '갑'은 실제 발생한 손해의 범위 내에서 손해배상을 청구할 수 있다.",
      ],
    },
    {
      heading: "제8조【 계 약 관 계 】",
      paragraphs: [
        "본 계약은 근로계약이 아닌 위탁계약으로, '갑'과 '을' 사이에는 근로기준법 및 기타 노동관계법령에서 규정하는 고용관계가 성립하지 않는다.",
        "'을'은 본 계약에 따른 업무 수행과 관련하여 필요한 사항을 자율적으로 결정하며, '갑'은 '을'에게 4대 보험 가입, 퇴직금 지급 등의 고용상 의무를 부담하지 않는다.",
        "‘을’은 사업소득세 3.3% 원천징수 대상자로서, 연말정산을 직접 진행한다.",
      ],
    },
    {
      heading: "제9조【 계 약 해 지 및 종 료 】",
      paragraphs: [
        "갑과 을은 아래 사유에 따라 본 계약을 해지할 수 있다.",
        "\"갑\" 또는 \"을\"이 계약 의무를 위반했을 경우",
        "\"갑\"이 정당한 이유 없이 대금을 지급하지 않을 경우",
        "\"을\"이 수업을 무단결근, 반복지각, 기관민원, 안전사고, 품위손상의 경우",
        "“을”이 계약된 기관에서 계약을 파기할 경우",
        "계약 해지 시, '갑'과 '을'은 1개월 전 서면 통지를 통해 논의하며, '갑'은 후임 교사 채용을 신속히 진행한다.",
      ],
    },
    {
      heading: "제10조【 손 해 배 상 】",
      paragraphs: [
        "‘을’의 귀책 사유로 계약이 불이행되거나 수업이 정상적으로 진행되지 못한 경우, ‘갑’은 실제 입은 손해 범위 내에서 배상을 청구할 수 있다.",
        "‘갑’이 정당한 사유 없이 대금을 미지급하는 경우, ‘을’은 계약 해지 및 법적 조치를 취할 수 있다.",
      ],
    },
    {
      heading: "제11조【 소 송 관 할 】",
      paragraphs: [
        "본 계약과 관련하여 발생하는 모든 분쟁은 대한민국 법령을 준수하며, 서울동부지방법원을 관할법원으로 한다.",
      ],
    },
    {
      heading: "제12조【업무 지원】",
      paragraphs: [
        "'갑'은 '을'이 수업을 원활히 진행할 수 있도록 다음과 같은 지원을 제공한다.",
        "- 교육 커리큘럼 및 관련 자료 제공",
        "- 수업 진행을 위한 교구 지원",
        "- 행사 준비 및 진행 지원",
        "- 기타 수업의 원활한 운영을 위한 필요 사항 제공",
        "갑은 수업 운영에 필요한 교육 및 오리엔테이션을 실시할 수 있다.",
        "‘을'은 제공받은 교구 및 자료를 계약 외 용도로 사용하거나, 임의로 제3자에게 양도하지 않는다.",
      ],
    },
    {
      heading: "제13조【업무 장소 및 일정】",
      paragraphs: [
        "‘을'의 업무 장소와 일정은 '갑'과 합의된 내용을 기준으로 하며, 장소 및 일정은 매월 초 서면 또는 전자 문서(이메일, 카카오톡 등)를 통해 '을'에게 공지된다.",
        "업무 장소 변경 또는 일정 조정이 필요할 경우, '갑'과 '을'은 상호 협의하여 조율한다.",
      ],
    },
  ];

  sections.push({
    heading: "계약 내용 확인",
    paragraphs: ["본 계약의 당사자는 위 계약 내용을 충분히 확인하고 이에 동의하여 서명 또는 날인한다.", "체결된 계약서는 각 당사자가 전자문서로 보관한다."],
  });

  const signatureBlock = {
    heading: "서명란",
    lines: [
      `계약일자 : ${placeholders.contract_date}`,
      "",
      `회사명: ${COMPANY_NAME}`,
      `대표자: ${COMPANY_CEO}`,
      "대표자 서명: (인)",
      "",
      `성명: ${placeholders.teacher_name}`,
      `주민등록번호: ${placeholders.resident_number_front}`,
      `연락처: ${placeholders.teacher_phone}`,
      "전자서명: (서명 대기)",
    ],
  };

  return {
    ...parsed,
    title: "교육용역 위탁 계약서",
    placeholders,
    additionalLines,
    sections: applySectionEdits(sections, input.sectionEdits),
    signatureBlock,
    fileTitle: `교육용역 위탁 계약서 (${parsed.startDate} ~ ${parsed.endDate})`,
  };
}

