// GTS 수업 흐름 팁 — 실전 활동 라이브러리

import { GREETING_TIPS_NEW } from "./greetingTipsNew.js";

/** GTS 수업 기본 대형: 벽 라인에 앉기 */
const GTS_LINE_UP = "아이들을 벽 라인에 붙여 일렬로 앉힌다.";
const GTS_LINE_ALIGN = "엉덩이가 벽에 닿도록 정렬한다.";

const DEFAULT_STEPS = [
  GTS_LINE_UP,
  GTS_LINE_ALIGN,
  "활동 목적을 한 문장으로 설명한다.",
  "선생님이 시범을 보여준다.",
  "앉은 채 벽 라인을 유지하며 전체가 따라 한다.",
  "마무리 멘트로 다음 단계로 자연스럽게 넘긴다.",
];

export const TIP_CATEGORIES = [
  { id: "greeting", label: "인사" },
  { id: "warmup", label: "준비운동" },
  { id: "gear", label: "교구활동" },
  { id: "game", label: "게임" },
  { id: "wrapup", label: "마무리" },
  { id: "veteran", label: "베테랑 노하우" },
];

function act(
  cat, id, title, summary, tags, icon,
  steps, benefits, tips, info,
  description,
) {
  return {
    id: `${cat}-${id}`,
    cat,
    icon,
    title,
    summary,
    description: description ?? summary,
    tags,
    steps,
    benefits,
    tips,
    info,
  };
}

/** 인사 신규 데이터(title) → 기존 id·icon 매핑 */
const GREETING_META_BY_TITLE = {
  "롤링 인사": { id: "rolling", icon: "rotate" },
  "이름 외치기 인사": { id: "name-shout", icon: "mic" },
  "눈 맞춤 인사": { id: "eye-contact", icon: "eye" },
  "거울 인사": { id: "mirror", icon: "users" },
  "오늘 날씨 인사": { id: "weather", icon: "sun" },
  "박수 리듬 인사": { id: "clap-rhythm", icon: "music" },
  "스트레칭 인사": { id: "stretch-hello", icon: "stretch" },
  "파트너 웨이브": { id: "partner-wave", icon: "hand" },
  "표정 인사": { id: "emoji-face", icon: "sparkles" },
  "줄앉기 인사": { id: "line-pass", icon: "arrow" },
  "영어 체인 인사": { id: "english-chain", icon: "message" },
  "점프 인사": { id: "jump-hello", icon: "zap" },
  "속삭임 인사": { id: "whisper-hello", icon: "wind" },
  "라인 웨이브": { id: "circle-wave", icon: "circle" },
  "선생님 픽 인사": { id: "teacher-choice", icon: "star" },
  "숫자 인사": { id: "count-hello", icon: "dot" },
  "느리게-빠르게 인사": { id: "slow-fast", icon: "timer" },
  "감사 인사 시작": { id: "thank-you-start", icon: "heart" },
};

function greetingFromNew(item) {
  const meta = GREETING_META_BY_TITLE[item.title];
  if (!meta) throw new Error(`Unknown greeting title: ${item.title}`);
  return act(
    "greeting", meta.id, item.title, item.desc, item.tags, meta.icon,
    item.steps, item.whyGood, item.tips,
    {
      duration: item.duration,
      age: item.ageRange,
      type: item.type,
      materials: item.materials,
    },
  );
}

function quick(cat, id, title, summary, tags, icon, overrides = {}) {
  return act(
    cat, id, title, summary, tags, icon,
    overrides.steps ?? DEFAULT_STEPS,
    overrides.benefits ?? [
      "수업 흐름을 자연스럽게 이어줍니다.",
      "아이들의 참여 의욕을 높입니다.",
      "현장에서 바로 적용하기 쉽습니다.",
    ],
    overrides.tips ?? [
      "처음 만나는 반에 효과적입니다.",
      "에너지가 낮은 반에는 리듬을 빠르게 가져가세요.",
      "영어 표현과 연결하면 더 좋습니다.",
    ],
    {
      duration: "2~3분",
      age: "3~7세",
      type: "활동형",
      materials: "없음",
      ...overrides.info,
    },
  );
}

// ── 인사 (20) ──────────────────────────────────────────
const GREETING = [
  act("greeting", "hi-five", "하이파이브 인사",
    "친구들과 하이파이브를 나누며 활기차게 수업을 시작하는 방법",
    ["활동적", "협동", "분위기UP"], "hand",
    [
      GTS_LINE_UP,
      GTS_LINE_ALIGN,
      "선생님이 Hello를 외친다.",
      "옆 친구와 하이파이브하며 인사한다.",
      "한 명씩 차례로 인사할 수도 있다.",
      "마지막에 Let's Go! 외치며 시작한다.",
    ],
    [
      "첫 수업 분위기를 빠르게 만든다.",
      "친구 간 어색함을 줄여준다.",
      "에너지를 자연스럽게 올려준다.",
    ],
    [
      "처음 만나는 반에 효과적",
      "에너지가 낮은 반에 추천",
      "영어 표현 연결 가능 (Hello, High-five, Let's go)",
    ],
    { duration: "2~3분", age: "3~7세", type: "협동형 / 활동형", materials: "없음" },
  ),
  act("greeting", "animal", "동물 흉내 인사",
    "동물 움직임을 따라 하며 인사하는 창의적 인사 활동",
    ["신체활동", "창의성", "에너지발산"], "paw",
    [
      GTS_LINE_UP,
      "동물 카드를 보여주거나 동물 이름을 말한다.",
      "선생님이 먼저 동물 움직임을 보여준다.",
      "앉은 채 벽 라인을 유지하며 같은 동물 흉내를 내며 인사한다.",
      "다른 동물로 바꿔가며 3~4종 반복한다.",
      "마지막에 모두 함께 좋아하는 동물 포즈로 마무리한다.",
    ],
    [
      "몸을 움직이며 긴장을 풀어준다.",
      "창의적 표현 기회를 준다.",
      "아이들이 웃으며 수업에 참여한다.",
    ],
    [
      "유치원·저학년에 특히 인기",
      "영어 동물 이름과 함께하면 학습 효과 UP",
      "과흥분 아이는 마지막에 차분한 동물로 마무리",
    ],
    { duration: "3~4분", age: "3~6세", type: "활동형 / 창의형", materials: "없음 (동물 카드 있으면 더 좋음)" },
  ),
  ...GREETING_TIPS_NEW.map(greetingFromNew),
];

