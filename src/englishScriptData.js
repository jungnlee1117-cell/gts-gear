export const GEAR_OPTIONS = [
  { id: "air-bridge", label: "에어브릿지" },
];

export const INSTITUTIONS = [
  { id: "daycare", label: "어린이집" },
  { id: "playschool", label: "놀이학교" },
  { id: "english", label: "영어유치원" },
  { id: "international", label: "국제학교" },
];

export const STAGES = [
  { tag: "intro", label: "교구 소개" },
  { tag: "level1", label: "Level 1" },
  { tag: "level2", label: "Level 2" },
  { tag: "level3", label: "Level 3" },
  { tag: "closing", label: "마무리" },
];

export const cards = [
  {
    stage: "intro",
    english: "Hello, everyone! Today we will play with the Air Bridge!",
    pronunciation: "헬로, 에브리원! 투데이 위 윌 플레이 위드 더 에어 브릿지!",
    meaning: "안녕, 친구들! 오늘은 에어 브릿지를 가지고 놀 거예요!",
    prompt: {
      daycare: "아이들 앞에 에어브릿지를 보여주며 밝은 표정으로 인사해 주세요.",
      playschool: "교구 이름을 천천히 따라 말하게 하며 흥미를 유도해 주세요.",
      english: "‘Air Bridge’를 손가락으로 가리키며 리피트 시켜 주세요.",
      international: "Briefly explain what an air bridge is before starting.",
    },
    situation: "아이들이 낯선 교구에 주눅들 때는 이름만 따라 하게 해도 충분합니다.",
    flow: "인사 → 교구 소개 → 오늘 활동 예고 순으로 1~2분 안에 넘어갑니다.",
  },
  {
    stage: "intro",
    english: "Look! This is an Air Bridge. It is soft and bouncy!",
    pronunciation: "룩! 디스 이즈 언 에어 브릿지. 잇 이즈 소프트 앤 바운시!",
    meaning: "봐요! 이것은 에어 브릿지예요. 말랑말랑하고 통통 튀는 느낌이에요!",
    prompt: {
      daycare: "교구를 가볍게 눌러 보이며 ‘soft’ 동작을 보여 주세요.",
      playschool: "아이 한 명에게 가볍게 만져 보게 하며 감각을 익히게 해 주세요.",
      english: "Touch the bridge and say ‘soft’ and ‘bouncy’ together.",
      international: "Let children feel the texture and describe it in simple words.",
    },
    situation: "만지고 싶어 몰릴 때는 한 줄로 서서 순서를 정해 주세요.",
    flow: "시범 → 짧은 체험 → 다음 단계 안내로 자연스럽게 연결합니다.",
  },
  {
    stage: "level1",
    english: "Stand behind the yellow line, please.",
    pronunciation: "스탠드 비하인드 더 옐로우 라인, 플리즈.",
    meaning: "노란 선 뒤에 서 주세요.",
    prompt: {
      daycare: "바닥 라인(또는 콘)을 가리키며 천천히 서게 도와주세요.",
      playschool: "‘Line up’ 동작과 함께 한 명씩 위치를 잡게 해 주세요.",
      english: "Use TPR: point to the line and gesture ‘stand’.",
      international: "Model standing behind the line and have children copy.",
    },
    situation: "줄서기가 어려우면 손잡이 담당 아이를 먼저 정해 주세요.",
    flow: "대기 위치 확정 후 첫 번째 아이만 시범 보이게 합니다.",
  },
  {
    stage: "level1",
    english: "Walk slowly. One step at a time.",
    pronunciation: "워크 슬로울리. 원 스텝 앳 어 타임.",
    meaning: "천천히 걸어요. 한 걸음씩요.",
    prompt: {
      daycare: "‘천천히’라는 말과 함께 크게 천천히 걸어 보여 주세요.",
      playschool: "박수나 리듬에 맞춰 한 걸음씩 걷게 해 보세요.",
      english: "Chant ‘slow-ly, slow-ly’ while walking together.",
      international: "Emphasize slow steps with a calm voice and pace.",
    },
    situation: "뛰려는 아이에게는 교구 위가 미끄럽다는 점을 짧게 알려 주세요.",
    flow: "시범 1회 → 개별 통과 → 칭찬 후 다음 아이로 넘깁니다.",
  },
  {
    stage: "level1",
    english: "Hold the handle. Good job!",
    pronunciation: "홀드 더 핸들. 굿 잡!",
    meaning: "손잡이를 잡아요. 잘했어요!",
    prompt: {
      daycare: "손잡이를 잡는 손 모양을 직접 도와주며 칭찬해 주세요.",
      playschool: "손잡이를 잡고 건넌 아이에게 하이파이브를 해 주세요.",
      english: "Say ‘handle’ and let them repeat while holding it.",
      international: "Praise immediately after each successful crossing.",
    },
    situation: "손잡이를 놓으면 바로 옆에서 리마인드해 주세요.",
    flow: "건너기 성공 → 칭찬 → 대기 줄로 복귀 순서를 유지합니다.",
  },
  {
    stage: "level2",
    english: "Arms out! Like an airplane!",
    pronunciation: "암즈 아웃! 라이크 언 에어플레인!",
    meaning: "팔을 벌려요! 비행기처럼!",
    prompt: {
      daycare: "비행기 소리와 함께 팔을 벌리는 동작을 같이 해 주세요.",
      playschool: "짧은 비행기 게임처럼 재미있게 연결해 주세요.",
      english: "Fly like an airplane while crossing slowly.",
      international: "Use airplane imagery to teach balance with arms out.",
    },
    situation: "팔을 흔들며 뛰려 하면 ‘slowly’로 다시 리셋해 주세요.",
    flow: "Level 1 복습 후 난이도 하나만 추가합니다.",
  },
  {
    stage: "level2",
    english: "Look straight ahead. Don't look down.",
    pronunciation: "룩 스트레이트 어헤드. 돈트 룩 다운.",
    meaning: "앞을 보세요. 아래를 보지 마세요.",
    prompt: {
      daycare: "선생님 손가락을 따라 앞을 보게 해 주세요.",
      playschool: "눈앞에 스티커나 표정 카드를 보여 주며 시선을 유도하세요.",
      english: "Point to your eyes, then ahead: ‘Look ahead!’",
      international: "Model eye contact forward before each turn.",
    },
    situation: "아래를 보고 흔들리면 잠시 멈추고 숨 고르기를 시켜 주세요.",
    flow: "시선 안정 → 다시 출발 → 짧은 거리부터 늘려 갑니다.",
  },
  {
    stage: "level2",
    english: "You can do it! I believe in you!",
    pronunciation: "유 캔 두 잇! 아이 빌리브 인 유!",
    meaning: "너는 할 수 있어! 선생님이 믿어요!",
    prompt: {
      daycare: "무서워하는 아이 옆에서 손을 잡고 함께 걸어 주세요.",
      playschool: "용기 내는 아이에게 큰 박수와 칭찬 스티커를 준비해 주세요.",
      english: "Use encouraging tone: ‘You can do it!’ with thumbs up.",
      international: "Offer choice: watch first or try with teacher support.",
    },
    situation: "강요하지 말고 관찰 선택권을 먼저 주세요.",
    flow: "격려 → 선택 → 시도 → 성공 경험 순으로 진행합니다.",
  },
  {
    stage: "level3",
    english: "Turn around slowly on the bridge.",
    pronunciation: "턴 어라운드 슬로울리 온 더 브릿지.",
    meaning: "브릿지 위에서 천천히 돌아봐요.",
    prompt: {
      daycare: "돌기 전에 발 위치를 확인하며 선생님이 옆에서 지켜주세요.",
      playschool: "‘Stop – Turn – Go’ 구호로 나눠 진행해 주세요.",
      english: "Count ‘One, two, turn!’ together before trying.",
      international: "Only attempt after Level 2 is comfortable for the group.",
    },
    situation: "그룹이 흥분하면 Level 2로 난이도를 낮춰 주세요.",
    flow: "난이도 상승 전 전원 Level 2 완료 여부를 확인합니다.",
  },
  {
    stage: "level3",
    english: "Hop once! Just one little hop!",
    pronunciation: "합 원스! 저스트 원 리틀 합!",
    meaning: "한 번만 깡총! 아주 작게 한 번만!",
    prompt: {
      daycare: "깡총 대신 두 발 모두 살짝 들기만 해도 됩니다.",
      playschool: "‘Little hop’ 동작을 과장 없이 작게 보여 주세요.",
      english: "Demonstrate a tiny hop and say ‘little’.",
      international: "Skip hopping if safety or space is a concern.",
    },
    situation: "연속 점프는 바로 제지하고 다시 걷기로 돌아갑니다.",
    flow: "한 명 시범 → 그룹 순차 시도 → 안전 확인 후 마무리 준비.",
  },
  {
    stage: "level3",
    english: "High five at the end!",
    pronunciation: "하이 파이브 앳 더 엔드!",
    meaning: "끝에서 하이파이브!",
    prompt: {
      daycare: "건넌 직후 바로 하이파이브로 성취감을 줍니다.",
      playschool: "하이파이브 후 스티커나 도장으로 마무리해 주세요.",
      english: "End with ‘High five! You did it!’",
      international: "Celebrate each child at the finish point.",
    },
    situation: "대기 아이가 많으면 하이파이브 구역을 분리해 주세요.",
    flow: "통과 → 하이파이브 → 대기열 복귀를 반복합니다.",
  },
  {
    stage: "closing",
    english: "Great job, everyone! You were so brave!",
    pronunciation: "그레이트 잡, 에브리원! 유 워 소 브레이브!",
    meaning: "정말 잘했어요, 친구들! 정말 용감했어요!",
    prompt: {
      daycare: "원형으로 모여 박수치며 오늘 활동을 칭찬해 주세요.",
      playschool: "오늘 배운 단어 한 개를 다시 말해 보게 해 주세요.",
      english: "Review ‘Air Bridge’ and ‘slowly’ one more time.",
      international: "Ask what they liked most about today’s activity.",
    },
    situation: "흥분한 아이는 정리 song으로 분위기를 가라앉혀 주세요.",
    flow: "칭찬 → 단어 복습 → 정리 안내 순으로 2분 내 마무리.",
  },
  {
    stage: "closing",
    english: "Let's clean up. Thank you!",
    pronunciation: "렛츠 클린 업. 땡큐!",
    meaning: "정리해요. 고마워요!",
    prompt: {
      daycare: "교구 주변 콘을 함께 치우며 정리 습관을 안내해 주세요.",
      playschool: "‘Clean up song’과 함께 교구 점검을 해 주세요.",
      english: "Say ‘Clean up’ and model putting equipment away.",
      international: "End with thank-you and transition to next activity.",
    },
    situation: "에어를 빼기 전 아이들을 안전 거리로 먼저 이동시켜 주세요.",
    flow: "아이 이동 → 교구 정리 → 에어 빼기 → 최종 점검.",
  },
];

