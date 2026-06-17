// GTS 상황별 대처 매뉴얼 데이터
// 카테고리별 5개씩 — 추후 전체 74개로 확장 예정

export const CATEGORIES = [
  { id: "start", label: "🚀 수업 시작", desc: "수업 시작 5분 안에 발생하는 문제" },
  { id: "control", label: "⚡ 수업 운영", desc: "수업은 진행되는데 통제가 안 되는 상황" },
  { id: "relation", label: "👦 친구 관계", desc: "아이들끼리 발생하는 문제" },
  { id: "character", label: "🎭 아이 성향", desc: "특정 유형 아이 대응법" },
  { id: "english", label: "🌎 영어체육", desc: "GTS만의 차별화 카테고리" },
  { id: "equipment", label: "🎾 교구·활동", desc: "교구와 활동 중 문제" },
  { id: "safety", label: "💚 감정·안전", desc: "반드시 있어야 하는 카테고리" },
  { id: "institution", label: "👨‍🏫 기관·교사 관계", desc: "신입 선생님들이 어려워하는 영역" },
  { id: "closing", label: "🌀 마무리", desc: "생각보다 많이 발생" },
];

export const situations = [

  // ─────────────────────────────────
  // 🚀 수업 시작
  // ─────────────────────────────────
  {
    cat: "start", level: "new",
    icon: "👀", title: "아무도 안 앉아요",
    preview: "뛰어다니고 산만할 때",
    steps: [
      { n: 1, text: "말하기 전에 박수 3번으로 시선 먼저 모으기", sub: "소리보다 리듬이 먼저 주목을 끈다" },
      { n: 2, text: "가장 잘 앉아있는 아이 이름을 크게 칭찬", sub: "'OO 너무 잘 앉아있다! 최고!' → 나머지가 경쟁적으로 따라 앉음" },
      { n: 3, text: "플레이트로 자리를 지정해준다", sub: "자리가 생기면 아이들이 자연스럽게 앉음" },
      { n: 4, text: "앉은 아이들부터 순서대로 이름 불러주기", sub: "관심받고 싶어서 안 앉는 아이에게 효과적" },
    ],
    en: [
      { text: "Please sit against the wall!", pron: "플리즈 싯 어게인스트 더 월!" },
      { text: "OO is sitting so nicely! Good job!", pron: "OO 이즈 싯팅 쏘 나이슬리! 굿 잡!" },
      { text: "Uh oh, no running please.", pron: "어 오, 노 러닝 플리즈." },
    ],
    warn: "한꺼번에 '앉아!'를 외치면 역효과. 말이 많을수록 아이들은 더 안 들음",
    tip: "가장 잘 앉아있는 아이를 칭찬하면 나머지가 경쟁적으로 따라 앉는다",
  },
  {
    cat: "start", level: "all",
    icon: "😶", title: "분위기가 너무 조용하고 반응이 없어요",
    preview: "아이들이 낯을 가리거나 무기력할 때",
    steps: [
      { n: 1, text: "선생님이 먼저 크게 리액션한다", sub: "'와!! 이거 봐봐!' 과장되게. 아이들은 선생님 에너지를 따라감" },
      { n: 2, text: "제일 활발해 보이는 아이 한 명을 지목", sub: "'OO야 나와봐! 도와줄래?' → 그 아이가 분위기 메이커 역할" },
      { n: 3, text: "쉬운 구호로 첫 발화 유도", sub: "'선생님 따라해요 — Yes-I'm-Ready!' 부담 없는 따라하기부터" },
      { n: 4, text: "작은 반응에도 크게 칭찬", sub: "눈만 마주쳐도 '오 OO 봤다! 하이파이브~'" },
    ],
    en: [
      { text: "Who wants to help the teacher? Come here!", pron: "후 원츠 투 헬프 더 티쳐? 컴 히어!" },
      { text: "Everyone say: Yes-I'm-Ready!", pron: "에브리원 세이: 예스-아임-레디!" },
      { text: "Wow, good job!! Let's go!!", pron: "와우, 굿 잡!! 렛츠 고!!" },
    ],
    warn: "조용한 걸 보고 선생님도 조용해지면 안 됨. 선생님 에너지가 올라가야 아이들이 따라옴",
    tip: "첫 5분이 수업 전체 분위기를 결정한다. 조용한 반일수록 선생님이 더 크게 반응해야 함",
  },
  {
    cat: "start", level: "all",
    icon: "😰", title: "엄마 보고 싶다고 울어요",
    preview: "분리불안으로 수업 시작부터 우는 아이",
    steps: [
      { n: 1, text: "즉시 그 아이 옆에 앉아서 눈높이를 맞춘다", sub: "서 있으면 위압감. 반드시 같은 눈높이로" },
      { n: 2, text: "'엄마 보고 싶구나' 감정 먼저 공감", sub: "이유 묻거나 달래기 전에 감정 인정이 먼저" },
      { n: 3, text: "나머지 아이들에게 잠깐 역할 주기", sub: "'여기 봐요! 잠깐 기다려줘요' — 다른 아이들 시선 돌리기" },
      { n: 4, text: "원 선생님에게 상황 전달", sub: "체육 선생님 선에서 해결하려 하지 말고 담임에게 넘기기" },
    ],
    en: [
      { text: "It's okay. I'm right here with you.", pron: "잇츠 오케이. 아임 라잇 히어 위드 유." },
      { text: "You're safe. We're going to have fun!", pron: "유어 세이프. 위어 고잉 투 해브 펀!" },
      { text: "Let's do this together, okay?", pron: "렛츠 두 디스 투게더, 오케이?" },
    ],
    warn: "'울지 마' '왜 울어?' 절대 금지. '엄마 금방 와' 거짓 약속도 하지 않기",
    tip: "억지로 달래려 하지 않아도 됨. 옆에 있어주면서 다른 아이들이 재미있어하는 걸 보여주면 자연스럽게 관심이 옮겨감",
  },
  {
    cat: "start", level: "new",
    icon: "🚪", title: "교실에 안 들어오려고 해요",
    preview: "문 앞에서 버티거나 도망가려는 아이",
    steps: [
      { n: 1, text: "강제로 끌어당기지 않기", sub: "몸에 손대면 더 거부함. 일단 문 앞에 서서 이야기" },
      { n: 2, text: "교실 안 재미있는 걸 보여주기", sub: "교구를 꺼내서 '이거 뭔지 알아?' 호기심 자극" },
      { n: 3, text: "친한 친구를 데리러 보내기", sub: "친구가 '같이 가자~' 하면 선생님보다 훨씬 효과적" },
      { n: 4, text: "그래도 안 되면 원 선생님께 전달", sub: "5분 이상 끌면 수업 흐름 전체가 깨짐" },
    ],
    en: [
      { text: "Come look at this! It's so cool!", pron: "컴 룩 앳 디스! 잇츠 쏘 쿨!" },
      { text: "Your friend is waiting for you inside!", pron: "유어 프렌드 이즈 웨이팅 포 유 인사이드!" },
      { text: "Let's go together. I'll be right next to you.", pron: "렛츠 고 투게더. 아일 비 라잇 넥스트 투 유." },
    ],
    warn: "문 앞에서 실랑이가 길어지면 안에 있는 아이들도 산만해짐. 빠르게 판단하고 원 선생님께 넘기기",
    tip: "입장 전에 교구를 살짝 보여주며 '이따 이걸로 뭐 할 것 같아?' 궁금증을 심어두면 예방이 가능함",
  },
  {
    cat: "start", level: "all",
    icon: "😨", title: "선생님을 처음 보고 무서워해요",
    preview: "새 선생님에 대한 경계심이 강한 아이",
    steps: [
      { n: 1, text: "먼저 다가가지 않기", sub: "무서워하는 아이에게 선생님이 먼저 다가가면 더 위축됨" },
      { n: 2, text: "다른 아이들과 재미있게 노는 모습을 보여주기", sub: "안전한 어른이라는 걸 행동으로 보여주는 것" },
      { n: 3, text: "눈 마주치면 살짝 웃고 끝내기", sub: "억지로 말 걸지 않기. 눈 마주침만으로 충분" },
      { n: 4, text: "2~3주 기다리기", sub: "대부분 3주 안에 자연스럽게 다가옴. 조급해하지 말 것" },
    ],
    en: [
      { text: "Hi! No rush, take your time.", pron: "하이! 노 러쉬, 테이크 유어 타임." },
      { text: "I'll be right here whenever you're ready.", pron: "아일 비 라잇 히어 웨네버 유어 레디." },
      { text: "Look how fun this is!", pron: "룩 하우 펀 디스 이즈!" },
    ],
    warn: "무서워하는 아이에게 '선생님 무섭지 않아~' 반복하면 오히려 무섭다는 인식 강화",
    tip: "이름을 자주 불러주되 질문은 하지 않기. '도움이 필요하면 말해줘' 정도로 존재감만 알려두기",
  },

  // ─────────────────────────────────
  // ⚡ 수업 운영
  // ─────────────────────────────────
  {
    cat: "control", level: "new",
    icon: "⚡", title: "아이들이 너무 흥분해서 통제가 안 돼요",
    preview: "에너지가 폭발해서 말을 안 들을 때",
    steps: [
      { n: 1, text: "휘슬 한 번 + 손 번쩍 들기", sub: "목소리 높이지 않기. 휘슬이 신호임을 미리 약속해둬야 함" },
      { n: 2, text: "'Freeze!' 외치고 완전히 멈출 때까지 기다린다", sub: "선생님도 동상처럼 멈추기. 아이들이 웃으며 따라 멈춤" },
      { n: 3, text: "'숨 한번 쉬어요' 깊게 같이 호흡", sub: "에너지를 낮추는 가장 빠른 방법" },
      { n: 4, text: "짧게 이유 설명 후 재시작", sub: "설명 30초 이내로. 길면 또 산만해짐" },
    ],
    en: [
      { text: "Freeze!! Everyone freeze right now!", pron: "프리즈!! 에브리원 프리즈 라잇 나우!" },
      { text: "Take a deep breath with me. In... and out.", pron: "테이크 어 딥 브레쓰 위드 미. 인... 앤 아웃." },
      { text: "Okay, let's try again. Are you ready?", pron: "오케이, 렛츠 트라이 어게인. 아 유 레디?" },
    ],
    warn: "흥분한 상태에서 길게 훈육하면 역효과. 짧고 명확하게",
    tip: "수업 시작 전에 Freeze 신호를 미리 연습해두면 실전에서 훨씬 잘 먹힘",
  },
  {
    cat: "control", level: "new",
    icon: "🏃", title: "한 아이가 계속 규칙을 어겨요",
    preview: "뛰거나 밀거나 차례를 안 지킬 때",
    steps: [
      { n: 1, text: "전체를 멈추지 말고 그 아이에게만 조용히 다가간다", sub: "전체 정지는 다른 아이들 흐름을 끊음. 최후 수단" },
      { n: 2, text: "눈을 맞추고 낮은 목소리로 1:1 대화", sub: "'OO야, 지금 뭐 하는 거야?' 화내지 않고 차분하게" },
      { n: 3, text: "한 번 더 어기면 잠깐 벽에 앉힌다", sub: "'잠깐 쉬었다가 다시 해요' — 벌이 아니라 리셋 개념으로" },
      { n: 4, text: "돌아올 때 바로 칭찬으로 맞아준다", sub: "'OO가 돌아왔다! 같이 해요~' 긍정적 재합류" },
    ],
    en: [
      { text: "Hey, can I talk to you for a second?", pron: "헤이, 캔 아이 토크 투 유 포 어 세컨드?" },
      { text: "Let's take a short break. Sit here for me.", pron: "렛츠 테이크 어 쇼트 브레이크. 싯 히어 포 미." },
      { text: "You're back! Let's go together!", pron: "유어 백! 렛츠 고 투게더!" },
    ],
    warn: "전체 앞에서 망신주면 그 아이가 더 반항함. 반드시 1:1로 처리",
    tip: "규칙 어기는 아이는 대부분 관심을 원하는 것. 활동 중 그 아이에게 역할을 주면 해결되는 경우가 많음",
  },
  {
    cat: "control", level: "new",
    icon: "🔄", title: "계속 순서를 새치기해요",
    preview: "줄을 안 서고 먼저 하려는 아이",
    steps: [
      { n: 1, text: "줄 서는 순서를 눈에 보이게 만들기", sub: "플레이트나 콘으로 자리를 물리적으로 지정" },
      { n: 2, text: "새치기하는 순간 바로 이름 부르기", sub: "'OO야! 줄 맨 뒤로 가줘요~' 단호하게 하지만 부드럽게" },
      { n: 3, text: "순서 잘 지키는 아이를 크게 칭찬", sub: "새치기한 아이가 스스로 부끄러움 느끼게" },
      { n: 4, text: "반복되면 그 아이에게 줄 관리 역할 주기", sub: "'OO야 줄 관리 도와줄래?' 책임감 부여" },
    ],
    en: [
      { text: "Please wait your turn! Line up here.", pron: "플리즈 웨이트 유어 턴! 라인 업 히어." },
      { text: "OO, back of the line please.", pron: "OO, 백 오브 더 라인 플리즈." },
      { text: "Good waiting! You're doing great!", pron: "굿 웨이팅! 유어 두잉 그레잇!" },
    ],
    warn: "새치기를 그냥 넘어가면 다른 아이들도 따라 함. 첫 번에 바로 잡기",
    tip: "줄 서기 자체를 게임으로 만들기. '제일 이쁘게 선 사람이 먼저 해요' → 자발적으로 줄 섬",
  },
  {
    cat: "control", level: "all",
    icon: "🚶", title: "계속 돌아다녀요",
    preview: "앉아있지 못하고 수업 중 계속 이동하는 아이",
    steps: [
      { n: 1, text: "플레이트로 그 아이 자리를 지정", sub: "물리적 경계가 생기면 훨씬 덜 돌아다님" },
      { n: 2, text: "돌아다니는 에너지를 활동에 활용", sub: "'OO야 이거 저기 가져다줄래?' 심부름 역할 부여" },
      { n: 3, text: "앉아있는 시간 자체를 줄이기", sub: "이 아이 유형은 앉아있는 게 고통. 활동 위주로 전환" },
      { n: 4, text: "원 선생님께 ADHD 가능성 공유", sub: "지속적이면 담임에게 관찰 요청" },
    ],
    en: [
      { text: "Please stay on your spot!", pron: "플리즈 스테이 온 유어 스팟!" },
      { text: "OO, can you help me with this?", pron: "OO, 캔 유 헬프 미 위드 디스?" },
      { text: "Great job staying! High five!", pron: "그레잇 잡 스테이잉! 하이 파이브!" },
    ],
    warn: "앉혀놓고 계속 주의 주면 오히려 더 산만해짐. 움직임 자체를 활용하는 게 나음",
    tip: "돌아다니는 아이에게 '보조 선생님' 역할을 주면 오히려 수업에 가장 집중하게 됨",
  },
  {
    cat: "control", level: "all",
    icon: "😠", title: "지면 화를 내요",
    preview: "게임에서 지거나 실수하면 분노하는 아이",
    steps: [
      { n: 1, text: "즉시 경쟁 요소 제거", sub: "이기고 지는 결과 발표를 잠깐 중단" },
      { n: 2, text: "감정 먼저 인정하기", sub: "'지는 게 속상하구나. 선생님도 그래.' 공감" },
      { n: 3, text: "잠깐 옆에 앉혀서 진정시키기", sub: "화난 상태에서 계속 참여시키면 더 큰 사고로 이어짐" },
      { n: 4, text: "진정되면 '다시 해볼까?' 권유", sub: "강요 말고 자발적으로 돌아오게" },
    ],
    en: [
      { text: "It's okay to feel upset. Take a breath.", pron: "잇츠 오케이 투 필 업셋. 테이크 어 브레쓰." },
      { text: "Losing is hard. But you tried so hard!", pron: "루징 이즈 하드. 벗 유 트라이드 쏘 하드!" },
      { text: "Want to try again? I believe in you.", pron: "원트 투 트라이 어게인? 아이 빌리브 인 유." },
    ],
    warn: "화내는 아이에게 '그러면 안 되지' 훈육하면 더 폭발함. 감정이 가라앉을 때까지 기다리기",
    tip: "이기고 지는 게임보다 협동 게임으로 바꾸면 이런 상황 자체가 줄어듦",
  },

  // ─────────────────────────────────
  // 👦 친구 관계
  // ─────────────────────────────────
  {
    cat: "relation", level: "all",
    icon: "😤", title: "두 아이가 싸우기 시작했어요",
    preview: "밀치거나 물건 다툼, 말다툼",
    steps: [
      { n: 1, text: "즉시 두 아이 사이에 몸으로 끼어든다", sub: "말보다 몸으로 분리가 먼저. 물리적 접촉 멈추기" },
      { n: 2, text: "두 아이를 서로 반대 방향으로 앉힌다", sub: "같은 공간에 있으면 계속 눈을 마주침" },
      { n: 3, text: "나머지 아이들에게 활동 계속 주기", sub: "'여기 봐요! 계속 해봐요!' 다른 아이들 시선 돌리기" },
      { n: 4, text: "원 선생님에게 상황 전달", sub: "체육 선생님 선에서 해결하려 하지 말고 담임에게 넘기기" },
    ],
    en: [
      { text: "Stop! Stop right now. Step back.", pron: "스탑! 스탑 라잇 나우. 스텝 백." },
      { text: "Use your words, not your hands.", pron: "유즈 유어 워즈, 낫 유어 핸즈." },
      { text: "I'll talk to you both in a minute.", pron: "아일 토크 투 유 보쓰 인 어 미닛." },
    ],
    warn: "선생님이 감정적으로 반응하거나 한쪽 편을 들면 상황이 더 악화됨",
    tip: "싸움 후 화해를 강요하지 않기. '지금은 각자 앉아요'로 분리만 해도 충분",
  },
  {
    cat: "relation", level: "all",
    icon: "👊", title: "친구를 밀거나 때려요",
    preview: "신체 접촉으로 친구를 다치게 하는 아이",
    steps: [
      { n: 1, text: "즉시 활동 전체 중단", sub: "신체 접촉은 다른 상황과 달리 즉각 대응 필요" },
      { n: 2, text: "때린 아이: '손은 사람을 때리는 게 아니야' 단호하게", sub: "화내지 않되 단호함 유지. 눈 마주치고 낮은 목소리로" },
      { n: 3, text: "맞은 아이: 먼저 괜찮은지 확인", sub: "피해 아이를 먼저 챙기는 게 순서" },
      { n: 4, text: "둘 다 원 선생님께 전달", sub: "반드시 기록하고 넘기기" },
    ],
    en: [
      { text: "Stop! We do not hit our friends.", pron: "스탑! 위 두 낫 힛 아워 프렌즈." },
      { text: "Are you okay? Let me see.", pron: "아 유 오케이? 렛 미 씨." },
      { text: "Hands are for helping, not hurting.", pron: "핸즈 아 포 헬핑, 낫 허팅." },
    ],
    warn: "때린 아이를 즉각 혼내고 싶어도 피해 아이 먼저 챙기기. 순서가 중요함",
    tip: "때리는 행동은 대부분 말로 표현 못 하는 감정이 원인. '화가 났구나, 근데 때리면 안 돼'로 감정은 인정하되 행동은 제지",
  },
  {
    cat: "relation", level: "all",
    icon: "😝", title: "친구를 놀려요",
    preview: "외모, 실수, 능력 등을 가지고 놀리는 아이",
    steps: [
      { n: 1, text: "즉시 '그 말은 하면 안 돼'로 제지", sub: "넘어가면 다른 아이들도 따라 함" },
      { n: 2, text: "놀림받은 아이 감정 먼저 확인", sub: "'OO야 괜찮아? 그 말 들었을 때 기분 어땠어?'" },
      { n: 3, text: "놀린 아이에게 1:1로 이유 묻기", sub: "전체 앞에서 혼내면 반항하거나 더 심해짐" },
      { n: 4, text: "원 선생님께 전달", sub: "반복적이면 반드시 담임에게 공유" },
    ],
    en: [
      { text: "Hey, that's not kind. We don't say that.", pron: "헤이, 댓츠 낫 카인드. 위 돈트 세이 댓." },
      { text: "How would you feel if someone said that to you?", pron: "하우 우드 유 필 이프 썸원 세이드 댓 투 유?" },
      { text: "In our class, we are kind to each other.", pron: "인 아워 클래스, 위 아 카인드 투 이치 아더." },
    ],
    warn: "놀리는 걸 웃어넘기거나 장난으로 치부하면 안 됨. 사소해 보여도 당하는 아이는 상처받음",
    tip: "수업 초반에 '우리 반 규칙: 친구를 놀리지 않아요'를 명확히 해두면 예방 효과가 큼",
  },
  {
    cat: "relation", level: "all",
    icon: "🙅", title: "팀을 거부해요",
    preview: "특정 팀이 싫다고 하거나 팀 활동 자체를 거부할 때",
    steps: [
      { n: 1, text: "이유 먼저 듣기", sub: "'왜 싫어?' 판단 없이 물어보기" },
      { n: 2, text: "팀 구성을 랜덤으로 바꾸기", sub: "사다리 타기, 가위바위보 등 공정한 방법으로 재배정" },
      { n: 3, text: "팀보다 개인 역할 주기", sub: "'OO는 이쪽 팀 응원단장!' 팀 소속감 외에 개인 역할 부여" },
      { n: 4, text: "계속 거부하면 잠깐 옆에 앉히기", sub: "강요하지 말고 '준비되면 와요' 여지 남기기" },
    ],
    en: [
      { text: "Let's try this together! Give it a chance.", pron: "렛츠 트라이 디스 투게더! 깁 잇 어 찬스." },
      { text: "You can be the team's special helper!", pron: "유 캔 비 더 팀즈 스페셜 헬퍼!" },
      { text: "It's okay, come join us when you're ready.", pron: "잇츠 오케이, 컴 조인 어스 웬 유어 레디." },
    ],
    warn: "팀 강요하면 수업 내내 불만 상태로 있게 됨. 자발적 참여 유도가 먼저",
    tip: "팀 이름을 아이들이 직접 짓게 하면 소속감이 생겨서 팀 거부가 줄어듦",
  },
  {
    cat: "relation", level: "all",
    icon: "🎨", title: "자기가 좋아하는 색깔만 하려고 해요",
    preview: "특정 색 교구만 고집하며 다른 걸 거부하는 아이",
    steps: [
      { n: 1, text: "처음 한 번은 원하는 색 주기", sub: "작은 것에 져주면 큰 것을 얻음. 수업 흐름이 더 중요" },
      { n: 2, text: "다음부터는 랜덤 배정 시스템 도입", sub: "'오늘은 선생님이 정해줄게요' 공정성 강조" },
      { n: 3, text: "다른 색의 장점 말해주기", sub: "'파란색이 제일 빠른 색이래!' 색에 스토리 입히기" },
      { n: 4, text: "교구 색깔을 수업 보상으로 활용", sub: "'잘 한 사람이 먼저 색깔 골라요' 동기부여" },
    ],
    en: [
      { text: "Today let's try a different color. It'll be fun!", pron: "투데이 렛츠 트라이 어 디퍼런트 컬러. 잇츨 비 펀!" },
      { text: "All colors are special! Each one is magic.", pron: "올 컬러즈 아 스페셜! 이치 원 이즈 매직." },
      { text: "Great job trying something new!", pron: "그레잇 잡 트라잉 썸씽 뉴!" },
    ],
    warn: "색깔 고집을 무조건 꺾으려 하면 수업 시작부터 기분이 상해서 전체 수업이 힘들어짐",
    tip: "색깔에 캐릭터나 능력을 부여하면 아이들이 오히려 다른 색을 원하게 됨",
  },

  // ─────────────────────────────────
  // 🎭 아이 성향
  // ─────────────────────────────────
  {
    cat: "character", level: "all",
    icon: "🙈", title: "소극적이라 참여를 안 해요",
    preview: "구석에 앉아있거나 활동을 거부할 때",
    steps: [
      { n: 1, text: "강요하지 않는다", sub: "'해야 해!'는 역효과. 더 위축됨" },
      { n: 2, text: "그 아이 옆에서 선생님이 먼저 활동한다", sub: "'선생님이 먼저 해볼게요~' 시범 보이며 자연스럽게 유도" },
      { n: 3, text: "쉬운 역할부터 맡긴다", sub: "'OO야 이거만 들어줄래?' 작은 성공 경험부터" },
      { n: 4, text: "참여하면 과하게 칭찬", sub: "다른 아이들 앞에서 크게 칭찬하면 그 다음부터 적극적으로 변함" },
    ],
    en: [
      { text: "That's okay, you can watch for now.", pron: "댓츠 오케이, 유 캔 워치 포 나우." },
      { text: "Can you hold this for me? Just this one thing.", pron: "캔 유 홀드 디스 포 미? 저스트 디스 원 띵." },
      { text: "You did it!! Amazing!! Everyone look at OO!!", pron: "유 디드 잇!! 어메이징!! 에브리원 룩 앳 OO!!" },
    ],
    warn: "소극적인 아이를 무대 위로 억지로 끌어내면 트라우마가 될 수 있음",
    tip: "첫 수업에 안 했어도 2~3주 지나면 자연스럽게 참여하는 경우가 훨씬 많음. 조급해하지 말 것",
  },
  {
    cat: "character", level: "new",
    icon: "😒", title: "수업 하기 싫다고 버텨요",
    preview: "앉아서 팔짱 끼고 아무것도 안 하려는 아이",
    steps: [
      { n: 1, text: "이유 먼저 물어보기", sub: "'오늘 무슨 일 있어?' 판단 없이 들어주기" },
      { n: 2, text: "가장 쉬운 참여 방법 제시", sub: "'그럼 여기 앉아서 응원만 해줄래?' 최소한의 참여" },
      { n: 3, text: "다른 아이들이 재미있어하는 걸 보여주기", sub: "억지로 끌어들이지 말고 환경이 유혹하게" },
      { n: 4, text: "끝까지 거부하면 원 선생님께 전달", sub: "체육 선생님이 모든 걸 해결하려 하지 않아도 됨" },
    ],
    en: [
      { text: "That's okay. Can you be our cheerleader?", pron: "댓츠 오케이. 캔 유 비 아워 치어리더?" },
      { text: "No pressure. Just watch for now.", pron: "노 프레셔. 저스트 워치 포 나우." },
      { text: "Whenever you're ready, we'd love to have you!", pron: "웨네버 유어 레디, 위드 러브 투 해브 유!" },
    ],
    warn: "억지로 참여시키면 그 다음 주에도 더 강하게 거부함",
    tip: "버티는 아이에게 역할을 주면 효과적. '심판 해줄래?' '점수 기록해줄래?' 자존심을 지켜주는 참여",
  },
  {
    cat: "character", level: "all",
    icon: "🎪", title: "관심받으려고 이상한 행동을 해요",
    preview: "수업 중 갑자기 엉뚱한 행동으로 주목받으려는 아이",
    steps: [
      { n: 1, text: "이상한 행동은 무시하기", sub: "반응하면 더 심해짐. 리액션이 보상이 됨" },
      { n: 2, text: "긍정적인 행동에만 반응하기", sub: "잠깐이라도 바르게 있으면 즉시 칭찬" },
      { n: 3, text: "수업 중 그 아이에게 특별 역할 주기", sub: "관심 욕구를 건강한 방향으로 채워주기" },
      { n: 4, text: "수업 끝나고 1:1로 따뜻하게 대화", sub: "'오늘 OO 덕분에 재미있었어' 긍정적 관계 쌓기" },
    ],
    en: [
      { text: "OO, I need your help over here!", pron: "OO, 아이 니드 유어 헬프 오버 히어!" },
      { text: "Great job! I noticed that. Well done.", pron: "그레잇 잡! 아이 노티스드 댓. 웰 던." },
      { text: "You're such an important part of our class!", pron: "유어 써치 언 임포턴트 파트 오브 아워 클래스!" },
    ],
    warn: "이상한 행동에 '왜 그래!' 반응하면 그 반응 자체가 보상이 됨",
    tip: "이 유형의 아이는 사랑받고 싶은 것. 수업 시작 전 짧게 1:1 대화만 해줘도 수업 중 행동이 확 달라짐",
  },
  {
    cat: "character", level: "all",
    icon: "😤", title: "자기만 하려고 해요",
    preview: "교구를 독점하거나 혼자 모든 걸 하려는 아이",
    steps: [
      { n: 1, text: "순서와 규칙을 시각적으로 보여주기", sub: "플레이트나 순서판으로 물리적으로 명확하게" },
      { n: 2, text: "'나눠쓰기'를 수업 초반에 명확히 가르치기", sub: "'Share'의 의미와 이유를 설명하기" },
      { n: 3, text: "독점할 때 즉시 개입", sub: "'OO야, 친구도 해야 해. 이제 넘겨줘요' 단호하게" },
      { n: 4, text: "나눴을 때 크게 칭찬", sub: "'OO가 나눠줬다! 최고야!' 나누는 행동 강화" },
    ],
    en: [
      { text: "Let's share! It's OO's turn now.", pron: "렛츠 쉐어! 잇츠 OO's 턴 나우." },
      { text: "Everyone gets a turn. Don't worry!", pron: "에브리원 겟츠 어 턴. 돈트 워리!" },
      { text: "Great sharing! That was so kind of you.", pron: "그레잇 쉐어링! 댓 워즈 쏘 카인드 오브 유." },
    ],
    warn: "강제로 빼앗으면 더 강하게 쥐려 함. 자발적으로 넘겨주도록 유도",
    tip: "독점하는 아이에게 '나눠주는 사람이 제일 멋있어'라고 미리 심어두면 효과적",
  },
  {
    cat: "character", level: "all",
    icon: "😟", title: "겁이 많아요",
    preview: "새로운 활동이나 교구를 무서워하며 시도를 안 하는 아이",
    steps: [
      { n: 1, text: "절대 강요하지 않기", sub: "겁 많은 아이를 억지로 시키면 트라우마 생길 수 있음" },
      { n: 2, text: "선생님이 먼저 해보이기", sub: "'선생님도 처음엔 무서웠는데 해봤더니 재미있더라고!' 공감" },
      { n: 3, text: "가장 쉬운 단계부터 같이", sub: "'선생님이랑 같이 해볼까? 손잡고~'" },
      { n: 4, text: "성공하면 엄청나게 칭찬", sub: "이 아이에게 성공 경험은 다음 도전의 씨앗" },
    ],
    en: [
      { text: "It's okay to feel scared. I felt that too!", pron: "잇츠 오케이 투 필 스케어드. 아이 펠트 댓 투!" },
      { text: "Let's try together. I'll hold your hand.", pron: "렛츠 트라이 투게더. 아일 홀드 유어 핸드." },
      { text: "You did it! I knew you could do it!", pron: "유 디드 잇! 아이 뉴 유 쿠드 두 잇!" },
    ],
    warn: "'별거 아니야' '무서울 게 없잖아' 절대 금지. 아이 감정을 무시하는 말",
    tip: "겁 많은 아이가 용기 내서 한 번 성공하면 그 다음 수업부터 완전히 달라짐. 그 첫 성공을 만들어주는 게 선생님의 역할",
  },

  // ─────────────────────────────────
  // 🌎 영어체육
  // ─────────────────────────────────
  {
    cat: "english", level: "all",
    icon: "🤐", title: "영어로 말하면 반응이 없어요",
    preview: "영어 대사에 아이들이 아무 반응도 안 할 때",
    steps: [
      { n: 1, text: "영어 + 동작을 함께 사용하기", sub: "말만 하지 말고 몸으로 보여주기. 아이들은 동작을 따라함" },
      { n: 2, text: "기대치를 낮추기", sub: "반응 없어도 괜찮음. 듣고 있는 것 자체가 노출" },
      { n: 3, text: "쉬운 단어 하나만 반복", sub: "'Up! Up! Up!' 한 단어를 10번 반복하면 기억함" },
      { n: 4, text: "구호로 첫 발화 유도", sub: "'다같이 따라해요 — Go!' 부담 없는 단어부터" },
    ],
    en: [
      { text: "Everyone say: GO!", pron: "에브리원 세이: 고!" },
      { text: "Can you say that with me? Ready?", pron: "캔 유 세이 댓 위드 미? 레디?" },
      { text: "One more time! GO!!", pron: "원 모어 타임! 고!!" },
    ],
    warn: "반응 없다고 한국어로 바꾸면 아이들이 '영어 안 해도 되는구나' 학습함",
    tip: "처음엔 동작만 따라해도 성공. 영어 발화는 3~4주 후에 자연스럽게 나오기 시작함",
  },
  {
    cat: "english", level: "all",
    icon: "🇰🇷", title: "한국어로만 대답해요",
    preview: "영어로 물어봐도 한국어로만 대답하는 아이들",
    steps: [
      { n: 1, text: "한국어 대답을 영어로 바꿔서 다시 말해주기", sub: "'다리!' → '맞아! Bridge라고 해요. Bridge!' 자연스럽게 교정" },
      { n: 2, text: "영어 단어 하나만 유도", sub: "'Bridge라고 해봐요~' 문장 강요하지 않기" },
      { n: 3, text: "영어로 말하면 과하게 칭찬", sub: "작은 시도도 크게 반응해줘야 다음에 또 함" },
      { n: 4, text: "기관 레벨에 맞게 기대치 조정", sub: "어린이집은 한국어 대답도 OK. 무리하게 영어 강요 금지" },
    ],
    en: [
      { text: "Oh you mean Bridge! Can you say Bridge?", pron: "오 유 민 브릿지! 캔 유 세이 브릿지?" },
      { text: "Yes! Bridge! Great job saying that!", pron: "예스! 브릿지! 그레잇 잡 세이잉 댓!" },
      { text: "One more time, everyone: Bridge!!", pron: "원 모어 타임, 에브리원: 브릿지!!" },
    ],
    warn: "한국어 대답을 틀렸다고 무시하면 아이가 다음엔 아예 대답 안 함",
    tip: "한국어 → 영어 변환을 선생님이 자연스럽게 해주는 것 자체가 최고의 영어 교육",
  },
  {
    cat: "english", level: "all",
    icon: "😳", title: "영어를 부끄러워해요",
    preview: "영어 따라하기를 창피해서 안 하려는 아이",
    steps: [
      { n: 1, text: "다같이 함께 하는 구호 형식 사용", sub: "혼자 말하는 게 아니라 다같이 외치면 부끄러움이 사라짐" },
      { n: 2, text: "선생님이 먼저 틀리게 말해보기", sub: "'선생님도 처음엔 이상하게 했어~' 실수가 괜찮다는 분위기" },
      { n: 3, text: "작은 소리도 OK 인정하기", sub: "입 모양만 따라해도 '오 했다!' 칭찬" },
      { n: 4, text: "강요하지 않기", sub: "부끄러움은 강요할수록 더 심해짐" },
    ],
    en: [
      { text: "It's okay to try! Even I make mistakes!", pron: "잇츠 오케이 투 트라이! 이븐 아이 메이크 미스테이크스!" },
      { text: "Everyone together — nice and loud!", pron: "에브리원 투게더 — 나이스 앤 라우드!" },
      { text: "I heard you! Amazing try!", pron: "아이 허드 유! 어메이징 트라이!" },
    ],
    warn: "특정 아이를 지목해서 혼자 영어 말하게 하면 그 아이는 영어 트라우마 생길 수 있음",
    tip: "영어를 잘 하는 아이를 살짝 먼저 시키면 나머지 아이들이 따라하기 쉬워짐",
  },
  {
    cat: "english", level: "all",
    icon: "🎮", title: "아이들이 영어보다 게임에만 집중해요",
    preview: "활동은 열심히 하는데 영어 발화는 전혀 없을 때",
    steps: [
      { n: 1, text: "게임 시작 조건으로 영어 구호 넣기", sub: "'Yes-I'm-Ready!' 외쳐야 출발 — 영어가 게임의 일부가 됨" },
      { n: 2, text: "활동 중간에 영어 단어 삽입", sub: "'3,2,1 GO!' → 자연스럽게 영어가 게임 언어가 됨" },
      { n: 3, text: "영어로 말하면 게임 유리하게", sub: "'Climb!'이라고 외치면 한 번 더 할 수 있어요 → 동기 부여" },
      { n: 4, text: "게임 끝나고 영어 복습", sub: "'오늘 뭐라고 했어요? → Climb!' 마무리에 자연스럽게 복습" },
    ],
    en: [
      { text: "Say 'GO' to start! Ready? Say it!", pron: "세이 '고' 투 스타트! 레디? 세이 잇!" },
      { text: "3, 2, 1 — everyone say GO!!!", pron: "쓰리, 투, 원 — 에브리원 세이 고!!!" },
      { text: "What's the magic word? → GO!", pron: "왓츠 더 매직 워드? → 고!" },
    ],
    warn: "영어와 게임을 분리하면 아이들은 게임만 기억하고 영어는 방해로 느낌",
    tip: "영어가 게임의 규칙이 되면 아이들이 스스로 영어를 찾아 씀. 게임 언어로 영어를 심어두는 것이 핵심",
  },
  {
    cat: "english", level: "all",
    icon: "❓", title: "영어 질문에 아무도 대답 안 해요",
    preview: "질문을 해도 조용하거나 서로 눈치만 볼 때",
    steps: [
      { n: 1, text: "질문을 더 쉽게 바꾸기", sub: "Open 질문 → Yes/No 질문으로. 'What is this?' → 'Is this a bridge?'" },
      { n: 2, text: "선생님이 먼저 엉뚱한 대답 해보기", sub: "'Is this a bed? → No!!!' 아이들이 자연스럽게 반응" },
      { n: 3, text: "손 들기 대신 구호로 대답하게", sub: "손 드는 게 부담스러운 아이들에게 효과적" },
      { n: 4, text: "대답한 아이 즉시 크게 칭찬", sub: "한 명이 용기 내면 나머지가 따라옴" },
    ],
    en: [
      { text: "Is this a bed? (No!!!) Is this a bridge? (Yes!!!)", pron: "이즈 디스 어 베드? 이즈 디스 어 브릿지?" },
      { text: "Everyone who thinks yes — say YES!", pron: "에브리원 후 띵크스 예스 — 세이 예스!" },
      { text: "OO said it first! Amazing!!", pron: "OO 세드 잇 퍼스트! 어메이징!!" },
    ],
    warn: "대답 없다고 바로 선생님이 답 말해버리면 아이들이 기다리면 된다는 걸 학습함",
    tip: "5초 침묵은 사실 아이들이 생각하는 시간. 조금만 더 기다리면 대답이 나옴",
  },

  // ─────────────────────────────────
  // 🎾 교구·활동
  // ─────────────────────────────────
  {
    cat: "equipment", level: "all",
    icon: "🥊", title: "교구를 서로 가지려고 해요",
    preview: "같은 색 교구를 두고 싸우거나 먼저 잡으려는 아이들",
    steps: [
      { n: 1, text: "교구 배분을 선생님이 직접 하기", sub: "아이들이 직접 고르게 하면 반드시 다툼 발생" },
      { n: 2, text: "랜덤 배정 시스템 만들기", sub: "눈 감고 뽑기, 가위바위보 등 공정한 방법 도입" },
      { n: 3, text: "교구보다 활동에 집중하게 만들기", sub: "'어떤 색이든 다 똑같이 잘 돼요!' 교구 차이 없애기" },
      { n: 4, text: "교구 선택권을 보상으로 활용", sub: "'잘 한 사람이 먼저 골라요' 긍정적 동기부여" },
    ],
    en: [
      { text: "Teacher will give everyone one. Wait please!", pron: "티쳐 윌 깁 에브리원 원. 웨이트 플리즈!" },
      { text: "All colors work the same! Don't worry.", pron: "올 컬러즈 워크 더 세임! 돈트 워리." },
      { text: "Good waiting! You'll get yours soon.", pron: "굿 웨이팅! 유윌 겟 유어즈 순." },
    ],
    warn: "교구 배분 전에 아이들이 이미 흥분 상태면 배분 자체가 싸움이 됨. 앉힌 후 배분하기",
    tip: "교구를 줄 때 이름 불러가며 하나씩 주면 기다리는 연습도 되고 개인 관심도 줄 수 있음",
  },
  {
    cat: "equipment", level: "new",
    icon: "🏹", title: "교구를 던져요",
    preview: "공이 아닌 교구를 위험하게 던지는 아이",
    steps: [
      { n: 1, text: "즉시 활동 전체 멈추기", sub: "안전 문제는 즉각 대응. 다른 상황과 다름" },
      { n: 2, text: "'교구는 던지는 게 아니야' 단호하게", sub: "왜 위험한지 짧게 설명. 30초 이내로" },
      { n: 3, text: "그 아이 교구 잠깐 수거", sub: "'잠깐 선생님이 보관할게요. 규칙 지키면 돌려줘요'" },
      { n: 4, text: "교구 올바른 사용법 다시 시범", sub: "전체 대상으로 다시 한번 보여주기" },
    ],
    en: [
      { text: "Stop! We do not throw equipment!", pron: "스탑! 위 두 낫 쓰로우 이큅먼트!" },
      { text: "This is how we use it. Watch me.", pron: "디스 이즈 하우 위 유즈 잇. 워치 미." },
      { text: "Ready to try the right way? Let's go!", pron: "레디 투 트라이 더 라잇 웨이? 렛츠 고!" },
    ],
    warn: "교구 던지는 걸 한 번 넘어가면 다른 아이들도 따라 함. 반드시 즉각 대응",
    tip: "수업 시작 전 '교구 사용 규칙'을 아이들이 직접 말하게 하면 예방 효과가 큼",
  },
  {
    cat: "equipment", level: "new",
    icon: "⏱️", title: "준비한 활동이 너무 빨리 끝났어요",
    preview: "예상보다 아이들이 빨리 끝내서 시간이 많이 남을 때",
    steps: [
      { n: 1, text: "난이도 올리기", sub: "같은 활동을 더 어렵게. '이번엔 눈 감고 해봐요!'" },
      { n: 2, text: "반대 방향으로 해보기", sub: "오른손 → 왼손, 앞으로 → 뒤로 등 변형" },
      { n: 3, text: "팀전으로 바꾸기", sub: "개인 활동 → 팀 대결로 전환해서 다시 긴장감 주기" },
    ],
    en: [
      { text: "Good job! Now let's try it harder!", pron: "굿 잡! 나우 렛츠 트라이 잇 하더!" },
      { text: "This time, try it with your other hand!", pron: "디스 타임, 트라이 잇 위드 유어 아더 핸드!" },
    ],
    warn: "시간이 남는다고 당황한 표정 보이면 아이들이 눈치챔. 자연스럽게 변형하기",
    tip: "항상 플랜 B 활동 하나씩 머릿속에 준비해두기. '오늘 시간 남으면 뭐 할까?' 미리 생각",
  },
  {
    cat: "equipment", level: "all",
    icon: "👥", title: "인원이 예상보다 많아요",
    preview: "갑자기 아이가 더 많아서 교구가 부족할 때",
    steps: [
      { n: 1, text: "팀 크기 조정", sub: "개인 활동 → 팀 활동으로 전환. 교구 1개를 여럿이 나눠 씀" },
      { n: 2, text: "응원단 역할 만들기", sub: "활동 못 하는 아이들에게 응원 역할 부여. 빠지는 게 아니라 참여하는 것" },
      { n: 3, text: "교구 없이 할 수 있는 활동 추가", sub: "몸만 쓰는 게임으로 전환. Simon Says, 얼음땡 등" },
      { n: 4, text: "다음 수업 전에 기관에 인원 확인", sub: "당일 깜짝 변동은 어쩔 수 없지만 미리 확인하는 습관" },
    ],
    en: [
      { text: "Okay everyone, we're going to work in teams today!", pron: "오케이 에브리원, 위어 고잉 투 워크 인 팀즈 투데이!" },
      { text: "This team cheers, this team plays! Switch after!", pron: "디스 팀 치어즈, 디스 팀 플레이즈! 스위치 애프터!" },
      { text: "Everyone is part of this! Let's go!", pron: "에브리원 이즈 파트 오브 디스! 렛츠 고!" },
    ],
    warn: "교구 부족을 아이들 앞에서 당황스럽게 해결하려 하면 혼란스러워짐. 자연스럽게 팀으로 전환",
    tip: "교구는 항상 예상 인원 +2~3개 여유 있게 준비하는 게 기본",
  },

  // ─────────────────────────────────
  // 💚 감정·안전
  // ─────────────────────────────────
  {
    cat: "safety", level: "all",
    icon: "😢", title: "아이가 울어요",
    preview: "무서워서, 다쳐서, 억울해서 등",
    steps: [
      { n: 1, text: "즉시 그 아이 옆에 앉아서 눈높이를 맞춘다", sub: "서있으면 위압감. 반드시 같은 눈높이로" },
      { n: 2, text: "무슨 말도 하지 않고 먼저 공감", sub: "'많이 속상했구나' 한마디면 충분. 이유 묻기 전에 감정 먼저" },
      { n: 3, text: "나머지 아이들에게 잠깐 역할 주기", sub: "활동 잠깐 멈추고 '잠깐 기다려줘요' 부탁" },
      { n: 4, text: "원 선생님에게 전달", sub: "수업 끝나고 반드시 담임에게 상황 공유" },
    ],
    en: [
      { text: "Hey, it's okay. Come here.", pron: "헤이, 잇츠 오케이. 컴 히어." },
      { text: "You're safe. I'm right here.", pron: "유어 세이프. 아임 라잇 히어." },
      { text: "Take your time. It's okay.", pron: "테이크 유어 타임. 잇츠 오케이." },
    ],
    warn: "'왜 울어?' '그것도 못 참아?' 절대 금지. 아이가 더 위축됨",
    tip: "우는 아이를 빨리 달래려 하지 않아도 됨. 옆에 있어주는 것만으로 충분할 때가 많음",
  },
  {
    cat: "safety", level: "all",
    icon: "🤕", title: "아이가 다쳤어요",
    preview: "넘어지거나 부딪히거나 찰과상",
    steps: [
      { n: 1, text: "즉시 활동 전체 멈추기", sub: "'Freeze! 모두 잠깐 멈춰요' — 2차 사고 예방" },
      { n: 2, text: "다친 아이에게 달려가서 상태 확인", sub: "'괜찮아? 어디 다쳤어?' 당황하지 않고 차분하게" },
      { n: 3, text: "가볍게 다쳤으면 응급처치 후 재시작", sub: "찰과상 정도는 선생님이 처리 가능" },
      { n: 4, text: "머리나 심각해 보이면 즉시 원 선생님 호출", sub: "절대 혼자 판단하지 말 것" },
    ],
    en: [
      { text: "Freeze! Everyone stop!", pron: "프리즈! 에브리원 스탑!" },
      { text: "Oh no! Are you okay? Let me see.", pron: "오 노! 아 유 오케이? 렛 미 씨." },
      { text: "It's okay, you're going to be fine.", pron: "잇츠 오케이, 유어 고잉 투 비 파인." },
    ],
    warn: "다친 상황에서 당황한 표정을 보이면 아이가 더 크게 울음. 선생님이 침착해야 아이도 침착해짐",
    tip: "수업 전에 교실 내 응급처치 용품 위치 미리 파악해두기",
  },
  {
    cat: "safety", level: "all",
    icon: "😰", title: "지고 나서 울어요",
    preview: "게임이나 활동에서 지면 바로 눈물이 나는 아이",
    steps: [
      { n: 1, text: "즉시 경쟁 결과 발표 중단", sub: "이긴 팀 환호하기 전에 먼저 분위기 조절" },
      { n: 2, text: "우는 아이 감정 인정", sub: "'지면 속상하지. 선생님도 그래.' 공감 먼저" },
      { n: 3, text: "노력을 칭찬하기", sub: "'결과보다 열심히 한 게 더 멋있어!' 과정 중심으로" },
      { n: 4, text: "다시 도전할 기회 주기", sub: "진정되면 '한번 더 해볼까?' 자연스럽게 재참여" },
    ],
    en: [
      { text: "It's okay! You tried so hard today!", pron: "잇츠 오케이! 유 트라이드 쏘 하드 투데이!" },
      { text: "Winning isn't everything. You were amazing!", pron: "위닝 이즌트 에브리씽. 유 워 어메이징!" },
      { text: "Want to try again? I think you'll do great!", pron: "원트 투 트라이 어게인? 아이 띵크 유윌 두 그레잇!" },
    ],
    warn: "이긴 팀을 크게 축하하면서 진 팀을 무시하면 더 큰 상처가 됨",
    tip: "승패가 있는 게임보다 협동 게임 비중을 높이면 이런 상황 자체가 줄어듦",
  },
  {
    cat: "safety", level: "all",
    icon: "😱", title: "공황 또는 극도의 불안을 보여요",
    preview: "갑자기 굳어버리거나 과호흡, 극도로 무서워할 때",
    steps: [
      { n: 1, text: "조용한 공간으로 즉시 이동", sub: "자극을 줄여야 함. 다른 아이들 시선에서 벗어나게" },
      { n: 2, text: "낮고 차분한 목소리로 '여기 있어요' 반복", sub: "말 많이 하지 않기. 존재 자체가 안정" },
      { n: 3, text: "즉시 원 선생님 호출", sub: "체육 선생님이 혼자 처리하려 하지 않기" },
      { n: 4, text: "수업 후 반드시 부모님 전달 요청", sub: "담임에게 상세히 기록해서 전달" },
    ],
    en: [
      { text: "I'm right here. You're safe. Breathe with me.", pron: "아임 라잇 히어. 유어 세이프. 브리드 위드 미." },
      { text: "In through your nose... out through your mouth.", pron: "인 쓰루 유어 노즈... 아웃 쓰루 유어 마우쓰." },
      { text: "You're okay. I'm not going anywhere.", pron: "유어 오케이. 아임 낫 고잉 애니웨어." },
    ],
    warn: "공황 상태의 아이에게 '왜 그래' '별거 아니야' 절대 금지. 자극 최소화가 먼저",
    tip: "이런 아이가 있다는 걸 담임에게 미리 파악해두면 수업 중 훨씬 잘 대응할 수 있음",
  },
  {
    cat: "safety", level: "all",
    icon: "🏥", title: "몸이 아프다고 해요",
    preview: "수업 중 배 아프다, 머리 아프다고 하는 아이",
    steps: [
      { n: 1, text: "즉시 활동에서 빼고 앉히기", sub: "아픈 아이를 계속 활동시키면 안 됨" },
      { n: 2, text: "어디가 어떻게 아픈지 물어보기", sub: "증상 파악. 언제부터인지, 어느 정도인지" },
      { n: 3, text: "원 선생님께 즉시 전달", sub: "체육 선생님이 의학적 판단하지 않기" },
      { n: 4, text: "활동 핑계로 아프다는 경우도 있음", sub: "반복적이면 담임에게 패턴 공유" },
    ],
    en: [
      { text: "Oh no! Come sit down here with me.", pron: "오 노! 컴 싯 다운 히어 위드 미." },
      { text: "Where does it hurt? Show me.", pron: "웨어 더즈 잇 허트? 쇼 미." },
      { text: "Let's get your teacher right away.", pron: "렛츠 겟 유어 티쳐 라잇 어웨이." },
    ],
    warn: "'조금 있으면 괜찮아질 거야'로 넘어가면 안 됨. 아이 몸 상태는 항상 진지하게",
    tip: "수업 시작 전에 '오늘 몸 안 좋은 사람?' 미리 물어보면 수업 중 돌발 상황을 줄일 수 있음",
  },

  // ─────────────────────────────────
  // 👨‍🏫 기관·교사 관계
  // ─────────────────────────────────
  {
    cat: "institution", level: "new",
    icon: "👩‍🏫", title: "원 선생님이 수업에 개입해요",
    preview: "담임 선생님이 수업 중 아이들에게 직접 말하거나 개입할 때",
    steps: [
      { n: 1, text: "감사한 표정으로 자연스럽게 받아들이기", sub: "기분 나빠하거나 티 내면 관계가 나빠짐" },
      { n: 2, text: "수업 후 1:1로 조율", sub: "'선생님 덕분에 아이들이 잘 따라줬어요. 앞으로는 제가 먼저 해볼게요~'" },
      { n: 3, text: "원 선생님 역할을 수업에 공식 포함", sub: "'선생님이 응원해주실 거예요!' → 개입이 아니라 역할이 됨" },
      { n: 4, text: "수업 전에 미리 역할 분담 이야기", sub: "첫 수업 전에 '수업 중 제가 진행할게요' 자연스럽게 공지" },
    ],
    en: [
      { text: "Thank you! (to the teacher) — 원 선생님께 감사 표현", pron: "땡큐!" },
      { text: "Please watch us! We'll show you our best!", pron: "플리즈 워치 어스! 위윌 쇼 유 아워 베스트!" },
    ],
    warn: "원 선생님 앞에서 당황하거나 아이들이 보는 앞에서 선생님과 의견 충돌 절대 금지",
    tip: "원 선생님이 개입하는 건 대부분 아이들 걱정 때문. 신뢰를 쌓으면 자연스럽게 줄어듦",
  },
  {
    cat: "institution", level: "new",
    icon: "👔", title: "원장님이 갑자기 들어오셨어요",
    preview: "수업 중 원장님이 참관하러 들어올 때",
    steps: [
      { n: 1, text: "자연스럽게 인사하고 수업 계속하기", sub: "'안녕하세요~' 밝게 인사 후 바로 수업으로. 멈추지 않기" },
      { n: 2, text: "평소보다 조금 더 에너지 올리기", sub: "보여주기 위한 게 아니라 평소 수업 잘 하면 됨" },
      { n: 3, text: "수업 후 간단히 인사", sub: "'오늘 아이들이 정말 잘 해줬어요!' 긍정적으로 마무리" },
    ],
    en: [
      { text: "모든 영어 대사를 평소처럼 자연스럽게", pron: "" },
    ],
    warn: "원장님 보고 갑자기 수업 방식 바꾸거나 무리하게 잘 보이려 하면 오히려 어색해짐",
    tip: "원장님이 들어왔을 때 아이들이 즐겁게 참여하고 있는 모습 자체가 가장 좋은 수업 평가",
  },
  {
    cat: "institution", level: "new",
    icon: "👨‍👩‍👧", title: "학부모가 수업을 보고 있어요",
    preview: "참관 수업이거나 부모가 복도에서 보고 있을 때",
    steps: [
      { n: 1, text: "아이들에게 집중하기", sub: "부모를 의식하지 않고 아이들에게만 집중. 그게 가장 좋은 수업" },
      { n: 2, text: "평소 수업 그대로 하기", sub: "특별히 더 잘하려 하지 않아도 됨" },
      { n: 3, text: "수업 후 학부모에게 간단히 인사", sub: "'오늘 OO가 정말 잘 했어요!' 아이 칭찬으로 마무리" },
    ],
    en: [
      { text: "평소 대사 그대로 사용", pron: "" },
    ],
    warn: "부모 의식해서 아이들에게 과하게 잘 대해주거나 갑자기 달라지면 아이들이 이상하게 느낌",
    tip: "부모 참관이 있는 날 가장 중요한 건 '아이가 즐겁게 참여하는 모습'. 그것만 보여주면 됨",
  },
  {
    cat: "institution", level: "new",
    icon: "🤝", title: "기관 선생님이 협조를 안 해줘요",
    preview: "아이들 준비를 안 시켜주거나 공간 준비가 안 돼 있을 때",
    steps: [
      { n: 1, text: "첫 번째는 그냥 넘어가기", sub: "모르고 그랬을 수 있음. 바로 컴플레인하지 않기" },
      { n: 2, text: "수업 후 부드럽게 요청", sub: "'다음엔 이렇게 해주시면 더 좋을 것 같아요~' 감사하게" },
      { n: 3, text: "반복되면 GTS 본사에 상황 전달", sub: "개인이 해결하려 하지 말고 회사 차원에서 조율" },
    ],
    en: [],
    warn: "기관 선생님에게 직접 불만을 표현하면 관계가 나빠져서 매주 수업이 힘들어짐",
    tip: "기관 선생님과 좋은 관계를 유지하는 게 수업 환경에 가장 큰 영향을 줌. 먼저 베풀고 인정받기",
  },
  {
    cat: "institution", level: "new",
    icon: "🎙️", title: "보조교사가 대신 설명해요",
    preview: "아이들에게 말할 때 보조교사가 먼저 한국어로 설명해버릴 때",
    steps: [
      { n: 1, text: "감사하다고 하고 자연스럽게 이어받기", sub: "'감사해요~' 하고 바로 수업으로 넘어오기" },
      { n: 2, text: "수업 후 1:1로 부탁", sub: "'아이들이 제 영어에 익숙해지도록 기다려주시면 더 좋을 것 같아요'" },
      { n: 3, text: "보조교사 역할 명확히 해두기", sub: "첫 수업 전에 '저 혼자 진행할게요. 위험한 상황에서만 도와주세요'" },
    ],
    en: [],
    warn: "보조교사가 계속 개입하면 아이들이 선생님 영어를 기다리지 않음. 초반에 조율 필수",
    tip: "보조교사를 적으로 만들지 말기. '도와주셔서 감사한데 이렇게 하면 어떨까요?' 협력 관계로",
  },

  // ─────────────────────────────────
  // 🌀 마무리
  // ─────────────────────────────────
  {
    cat: "closing", level: "new",
    icon: "🌀", title: "마무리할 때 아이들이 흥분 상태예요",
    preview: "정리 안 하고 뛰어다닐 때",
    steps: [
      { n: 1, text: "음악이나 구호로 정리 신호를 만든다", sub: "매번 같은 신호를 쓰면 아이들이 조건반사처럼 반응함" },
      { n: 2, text: "정리를 게임처럼 만든다", sub: "'누가 제일 빨리 공 담나 볼까요?' 경쟁 요소 추가" },
      { n: 3, text: "정리 잘 한 아이에게 먼저 나가는 특권 주기", sub: "'이쁘게 정리한 사람부터 나가요' → 동기부여" },
    ],
    en: [
      { text: "Clean up time! Everyone help please!", pron: "클린 업 타임! 에브리원 헬프 플리즈!" },
      { text: "Who can pick up the most? Go!", pron: "후 캔 픽 업 더 모스트? 고!" },
      { text: "Walk to the door. Do not run. Do not push.", pron: "워크 투 더 도어. 두 낫 런. 두 낫 푸시." },
    ],
    warn: "퇴장이 가장 사고 많은 순간. 끝났다고 방심하면 안 됨",
    tip: "정리-퇴장 루틴을 매 수업 똑같이 하면 아이들이 자동으로 움직이게 됨",
  },
  {
    cat: "closing", level: "all",
    icon: "🧹", title: "정리를 아무도 안 해요",
    preview: "정리 시간에 아무도 움직이지 않을 때",
    steps: [
      { n: 1, text: "선생님이 먼저 정리 시작하기", sub: "말로만 시키지 말고 몸으로 보여주기" },
      { n: 2, text: "정리를 도와주는 아이 즉시 크게 칭찬", sub: "한 명이 움직이면 나머지가 따라옴" },
      { n: 3, text: "정리 미션으로 만들기", sub: "'공 5개 담는 사람이 먼저 나가요!' 목표 설정" },
    ],
    en: [
      { text: "Let's clean up together! Help me please!", pron: "렛츠 클린 업 투게더! 헬프 미 플리즈!" },
      { text: "OO is helping! Amazing! Who else?", pron: "OO 이즈 헬핑! 어메이징! 후 엘스?" },
      { text: "5 balls each! Ready, set, go!", pron: "파이브 볼즈 이치! 레디, 셋, 고!" },
    ],
    warn: "정리 안 한다고 화내면 수업 마지막 기억이 부정적으로 남음",
    tip: "정리도 수업의 일부라고 첫날부터 가르쳐두면 나중엔 자연스럽게 함",
  },
  {
    cat: "closing", level: "all",
    icon: "➕", title: "계속 더 하고 싶어 해요",
    preview: "수업 끝났는데 더 하고 싶다고 떼쓰는 아이들",
    steps: [
      { n: 1, text: "긍정적으로 받아들이기", sub: "'재미있었구나! 다음 주에 더 해요~' 약속으로 마무리" },
      { n: 2, text: "다음 수업에 대한 기대감 심어주기", sub: "'다음엔 더 신나는 거 할 거야!' 예고편 효과" },
      { n: 3, text: "단호하게 마무리", sub: "오늘은 여기까지. 규칙은 지켜야 함을 명확히" },
    ],
    en: [
      { text: "You loved it! That makes me so happy!", pron: "유 러브드 잇! 댓 메이크스 미 쏘 해피!" },
      { text: "Next time we'll do something even more fun!", pron: "넥스트 타임 위윌 두 썸씽 이븐 모어 펀!" },
      { text: "Class is over for today. See you next time!", pron: "클래스 이즈 오버 포 투데이. 씨 유 넥스트 타임!" },
    ],
    warn: "더 하고 싶다고 시간 늘려주면 매번 떼씀. 원칙 유지가 중요",
    tip: "'더 하고 싶어요'는 수업이 성공했다는 증거. 다음 수업 기대감으로 연결하면 동기부여가 됨",
  },
  {
    cat: "closing", level: "all",
    icon: "🏠", title: "집에 가기 싫어해요",
    preview: "수업 끝나고 나가지 않으려는 아이",
    steps: [
      { n: 1, text: "칭찬하며 자존감 높여주기", sub: "'오늘 너무 잘 했어! 다음엔 더 잘 할 것 같아~'" },
      { n: 2, text: "다음 수업 기대감 만들기", sub: "'다음 주에 비밀 교구 가져올게요~' 예고" },
      { n: 3, text: "원 선생님이나 부모님께 넘기기", sub: "퇴장 거부는 체육 선생님 역할이 아님. 담임에게 전달" },
    ],
    en: [
      { text: "You did amazing today! See you next week!", pron: "유 디드 어메이징 투데이! 씨 유 넥스트 위크!" },
      { text: "I have a surprise for next time. Guess what it is!", pron: "아이 해브 어 써프라이즈 포 넥스트 타임. 게스 왓 잇 이즈!" },
      { text: "Bye bye! I'll miss you!", pron: "바이 바이! 아일 미스 유!" },
    ],
    warn: "집에 안 가려는 아이를 억지로 보내려 하면 울거나 떼씀. 긍정적으로 마무리가 먼저",
    tip: "집에 가기 싫다는 건 수업이 좋았다는 뜻. 다음 주 기대감으로 연결하면 자연스럽게 나감",
  },
  {
    cat: "closing", level: "all",
    icon: "📦", title: "정리 후 다시 교구를 꺼내요",
    preview: "정리했는데 몰래 다시 교구 꺼내는 아이",
    steps: [
      { n: 1, text: "교구 정리 후 즉시 시야에서 치우기", sub: "눈앞에 있으면 손이 가는 게 당연. 가방에 넣거나 밖으로" },
      { n: 2, text: "꺼낸 아이에게 다시 정리하게 하기", sub: "'OO야 다시 담아줘요~' 본인이 직접 정리" },
      { n: 3, text: "퇴장 전까지 다른 활동으로 주의 돌리기", sub: "영어 복습, 스트레칭 등 손을 쓸 수 없는 활동으로 전환" },
    ],
    en: [
      { text: "We're all done! Please put it back.", pron: "위어 올 던! 플리즈 풋 잇 백." },
      { text: "Let's do our goodbye stretch first!", pron: "렛츠 두 아워 굿바이 스트레치 퍼스트!" },
      { text: "Class is finished. Time to line up!", pron: "클래스 이즈 피니쉬드. 타임 투 라인 업!" },
    ],
    warn: "다시 꺼내는 걸 못 본 척 넘어가면 반복됨. 바로 잡기",
    tip: "교구를 치운 직후 바로 다음 활동(인사, 복습)으로 넘어가면 교구에 관심이 끊김",
  },
];