// ── 준비운동 (30) ─────────────────────────────────────
const WARMUP = [
  act("warmup", "head-shoulder", "머리·어깨·무릎·발",
    "전신을 부드럽게 풀어주는 기본 준비운동", ["기본", "전신", "안전"], "stretch",
    ["머리, 어깨, 무릎, 발 노래에 맞춰 벽 라인에 앉은 채 순서대로 움직인다.", "각 부위를 천천히 2회 반복한다.", "마지막에 전신 스트레칭으로 마무리한다."],
    ["전신 관절을 부드럽게 풀어준다.", "노래와 함께해 집중도가 높다.", "모든 연령에 안전하게 적용 가능하다."],
    ["수업 시작 전 필수 루틴", "영어 버전(Simon Says)으로 변형 가능", "속도는 아이들 컨디션에 맞게 조절"],
    { duration: "3~4분", age: "3~7세", type: "전신 / 기본형", materials: "없음" },
  ),
  quick("warmup", "jumping-jack", "점핑잭", "가볍게 점프하며 전신을 깨우는 준비운동", ["유산소", "에너지UP"], "zap"),
  quick("warmup", "arm-circle", "팔 돌리기", "작은 원에서 큰 원으로 팔을 돌리는 어깨 풀기", ["어깨", "관절"], "rotate"),
  quick("warmup", "leg-swing", "다리 스윙", "앞뒤·좌우로 다리를 가볍게 흔드는 하체 풀기", ["하체", "균형"], "footprints"),
  quick("warmup", "ankle-roll", "발목 돌리기", "한 발씩 들고 발목을 안팎으로 돌리기", ["발목", "안전"], "circle"),
  quick("warmup", "side-stretch", "옆구리 스트레칭", "팔을 위로 뻗어 옆구리를 늘리는 스트레칭", ["유연성", "코어"], "stretch"),
  quick("warmup", "march", "제자리 걷기", "무릎을 높이 들며 리듬감 있게 제자리 걷기", ["기본", "리듬"], "footprints"),
  quick("warmup", "high-knee", "하이니", "무릎을 가슴까지 높이 들어 올리기", ["하체", "활동적"], "activity"),
  quick("warmup", "butt-kick", "힐킥", "뒤꿈치를 엉덩이에 닿게 가볍게 차기", ["하체", "유산소"], "flame"),
  quick("warmup", "torso-twist", "상체 비틀기", "팔꿈치를 들고 좌우로 상체 비틀기", ["허리", "코어"], "rotate"),
  quick("warmup", "toe-touch", "손끝발끝", "천천히 상하로 몸을 굽혀 스트레칭", ["유연성", "천천히"], "stretch"),
  quick("warmup", "frog-jump", "개구리 점프", "쪼그려 앉았다 작게 점프하는 재미 준비운동", ["재미", "하체"], "paw"),
  quick("warmup", "airplane", "비행기 자세", "한 발을 들고 팔을 벌려 균형 잡기", ["균형", "집중"], "wind"),
  quick("warmup", "cat-cow", "고양이-소 자세", "네 발 기기 자세에서 등을 둥글게·펴기", ["척추", "유연성"], "paw"),
  quick("warmup", "shoulder-shrug", "어깨 으쓱", "어깨를 올렸다 내리며 긴장 풀기", ["어깨", "이완"], "dumbbell"),
  quick("warmup", "wrist-roll", "손목 풀기", "손목을 원을 그리며 돌리기", ["손목", "안전"], "hand"),
  quick("warmup", "star-jump", "스타 점프", "팔다리를 벌리며 작게 점프", ["전신", "에너지"], "sparkles"),
  quick("warmup", "cross-crawl", "교차 크롤", "반대쪽 팔·다리를 교차하며 움직이기", ["협응", "뇌활성"], "shuffle"),
  quick("warmup", "heel-toe", "뒤꿈치-발끝", "뒤꿈치와 발끝을 번갈아 디디기", ["발", "균형"], "footprints"),
  quick("warmup", "side-step", "사이드 스텝", "좌우로 걸으며 옆구리 풀기", ["하체", "리듬"], "arrow"),
  quick("warmup", "knee-hug", "무릎 안아주기", "한 발씩 들어 무릎을 가슴에 안아주기", ["균형", "스트레칭"], "heart"),
  quick("warmup", "rainbow-stretch", "무지개 스트레칭", "팔을 크게 원을 그리며 몸을 늘리기", ["전신", "창의"], "sun"),
  quick("warmup", "breath-balloon", "풍선 호흡", "배에 힘을 주었다 빼며 깊게 호흡하기", ["호흡", "진정"], "wind"),
  quick("warmup", "animal-walk-1", "곰 걷기", "네 발로 기어 천천히 이동하며 워밍업", ["전신", "재미"], "paw"),
  quick("warmup", "animal-walk-2", "토끼 뛰기", "작은 점프로 앞으로 이동", ["하체", "에너지"], "paw"),
  quick("warmup", "animal-walk-3", "게 걷기", "엉덩이를 들고 옆으로 이동", ["상체", "협응"], "paw"),
  quick("warmup", "freeze-dance", "프리즈 댄스", "음악에 맞춰 움직이다 멈추기", ["리듬", "집중"], "music"),
  quick("warmup", "count-stretch", "숫자 스트레칭", "1~10까지 세며 점점 크게 스트레칭", ["숫자", "전신"], "dot"),
  quick("warmup", "partner-stretch", "파트너 스트레칭", "짝과 마주 보고 가볍게 스트레칭", ["협동", "관계"], "users"),
  quick("warmup", "slow-to-fast", "느리게→빠르게", "동작 속도를 점점 올리며 몸 깨우기", ["리듬", "에너지조절"], "timer"),
];