export { cards as scripts };

export const emergency = [
  {
    label: "아이가 무서워할 때",
    english: "It's okay. You can watch first.",
    pronunciation: "잇츠 오케이. 유 캔 와치 퍼스트.",
    meaning: "괜찮아요. 먼저 지켜봐도 돼요.",
  },
  {
    label: "아이가 떨어졌을 때",
    english: "Are you okay? Let's take a deep breath.",
    pronunciation: "아 유 오케이? 렛츠 테이크 어 딥 브레스.",
    meaning: "괜찮니? 깊게 숨 한번 쉬자.",
  },
  {
    label: "뛰려고 할 때",
    english: "Walk, please. Be careful on the bridge.",
    pronunciation: "워크, 플리즈. 비 케어풀 온 더 브릿지.",
    meaning: "걸어요. 브릿지 위에서는 조심해요.",
  },
  {
    label: "순서 싸움이 날 때",
    english: "Wait your turn, please. Everyone gets a turn.",
    pronunciation: "웨이트 유어 턴, 플리즈. 에브리원 겟츠 어 턴.",
    meaning: "차례를 기다려 주세요. 모두 할 수 있어요.",
  },
  {
    label: "교구가 흔들릴 때",
    english: "Stop. Hold the handle. Step down slowly.",
    pronunciation: "스탑. 홀드 더 핸들. 스텝 다운 슬로울리.",
    meaning: "멈춰요. 손잡이를 잡아요. 천천히 내려와요.",
  },
  {
    label: "에어가 빠질 때",
    english: "Step off now. Move away from the bridge.",
    pronunciation: "스텝 오프 나우. 무브 어웨이 프럼 더 브릿지.",
    meaning: "지금 내려와요. 브릿지에서 멀리 이동해요.",
  },
];