// ── 교구활동 (36) ───────────────────────────────────────
const GEAR = [
  act("gear", "ball-roll", "공 굴리기 기본",
    "공을 앞으로 굴려 목표 지점까지 보내는 기초 교구 활동", ["기본", "협응", "레벨1"], "circle",
    ["아이들에게 공을 한 개씩 나눠준다.", GTS_LINE_UP, "무릎 높이에서 공을 앞으로 굴린다.", "목표 콘까지 도달하면 박수.", "2~3회 반복 후 거리를 조금 늘린다."],
    ["기본적인 손·눈 협응을 기른다.", "교구에 대한 긍정적 경험을 만든다.", "규칙 이해를 자연스럽게 익힌다."],
    ["처음 교구 수업에 최적", "공 크기는 아이 손에 맞게", "바닥 마찰 고려해 거리 조절"],
    { duration: "5~7분", age: "3~5세", type: "기초 / 개인형", materials: "소프트볼" },
  ),
  quick("gear", "hoop-step", "후프 밟기", "후프 안에 한 발씩 넣었다 빼기", ["균형", "기초", "레벨1"], "circle", { info: { duration: "5분", materials: "후프" } }),
  quick("gear", "cone-touch", "콘 터치", "콘을 돌며 손으로 터치하기", ["이동", "기초", "레벨1"], "triangle", { info: { duration: "5분", materials: "콘" } }),
  quick("gear", "beanbag-hold", "콩주머니 들기", "콩주머니를 머리·어깨·무릎에 올려보기", ["균형", "기초", "레벨1"], "square", { info: { duration: "5분", materials: "콩주머니" } }),
  quick("gear", "rope-walk", "로프 위 걷기", "바닥에 놓인 로프 위를 한 발씩 걷기", ["균형", "집중", "레벨1"], "arrow", { info: { duration: "5분", materials: "로프" } }),
  quick("gear", "ball-catch", "공 받기 기초", "가까운 거리에서 공을 두 손으로 받기", ["협응", "기초", "레벨1"], "circle", { info: { duration: "5~7분", materials: "소프트볼" } }),
  quick("gear", "hoop-pass", "후프 전달", "옆 사람에게 후프를 전달하는 협동 활동", ["협동", "기초", "레벨1"], "users", { info: { duration: "5분", materials: "후프" } }),
  quick("gear", "cone-weave", "콘 지그재그", "콘 사이를 지그재그로 걷기", ["이동", "기초", "레벨1"], "shuffle", { info: { duration: "5~7분", materials: "콘 4~6개" } }),
  quick("gear", "mat-sit-balance", "매트 위 균형", "매트 위에서 한 발 서기", ["균형", "안전", "레벨1"], "stretch", { info: { duration: "5분", materials: "매트" } }),
  quick("gear", "ball-kick-soft", "공 살살 차기", "공을 살살 발로 차서 앞으로 보내기", ["하체", "기초", "레벨1"], "footprints", { info: { duration: "5분", materials: "소프트볼" } }),
  quick("gear", "pin-touch", "핀 터치 런", "핀에 닿지 않고 주변을 돌기", ["이동", "기초", "레벨1"], "target", { info: { duration: "5분", materials: "핀" } }),
  quick("gear", "tunnel-crawl", "터널 기어가기", "간이 터널을 기어 통과하기", ["전신", "재미", "레벨1"], "arrow", { info: { duration: "5분", materials: "터널(또는 의자)" } }),
  act("gear", "ball-throw-catch", "공 던지고 받기",
    "짝과 일정 거리에서 공을 주고받는 협응 활동", ["협응", "협동", "레벨2"], "circle",
    ["짝을 정해 마주 선다.", "가슴 높이에서 공을 던진다.", "두 손으로 받고 다시 던진다.", "5회 성공하면 거리를 한 걸음 늘린다."],
    ["손·눈 협응이 발달한다.", "파트너와의 협력을 배운다.", "성공 경험이 자신감을 높인다."],
    ["거리는 처음에 짧게", "못 받아도 비난하지 않기", "영어: Throw, Catch 연결"],
    { duration: "7~10분", age: "4~6세", type: "협동형", materials: "소프트볼" },
  ),
  quick("gear", "hoop-toss", "후프 던지기", "후프를 목표 막대에 걸기", ["목표", "협응", "레벨2"], "target", { info: { duration: "7분", materials: "후프, 막대" } }),
  quick("gear", "cone-dribble", "콘 사이 드리블", "공을 콘 사이로 굴리며 이동", ["협응", "이동", "레벨2"], "shuffle", { info: { duration: "7~10분", materials: "공, 콘" } }),
  quick("gear", "relay-baton", "바통 릴레이", "바통을 전달하며 달리는 릴레이", ["팀", "속도", "레벨2"], "arrow", { info: { duration: "10분", materials: "바통(또는 콘)" } }),
  quick("gear", "beanbag-toss", "콩주머니 던지기", "후프 안에 콩주머니 넣기", ["목표", "협응", "레벨2"], "target", { info: { duration: "7분", materials: "콩주머니, 후프" } }),
  quick("gear", "rope-jump-basic", "줄넘기 기본", "줄을 돌리며 제자리에서 뛰기", ["유산소", "리듬", "레벨2"], "rotate", { info: { duration: "7~10분", materials: "줄넘기" } }),
  quick("gear", "obstacle-1", "장애물 코스 1", "콘·후프·매트를 조합한 기본 코스", ["전신", "이동", "레벨2"], "layers", { info: { duration: "10분", materials: "콘, 후프, 매트" } }),
  quick("gear", "ball-roll-aim", "공 굴리기 정확도", "정해진 목표에 공을 정확히 굴리기", ["정확도", "협응", "레벨2"], "circle", { info: { duration: "7분", materials: "공, 콘" } }),
  quick("gear", "partner-balance", "파트너 균형", "짝과 함께 콩주머니를 옮기기", ["협동", "균형", "레벨2"], "users", { info: { duration: "7분", materials: "콩주머니" } }),
  quick("gear", "hoop-roll", "후프 굴리기", "후프를 굴려 목표 지점까지 보내기", ["협응", "이동", "레벨2"], "circle", { info: { duration: "7분", materials: "후프" } }),
  quick("gear", "cone-stack", "콘 쌓기", "콘을 순서대로 쌓았다 다시 정리", ["순서", "집중", "레벨2"], "triangle", { info: { duration: "5~7분", materials: "콘" } }),
  quick("gear", "mat-roll", "매트 구르기", "매트 위에서 안전하게 앞구르기", ["전신", "안전", "레벨2"], "rotate", { info: { duration: "7분", materials: "매트" } }),
  act("gear", "team-relay", "팀 릴레이 챌린지",
    "교구를 활용한 팀 대항 릴레이로 고난도 협동 활동", ["팀", "경쟁", "레벨3"], "trophy",
    ["팀을 나누고 출발선에 준비한다.", "콘을 돌고 공을 굴려 다음 팀원에게 전달.", "모든 팀원이 완주하면 종료.", "안전 규칙을 먼저 설명한다."],
    ["팀워크와 전략을 배운다.", "고강도 활동에서도 질서를 유지한다.", "성취감과 경쟁 의식을 자극한다."],
    ["인원이 많으면 팀 수 조절", "안전: 뛰는 구간과 걷는 구간 구분", "패배 팀에도 칭찬 포인트 주기"],
    { duration: "10~15분", age: "5~7세", type: "팀 / 경쟁형", materials: "콘, 공, 후프" },
  ),
  quick("gear", "obstacle-full", "통합 장애물 코스", "여러 교구를 조합한 종합 코스", ["전신", "고난도", "레벨3"], "layers", { info: { duration: "12~15분", materials: "콘, 후프, 매트, 공" } }),
  quick("gear", "accuracy-challenge", "정확도 챌린지", "목표 지점에 연속 성공 도전", ["정확도", "집중", "레벨3"], "target", { info: { duration: "10분", materials: "공, 콘" } }),
  quick("gear", "speed-relay", "스피드 릴레이", "시간을 재며 빠르게 완주하는 릴레이", ["속도", "경쟁", "레벨3"], "timer", { info: { duration: "10~12분", materials: "콘, 바통" } }),
  quick("gear", "partner-trust", "파트너 신뢰 활동", "짝의 안내를 받으며 코스 완주", ["신뢰", "협동", "레벨3"], "users", { info: { duration: "10분", materials: "콘, 매트" } }),
  quick("gear", "multi-skill", "복합 스킬 스테이션", "4개 스테이션을 순환하며 활동", ["순환", "다양성", "레벨3"], "shuffle", { info: { duration: "15분", materials: "교구 세트" } }),
  quick("gear", "team-strategy", "팀 전략 게임", "팀이 순서와 역할을 정해 과제 수행", ["전략", "팀", "레벨3"], "lightbulb", { info: { duration: "12분", materials: "교구 세트" } }),
  quick("gear", "blindfold-guide", "눈가리고 안내", "짝이 말로 안내하며 코스 통과", ["신뢰", "소통", "레벨3"], "eye", { info: { duration: "10분", materials: "콘, 안대(선택)" } }),
  quick("gear", "timed-challenge", "타임 챌린지", "제한 시간 안에 미션 완수", ["시간", "집중", "레벨3"], "timer", { info: { duration: "10~12분", materials: "교구 세트" } }),
  quick("gear", "creative-course", "코스 만들기", "아이들이 직접 코스를 설계", ["창의", "자율", "레벨3"], "sparkles", { info: { duration: "12~15분", materials: "교구 세트" } }),
  quick("gear", "champion-round", "챔피언 라운드", "1차 통과자만 다음 라운드 진출", ["경쟁", "동기", "레벨3"], "star", { info: { duration: "12분", materials: "교구 세트" } }),
  quick("gear", "coach-turn", "아이 코치", "아이가 다음 친구에게 방법 알려주기", ["리더십", "협동", "레벨3"], "star", { info: { duration: "10분", materials: "교구 세트" } }),
];

// ── 게임 (50) ───────────────────────────────────────────
const GAME_TITLES = [
  ["simon-says", "Simon Says", "선생님 지시에 따라 움직이는 집중 게임", ["집중", "영어", "기본"], "target"],
  ["red-light", "Red Light Green Light", "신호에 맞춰 멈추고 가는 달리기 게임", ["달리기", "집중", "인기"], "timer"],
  ["freeze-tag", "꼭꼭 묶어라", "움직이면 잡히는 프리즈 게임", ["달리기", "에너지", "인기"], "zap"],
  ["duck-duck", "오리 오리", "벽 라인에 앉은 채 한 명이 돌며 오리·거위를 정하는 게임", ["라인", "재미", "기본"], "circle"],
  ["musical-chair", "의자 뺏기", "음악이 멈추면 의자 찾기", ["음악", "반응", "인기"], "music"],
  ["hot-potato", "뜨거운 감자", "벽 라인에 앉아 공을 빠르게 넘기는 게임", ["협동", "속도", "기본"], "circle"],
  ["hula-hoop", "후프 넘기", "후프를 허리에 돌리기 챌린지", ["협응", "재미"], "rotate"],
  ["beanbag-race", "콩주머니 경주", "머리에 얹고 걷기 레이스", ["균형", "재미"], "square"],
  ["balloon-tap", "풍선 터치", "풍선이 떨어지기 전 터치하기", ["반응", "재미"], "wind"],
  ["shadow-copy", "그림자 따라하기", "선생님 동작을 따라 하는 게임", ["모방", "집중"], "users"],
  ["animal-race", "동물 달리기", "동물 흉내 내며 달리기", ["신체", "창의"], "paw"],
  ["color-hunt", "색깔 찾기", "지정 색 사물·콘 찾아오기", ["관찰", "영어"], "eye"],
  ["number-hunt", "숫자 찾기", "숫자 카드·콘을 순서대로 찾기", ["숫자", "집중"], "dot"],
  ["line-walk", "줄 위 걷기", "로프 위에서 균형 게임", ["균형", "집중"], "arrow"],
  ["ball-pass", "공 전달 게임", "벽 라인에 앉아 옆으로 공을 빠르게 전달", ["협동", "속도"], "circle"],
  ["hoop-hop", "후프 뛰어넘기", "바닥 후프를 순서대로 뛰어넘기", ["하체", "순서"], "zap"],
  ["cone-relay", "콘 릴레이", "콘을 옮기며 달리는 릴레이", ["팀", "달리기"], "triangle"],
  ["mirror-game", "거울 게임", "짝과 마주 보고 동작 맞추기", ["협동", "집중"], "users"],
  ["statue", "석상 게임", "음악 멈추면 얼음처럼 멈추기", ["음악", "자세"], "music"],
  ["cat-mouse", "고양이와 쥐", "쥐가 고양이를 피해 도망", ["달리기", "역할"], "paw"],
  ["traffic-light", "신호등 게임", "색에 맞춰 걷기·멈추기·천천히", ["규칙", "안전"], "timer"],
  ["balloon-volley", "풍선 배구", "풍선을 넘기며 떨어뜨리지 않기", ["협동", "재미"], "wind"],
  ["skittle-bowl", "핀 볼링", "공으로 핀을 쓰러뜨리기", ["목표", "협응"], "target"],
  ["treasure-hunt", "보물찾기", "숨겨진 콘·카드 찾기", ["관찰", "탐색"], "star"],
  ["word-chain", "단어 이어 말하기", "영어 단어를 이어 말하는 게임", ["영어", "순환"], "message"],
  ["body-part", "신체 부위 게임", "부위 이름을 말하며 터치", ["영어", "신체"], "activity"],
  ["slow-race", "느린 달리기", "가장 느리게 달리는 사람이 이기는 게임", ["역전", "재미"], "timer"],
  ["team-tug", "팀 줄다리기(가벼운)", "수건 줄다리기로 팀 대결", ["팀", "힘"], "users"],
  ["hopscotch", "사방치기", "칸을 뛰며 이동하는 전통 게임", ["하체", "균형"], "square"],
  ["jump-rope-group", "단체 줄넘기", "여럿이 함께 줄넘기", ["협동", "리듬"], "rotate"],
  ["ball-dodge", "공 피하기", "부드러운 공을 피하며 이동", ["반응", "이동"], "shuffle"],
  ["flag-grab", "깃발 뺏기", "상대 깃발을 가져오기", ["팀", "전략"], "flag"],
  ["obstacle-race", "장애물 달리기", "간단 코스를 빠르게 완주", ["속도", "이동"], "layers"],
  ["quiet-game", "조용한 게임", "가장 조용히 미션 수행", ["자기조절", "집중"], "wind"],
  ["giant-step", "왕 걸음", "큰 걸음으로 목표까지 이동", ["이동", "거리"], "footprints"],
  ["back-to-back", "등 맞대기", "등을 맞대고 일어나기", ["협동", "신뢰"], "users"],
  ["circle-squeeze", "라인 조이기", "앉은 채 벽 라인에서 간격을 좁혔다 넓혔다 하기", ["협동", "공간"], "circle"],
  ["name-ball", "이름 공 던지기", "벽 라인에 앉아 이름을 부르며 공 던지기", ["이름", "집중"], "circle"],
  ["emotion-guess", "표정 맞히기", "표정으로 감정 맞히기", ["정서", "관찰"], "sparkles"],
  ["copy-clap", "박수 따라하기", "박수 패턴을 따라 하기", ["리듬", "집중"], "music"],
  ["shape-run", "도형 달리기", "도형 위치로 달려가기", ["이동", "도형"], "triangle"],
  ["letter-hunt", "알파벳 찾기", "바닥 알파벳 카드 찾기", ["영어", "탐색"], "book"],
  ["balance-challenge", "균형 챌린지", "한 발 서기 대결", ["균형", "경쟁"], "stretch"],
  ["team-puzzle", "팀 퍼즐", "팀이 함께 퍼즐·미션 완성", ["팀", "문제해결"], "layers"],
  ["speed-touch", "스피드 터치", "콘을 빠르게 터치하고 돌아오기", ["속도", "반응"], "zap"],
  ["relay-laugh", "웃음 릴레이", "웃지 않으려 하다 웃기는 릴레이", ["유머", "분위기"], "heart"],
  ["direction-game", "방향 게임", "Left/Right 지시에 맞춰 이동", ["영어", "방향"], "arrow"],
  ["countdown-race", "카운트다운 레이스", "3-2-1 후 출발하는 레이스", ["반응", "긴장감"], "timer"],
  ["team-cheer", "팀 응원 대결", "팀별 응원 구호 대결", ["팀", "분위기"], "mic"],
  ["cool-down-game", "쿨다운 게임", "천천히 움직이며 마무리하는 가벼운 게임", ["이완", "마무리"], "wind"],
];

const GAME = GAME_TITLES.map(([id, title, summary, tags, icon]) =>
  quick("game", id, title, summary, tags, icon, {
    info: { duration: "5~10분", age: "3~7세", type: "게임형", materials: "상황에 따라 다름" },
  }),
);

const GAME_STEP_PATCHES = {
  "game-duck-duck": [
    GTS_LINE_UP,
    "한 명이 벽 라인 옆을 따라 걸으며 오리·거위를 정한다.",
    "선정된 아이는 라인 끝까지 달려간다.",
    "게임을 2~3회 반복한다.",
  ],
  "game-hot-potato": [
    GTS_LINE_UP,
    "벽 라인에 앉아 공을 옆 친구에게 빠르게 넘긴다.",
    "음악이 멈추면 공을 든 아이는 가볍게 제재 동작을 한다.",
    "속도를 조절하며 반복한다.",
  ],
  "game-ball-pass": [
    GTS_LINE_UP,
    GTS_LINE_ALIGN,
    "벽 라인에 앉아 옆으로 공을 빠르게 전달한다.",
    "한 바퀴 돌아오면 방향을 바꿔 반복한다.",
  ],
  "game-circle-squeeze": [
    GTS_LINE_UP,
    "앉은 채 옆 친구에 가까워지도록 살짝 몸을 비비며 간격을 좁힌다.",
    "신호에 맞춰 다시 원래 자리로 돌아간다.",
    "간격을 좁혔다 넓혔다 반복한다.",
  ],
  "game-name-ball": [
    GTS_LINE_UP,
    "공을 든 아이가 이름을 부르며 던진다.",
    "이름이 불린 아이가 받고 다음 사람을 부른다.",
    "앉은 채 벽 라인을 유지하며 순환한다.",
  ],
};

for (const activity of GAME) {
  if (GAME_STEP_PATCHES[activity.id]) {
    activity.steps = GAME_STEP_PATCHES[activity.id];
  }
}

// ── 마무리 (20) ─────────────────────────────────────────
const WRAPUP = [
  act("wrapup", "cool-stretch", "쿨다운 스트레칭",
    "수업 후 몸을 차분히 풀어주는 마무리 스트레칭", ["이완", "안전", "필수"], "stretch",
    ["빠른 호흡을 가라앉힌다.", "벽 라인에 앉은 채 팔·다리를 천천히 늘린다.", "깊게 숨 들이쉬고 내쉰다.", "Good job 멘트로 마무리한다."],
    ["근육 긴장을 풀어준다.", "다음 활동으로 안전하게 전환한다.", "수업 종료 루틴을 만든다."],
    ["모든 수업 끝에 2~3분 권장", "뛰는 활동 후 필수", "영어: Stretch, Breathe, Well done"],
    { duration: "2~3분", age: "전연령", type: "이완형", materials: "없음" },
  ),
  quick("wrapup", "good-job-circle", "Good Job 마무리", "벽 라인에 앉아 서로 칭찬하며 마무리", ["칭찬", "관계"], "heart", {
    steps: [
      GTS_LINE_UP,
      "오늘 잘한 점을 한 가지씩 말한다.",
      "옆 친구에게 Good job! 하며 하이파이브한다.",
      "선생님이 전체를 칭찬하며 수업을 마친다.",
    ],
  }),
  quick("wrapup", "high-five-end", "하이파이브 마무리", "오늘 수업 하이파이브로 마무리", ["긍정", "에너지"], "hand"),
  quick("wrapup", "star-sticker", "스타 스티커", "오늘 잘한 점 스티커로 칭찬", ["동기", "칭찬"], "star"),
  quick("wrapup", "breath-balloon-end", "풍선 호흡 마무리", "호흡으로 차분히 마무리", ["호흡", "이완"], "wind"),
  quick("wrapup", "today-best", "오늘의 베스트", "오늘 가장 잘한 일 한 가지 말하기", ["성찰", "자신감"], "sparkles"),
  quick("wrapup", "thank-you", "감사 인사", "함께해줘서 고마워 인사", ["정서", "관계"], "heart"),
  quick("wrapup", "see-you", "See You Song", "노래와 함께 See you next time", ["영어", "노래"], "music"),
  quick("wrapup", "line-up-quiet", "조용히 대기", "벽 라인에 조용히 앉아 다음 활동 대기", ["질서", "전환"], "arrow", {
    steps: [
      GTS_LINE_UP,
      GTS_LINE_ALIGN,
      "손을 모으고 조용히 기다린다.",
      "선생님 신호에 맞춰 다음 활동으로 이동한다.",
    ],
  }),
  quick("wrapup", "stretch-song", "스트레칭 송", "노래에 맞춰 가볍게 스트레칭", ["노래", "이완"], "music"),
  quick("wrapup", "partner-thanks", "짝에게 감사", "짝에게 고마워 인사", ["협동", "정서"], "users"),
  quick("wrapup", "calm-sit", "앉아서 마무리", "벽 라인에 앉아 오늘 수업 한 가지 기억 말하기", ["성찰", "집중"], "book", {
    steps: [
      GTS_LINE_UP,
      GTS_LINE_ALIGN,
      "조용히 오늘 수업에서 기억나는 한 가지를 말한다.",
      "선생님이 각 아이의 이야기를 짧게 반응한다.",
      "함께 Well done! 으로 마무리한다.",
    ],
  }),
  quick("wrapup", "wave-goodbye", "손 흔들며 인사", "문 쪽을 향해 손 흔들며 Goodbye", ["인사", "전환"], "hand"),
  quick("wrapup", "energy-down", "에너지 다운", "점점 작은 동작으로 에너지 내리기", ["에너지조절", "이완"], "wind"),
  quick("wrapup", "class-cheer", "반 구호", "반 구호를 외치며 마무리", ["팀", "소속감"], "mic"),
  quick("wrapup", "tomorrow-preview", "내일 예고", "내일 할 재미있는 활동 살짝 예고", ["기대", "동기"], "lightbulb"),
  quick("wrapup", "cleanup-game", "정리 게임", "교구 정리를 게임처럼 하기", ["정리", "책임"], "blocks"),
  quick("wrapup", "meditation-kid", "짧은 명상", "눈 감고 30초 조용히 호흡", ["집중", "이완"], "eye"),
  quick("wrapup", "stamp-hand", "도장 찍기", "손에 도장 찍으며 수고했어요", ["칭찬", "동기"], "star"),
  quick("wrapup", "closing-circle", "마무리 한마디", "벽 라인에 앉아 오늘 한마디씩", ["소통", "마무리"], "circle", {
    steps: [
      GTS_LINE_UP,
      "한 명씩 차례로 오늘 한마디를 말한다.",
      "말이 끝나면 조용히 앉은 자세를 유지한다.",
      "모두 마치면 함께 See you! 로 마무리한다.",
    ],
  }),
];

// ── 베테랑 노하우 (10) ──────────────────────────────────
const VETERAN = [
  act("veteran", "energy-read", "아이 에너지 읽기",
    "수업 시작 전 아이들 컨디션과 에너지 수준을 빠르게 파악하는 법",
    ["관찰", "핵심", "노하우"], "eye",
    [
      "아이들이 교실에 들어올 때 표정, 움직임, 목소리 크기를 관찰한다.",
      "에너지가 높으면 움직임 활동 먼저, 낮으면 앉아서 하는 활동으로 시작한다.",
    ],
    [
      "수업 분위기를 미리 파악해서 계획을 유연하게 조정할 수 있음",
      "아이들이 \"선생님이 나를 봐준다\"는 느낌을 받아 신뢰감 형성",
    ],
    [
      "출석 부르면서 동시에 에너지 체크",
      "\"오늘 기분이 어때요?\" 한 마디로 빠르게 파악 가능",
    ],
    { duration: "수업 전 1~2분", age: "전 연령", type: "관찰/준비", materials: "없음" },
  ),
  act("veteran", "plan-b", "플랜 B 항상 준비하기",
    "주 활동이 안 될 때 바로 전환할 대체 활동을 미리 준비하는 법",
    ["준비", "핵심", "노하우"], "lightbulb",
    [
      "매 수업마다 주 활동이 실패했을 때를 대비한 대체 활동 1개를 미리 준비한다.",
      "교구가 부족하거나 아이들 반응이 없을 때 바로 플랜 B로 전환한다.",
    ],
    [
      "당황하지 않고 자연스럽게 수업을 이어갈 수 있음",
      "베테랑 선생님처럼 보임",
    ],
    [
      "항상 \"공 하나로 할 수 있는 활동\"을 플랜 B로 준비해두면 어떤 상황에서도 대응 가능",
    ],
    { duration: "수업 전 5분 (준비 시간)", age: "전 연령", type: "수업 준비", materials: "대체 활동 카드 또는 메모" },
  ),
  act("veteran", "voice-control", "목소리 톤 조절",
    "크기·속도·톤으로 아이들의 집중을 자연스럽게 끄는 법",
    ["소통", "핵심", "노하우"], "mic",
    [
      "활동적인 구간은 크고 신나는 목소리를 사용한다.",
      "설명할 때는 낮고 차분한 목소리를 사용한다.",
      "집중시킬 때는 속삭이듯 작은 목소리를 사용한다.",
    ],
    [
      "아이들이 목소리 변화에 반응해서 자연스럽게 집중함",
      "선생님 목도 덜 피로함",
    ],
    [
      "아이들이 시끄러울 때 더 크게 말하지 말고 오히려 더 작게 말해보기",
      "효과 즉각적",
    ],
    { duration: "수업 전반", age: "전 연령", type: "수업 운영", materials: "없음" },
  ),
  act("veteran", "transition-smooth", "전환 30초",
    "활동 사이를 30초 안에 매끄럽게 넘기는 법",
    ["흐름", "핵심", "노하우"], "arrow",
    [
      "한 활동에서 다음 활동으로 넘어갈 때 \"3, 2, 1\" 카운트다운 또는 짧은 구령으로 30초 안에 전환한다.",
      "\"Freeze! Let's move to~\" 같은 신호를 사용한다.",
    ],
    [
      "수업 흐름이 끊기지 않고 아이들이 다음 활동에 집중 준비가 됨",
    ],
    [
      "매번 같은 전환 신호를 쓰면 아이들이 자동으로 반응하게 됨",
      "첫 3주가 중요",
    ],
    { duration: "활동 사이 30초", age: "전 연령", type: "수업 운영", materials: "없음" },
  ),
  act("veteran", "praise-specific", "구체적 칭찬",
    "\"잘했어요\" 대신 무엇을 잘했는지 구체적으로 칭찬하는 법",
    ["칭찬", "동기", "노하우"], "heart",
    [
      "\"Good job!\" 대신 \"Great! You kicked the ball with your right foot!\"처럼 무엇을 잘했는지 구체적으로 말해준다.",
    ],
    [
      "아이가 어떤 행동이 칭찬받은 건지 정확히 알게 됨",
      "같은 행동을 반복하려는 동기가 생김",
    ],
    [
      "영어 표현 3~5개 미리 준비해두면 자연스럽게 나옴",
      "\"I love how you~\", \"Amazing, you just~\"",
    ],
    { duration: "수업 전반 (즉각 사용)", age: "전 연령", type: "동기부여", materials: "없음" },
  ),
  act("veteran", "rule-simple", "규칙 3개의 원칙",
    "수업 규칙을 3개 이하로 정하고 매 수업 시작 때 함께 외치는 법",
    ["규칙", "질서", "노하우"], "book",
    [
      "수업 규칙을 3개 이하로만 정한다.",
      "매 수업 시작 때 함께 외친다. 예) \"Listen, Try, Have fun!\"",
    ],
    [
      "규칙이 많으면 아이들이 기억 못함",
      "3개는 기억하기 쉽고 반복하면 습관이 됨",
    ],
    [
      "규칙을 손동작과 함께 만들면 더 잘 기억함",
      "아이들과 함께 규칙을 만들면 지킬 가능성이 높아짐",
    ],
    { duration: "수업 시작 1~2분", age: "3세 이상", type: "수업 운영", materials: "규칙 카드 (선택)" },
  ),
  act("veteran", "attention-reset", "집중 리셋",
    "아이들이 산만해졌을 때 1~2분 안에 집중을 되돌리는 법",
    ["집중", "현장", "노하우"], "target",
    [
      "아이들이 산만해졌을 때 짧은 스트레칭, 깊게 숨쉬기, 또는 \"Simon says\" 같은 짧은 집중 게임으로 리셋한다.",
    ],
    [
      "억지로 집중시키려 하면 역효과",
      "짧게 환기시키면 다시 수업에 집중하게 됨",
    ],
    [
      "\"Let's take 3 deep breaths together\" 하나만 있어도 충분",
      "선생님도 같이 하면 효과 2배",
    ],
    { duration: "1~2분", age: "전 연령", type: "집중력 회복", materials: "없음" },
  ),
  act("veteran", "pair-strategy", "짝 정하기",
    "짝 활동 전에 공평하고 빠르게 짝을 정해주는 법",
    ["협동", "관계", "노하우"], "users",
    [
      "짝 활동 전에 선생님이 미리 짝을 정해준다.",
      "색깔, 번호, 동물 이름 등으로 랜덤하게 나눈다.",
    ],
    [
      "아이들끼리 짝 고르면 시간 낭비와 소외되는 아이가 생김",
      "선생님이 정하면 공평하고 빠름",
    ],
    [
      "\"Find someone wearing blue!\" 같은 방식으로 영어로 짝 만들기 가능",
      "수업 내용과 연결하면 일석이조",
    ],
    { duration: "30초~1분", age: "4세 이상", type: "수업 운영", materials: "없음" },
  ),
  act("veteran", "time-buffer", "시간 버퍼",
    "수업이 빨리 끝났을 때 쓸 3~5분 여분 활동을 항상 준비하는 법",
    ["시간", "계획", "노하우"], "timer",
    [
      "계획한 활동이 예상보다 빨리 끝났을 때를 대비해 3~5분짜리 간단한 활동을 항상 준비한다.",
      "수업 끝 여유 시간용으로도 활용한다.",
    ],
    [
      "수업이 애매하게 끝나지 않고 자연스럽게 마무리됨",
      "선생님이 당황하지 않아도 됨",
    ],
    [
      "\"영어 단어 빙고\" 또는 \"공 패스하며 단어 말하기\" 같은 간단한 활동을 버퍼로 사용",
    ],
    { duration: "수업 마지막 3~5분", age: "전 연령", type: "수업 운영", materials: "여분 활동 1개" },
  ),
  act("veteran", "end-strong", "마무리가 기억에 남는다",
    "수업 마지막 2~3분으로 오늘 배운 것과 다음 수업 기대감을 남기는 법",
    ["마무리", "핵심", "노하우"], "flag",
    [
      "수업 끝에 오늘 배운 것을 한 문장으로 정리한다.",
      "다음 수업 기대감을 심어주는 말로 마무리한다. \"Today we learned~, Next time we will~!\"",
    ],
    [
      "심리학적으로 마지막 경험이 가장 오래 기억됨 (Peak-End Rule)",
      "좋은 마무리가 다음 수업 기대감으로 이어짐",
    ],
    [
      "아이들이 집에 가서 부모님께 오늘 배운 것을 말할 수 있게 한 문장만 뽑아주기",
      "\"Tell your mom you learned how to~\"",
    ],
    { duration: "수업 마지막 2~3분", age: "전 연령", type: "수업 마무리", materials: "없음" },
  ),
];

export const activities = [
  ...GREETING,
  ...WARMUP,
  ...GEAR,
  ...GAME,
  ...WRAPUP,
  ...VETERAN,
];

/** @deprecated use `activities` — kept for landing stat compat */
export const tips = activities;

export function getCategoryCounts() {
  const counts = {};
  for (const cat of TIP_CATEGORIES) {
    counts[cat.id] = activities.filter(a => a.cat === cat.id).length;
  }
  counts.all = activities.length;
  return counts;
}
