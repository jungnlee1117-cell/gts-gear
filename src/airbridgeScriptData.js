// GTS 에어브릿지 영어 수업 대본
// Foundation / Interactive / Inquiry 3단계 레벨 시스템

export const GEAR_LABEL = "에어브릿지";

export const LEVELS = [
  {
    id: "foundation",
    label: "Foundation English",
    desc: "영어 처음 접하는 아이들 — 한국어 50% + 핵심 단어만 영어",
    color: "#059669",
    bg: "#E1F5EE",
  },
  {
    id: "interactive",
    label: "Interactive English",
    desc: "영어 조금 아는 아이들 — 영어 위주 + 단어→짧은 문장 유도",
    color: "#d97706",
    bg: "#FAEEDA",
  },
  {
    id: "inquiry",
    label: "Inquiry English",
    desc: "영어 잘 하는 아이들 — 완전 영어 + 예측·토론·설명",
    color: "#7c3aed",
    bg: "#F5F3FF",
  },
];

export const STAGES = [
  { tag: "intro", label: "소개" },
  { tag: "level1", label: "Level 1" },
  { tag: "level2", label: "Level 2" },
  { tag: "level3", label: "Level 3" },
  { tag: "closing", label: "마무리" },
];

export const AIRBRIDGE_SCRIPTS = {

  // ═══════════════════════════════════════════════
  // FOUNDATION ENGLISH
  // 한국어 50% + 핵심 단어만 영어 / 구호 위주
  // ═══════════════════════════════════════════════
  foundation: [
    {
      stage: "intro",
      tagLabel: "교구 소개",
      tagColor: "default",
      time: "2~3분",
      note: "한국어로 시작 → 핵심 단어만 영어로",
      script: [
        { who: "teacher", text: "자, 여기 봐요! 선생님이 오늘 엄청난 걸 가져왔어요!", action: "교구를 등 뒤에 숨기고 과장된 표정으로" },
        { who: "kids", text: "(웅성웅성) 뭐예요?! 뭐예요?!", action: "" },
        { who: "teacher", text: "짜잔~!! Wow wow wow!!", action: "교구를 꺼내며 크게 놀란 표정", en: true },
        { who: "kids", text: "와~!! 뭐야~!!", action: "" },
        { who: "teacher", text: "이게 뭐처럼 보여요? 혹시... 선생님 침대?", action: "드러눕는 척" },
        { who: "kids", text: "아니야!! 아니야!!", action: "" },
        { who: "teacher", text: "아니야? 그럼... 선생님 샌드위치?", action: "먹는 척" },
        { who: "kids", text: "아니야!! 다리야!!", action: "" },
        { who: "teacher", text: "오!! A BRIDGE!! 다리!! 맞아요!!", action: "벌떡 일어나며 하이파이브", en: true },
        { who: "teacher", text: "다같이 따라해봐요 — BRIDGE!!", action: "손을 귀에 대고", en: true },
        { who: "kids", text: "BRIDGE!!", action: "" },
        { who: "teacher", text: "한 번 더!! BRIDGE!!", action: "더 크게 유도", en: true },
        { who: "teacher", text: "이 다리를 타고 올라갈 수 있어요! CLIMB UP!! 해봐요~", action: "올라가는 동작", en: true },
        { who: "kids", text: "CLIMB UP!!", action: "" },
        { who: "teacher", text: "Amazing!! 너무 잘했어요!!", action: "하이파이브", en: true },
      ],
      tip: "Bridge, Climb 두 단어만 확실히 심으면 됨. 나머지는 분위기. 아이들이 웃고 반응하면 성공"
    },
    {
      stage: "intro",
      tagLabel: "안전 규칙",
      tagColor: "amber",
      time: "1분",
      note: "질문은 영어, 대답은 아이들이 자연스럽게",
      script: [
        { who: "teacher", text: "자! 놀기 전에 규칙 먼저! 다리 위에서 뛰어도 돼요?", action: "뛰는 척하며" },
        { who: "kids", text: "안 돼요!!", action: "" },
        { who: "teacher", text: "영어로? Can I RUN?", action: "", en: true },
        { who: "kids", text: "NO!!", action: "" },
        { who: "teacher", text: "친구 밀어도 돼요? Can I PUSH?", action: "미는 척", en: true },
        { who: "kids", text: "NO!!", action: "" },
        { who: "teacher", text: "Good!! 우리는 걸어요~ WALK!! 따라해요~", action: "천천히 걷는 동작", en: true },
        { who: "kids", text: "WALK!!", action: "" },
        { who: "teacher", text: "준비됐어요? Are you ready??", action: "손 귀에 대고", en: true },
        { who: "kids", text: "YES I'M READY!!", action: "" },
      ],
      tip: "'Can I ~?' 패턴으로 규칙 물어보기. 아이들이 NO!! 외치면서 규칙을 자연스럽게 기억함"
    },
    {
      stage: "level1",
      tagLabel: "Level 1",
      tagColor: "default",
      time: "5~7분",
      note: "활동 중 응원은 영어, 지시는 한국어",
      script: [
        { who: "teacher", text: "자! 이름 부르면 여기 줄 서요~ 지후! 미나! 에이든! 이쪽으로~", action: "한명씩 이름 부르며" },
        { who: "teacher", text: "친구랑 간격 유지해요~ Space! Space~", action: "손으로 간격 만드는 동작", en: true },
        { who: "teacher", text: "준비? 3!! 2!! 1!! GO!!", action: "카운트다운", en: true },
        { who: "teacher", text: "CLIMB UP!! 잘한다!! Keep going!! Keep going!!", action: "올라가는 아이 응원", en: true },
        { who: "teacher", text: "AMAZING!! 했어요!! 너무 잘했어!! Next friend — GO!!", action: "내려온 아이 하이파이브 → 다음 아이 출발", en: true },
        { who: "teacher", text: "한 번 더 해볼까요? 더 잘할 수 있어요? Are you ready??", action: "", en: true },
        { who: "kids", text: "YES I'M READY!!", action: "" },
        { who: "teacher", text: "FREEZE!! 다들 너무 잘했어요!! 앉아요~", action: "휘슬 + 손 번쩍", en: true },
      ],
      tip: "이름 최대한 많이 불러주기. 응원은 영어로 자연스럽게 섞기. AMAZING, GOOD JOB은 반복해도 됨"
    },
    {
      stage: "level1",
      tagLabel: "전환 L1→L2",
      tagColor: "amber",
      time: "30초",
      note: "",
      script: [
        { who: "teacher", text: "이번엔 다리를 뒤집을 거예요! 보세요~", action: "에어브릿지 뒤집기" },
        { who: "teacher", text: "거꾸로! UPSIDE DOWN!! 다같이~", action: "", en: true },
        { who: "kids", text: "UPSIDE DOWN!!", action: "" },
        { who: "teacher", text: "이제 뭐처럼 보여요?", action: "" },
        { who: "kids", text: "배요!! 보트!!", action: "" },
        { who: "teacher", text: "맞아요~ A BOAT!! 배예요!!", action: "배 타는 흉내", en: true },
      ],
      tip: "전환 전 반드시 앉히기. 서있으면 집중 안 됨"
    },
    {
      stage: "level2",
      tagLabel: "Level 2",
      tagColor: "default",
      time: "5~7분",
      note: "흔들림 표현은 영어로 재미있게",
      script: [
        { who: "teacher", text: "이 배는 흔들려요~ WOBBLY WOBBLY!! 균형 잡아야 해요!", action: "흔들리는 동작 과장되게", en: true },
        { who: "teacher", text: "팔을 이렇게 펼쳐요~ Like an airplane~!", action: "비행기 자세 보여주기", en: true },
        { who: "teacher", text: "BALANCE!! 다같이~", action: "", en: true },
        { who: "kids", text: "BALANCE!!", action: "" },
        { who: "teacher", text: "3!! 2!! 1!! GO!! Balance, balance~!!", action: "", en: true },
        { who: "teacher", text: "팔 올리고~! Keep your arms UP!! 잘한다!!", action: "올라간 아이에게", en: true },
        { who: "teacher", text: "AMAZING BALANCE!! 대단해요!!", action: "엄지 척 + 함박웃음", en: true },
        { who: "teacher", text: "FREEZE!! 앉아요~ 다음 레벨 갈 준비됐어요?", action: "", en: true },
      ],
      tip: "Level 2는 빠르기가 아니라 균형. '천천히~'를 계속 말해주기"
    },
    {
      stage: "level2",
      tagLabel: "전환 L2→L3",
      tagColor: "amber",
      time: "1분",
      note: "연기 타임! 한국어로 더 재미있게",
      script: [
        { who: "teacher", text: "으~ 선생님 너무 피곤해요... 자고 싶다...", action: "기지개 켜며 졸린 척" },
        { who: "kids", text: "안 돼요!! 선생님!!", action: "" },
        { who: "teacher", text: "선생님 집에서 잘게요~ 이 다리가 선생님 집이에요~", action: "에어브릿지 안으로 들어가기" },
        { who: "kids", text: "안 돼요!! 일어나요!!", action: "" },
        { who: "teacher", text: "Shhh... I'm sleeping... zzzz...", action: "코 고는 소리 크게", en: true },
      ],
      tip: "연기를 크게 할수록 아이들이 더 신남. 한국어로 반응하면서 들어가도 OK"
    },
    {
      stage: "level3",
      tagLabel: "Level 3",
      tagColor: "default",
      time: "5~7분",
      note: "규칙은 영어로, 나머지는 한국어 섞기",
      script: [
        { who: "teacher", text: "zzzz... 쿨쿨...", action: "에어브릿지 안에서 코 고는 소리" },
        { who: "teacher", text: "선생님 깨우고 싶으면... 공을 집 안에 던져요~", action: "눈 반쯤 뜨고 속삭이듯" },
        { who: "teacher", text: "근데 규칙이 있어요! Rule 1 — STAND on the plate!!", action: "손가락 1개", en: true },
        { who: "kids", text: "STAND on the plate!!", action: "" },
        { who: "teacher", text: "Rule 2 — Do NOT run!!", action: "손가락 2개", en: true },
        { who: "kids", text: "Do NOT run!!", action: "" },
        { who: "teacher", text: "Rule 3 — Do NOT step on the balls!!", action: "손가락 3개", en: true },
        { who: "kids", text: "Do NOT step on the balls!!", action: "" },
        { who: "teacher", text: "준비? 3!! 2!! 1!! THROW!!", action: "다시 눕기", en: true },
        { who: "kids", text: "(신나게 공 던지기)", action: "플레이트 위에 서서 던짐" },
        { who: "teacher", text: "Ow!! Ouch!! 누가 공 던지는 거야?!", action: "꿈틀거리며 일어나는 척", en: true },
        { who: "teacher", text: "GET OUT!! 내 집에서 나가!! 이 공들아!!", action: "공을 집 밖으로 던지기. 아이들 웃음 폭발", en: true },
      ],
      tip: "이 순간이 수업 최고 에너지 포인트! 선생님이 과장할수록 아이들이 더 신남"
    },
    {
      stage: "closing",
      tagLabel: "마무리",
      tagColor: "green",
      time: "3~5분",
      note: "마무리는 따뜻하게, 오늘 배운 영어 단어 복습으로 끝",
      script: [
        { who: "teacher", text: "OH MY GOODNESS!! 포기할게요!! 못 자겠어요!!", action: "벌떡 일어나며", en: true },
        { who: "teacher", text: "여러분이 깨웠어요!! 너무 잘했어요!! You're amazing!!", action: "하이파이브", en: true },
        { who: "teacher", text: "자! 정리 시간~ 공을 가방에 넣어요! Clean up!!", action: "공 가방 들고 보여주기", en: true },
        { who: "teacher", text: "누가 공을 제일 많이 담을까요? GO!!", action: "경쟁 요소로 재미있게", en: true },
        { who: "kids", text: "(신나게 공 줍기)", action: "" },
        { who: "teacher", text: "오늘 재미있었어요? Did you have fun??", action: "손 귀에 대고", en: true },
        { who: "kids", text: "YES!!", action: "" },
        { who: "teacher", text: "오늘 배운 말 같이 해봐요~ BRIDGE!! CLIMB!! BALANCE!! THROW!!", action: "손가락으로 하나씩 세며", en: true },
        { who: "kids", text: "BRIDGE!! CLIMB!! BALANCE!! THROW!!", action: "" },
        { who: "teacher", text: "완벽해요!! 다음에 또 만나요~ Bye bye!!", action: "문 앞에서 한명씩 보내기", en: true },
      ],
      tip: "마무리에 오늘 배운 영어 단어 4개 복습 꼭 넣기. 4개만 기억해도 성공"
    },
  ],

  // ═══════════════════════════════════════════════
  // INTERACTIVE ENGLISH
  // 영어 위주 진행 / 단어→짧은 문장 유도
  // ═══════════════════════════════════════════════
  interactive: [
    {
      stage: "intro",
      tagLabel: "교구 소개",
      tagColor: "default",
      time: "3분",
      note: "단어 → 짧은 문장으로 확장하는 게 핵심",
      script: [
        { who: "teacher", text: "Wow! Everyone look at this! What do you see?", action: "교구 꺼내며 아이들 반응 기다리기", en: true },
        { who: "kids", text: "다리! Bridge!", action: "단어로 대답" },
        { who: "teacher", text: "Yes! It's a bridge! Can everyone say — bridge?", action: "", en: true },
        { who: "kids", text: "Bridge!", action: "" },
        { who: "teacher", text: "Good! Hmm... is this a giant bed? Can I sleep here?", action: "드러눕는 척", en: true },
        { who: "kids", text: "No!! It's a bridge!!", action: "웃으며 외치기" },
        { who: "teacher", text: "Oh right! A bridge! We can CLIMB UP! Everyone say — climb up!", action: "올라가는 동작", en: true },
        { who: "kids", text: "Climb up!", action: "" },
        { who: "teacher", text: "Can you climb up the bridge? Tell me — yes I can or no I can't!", action: "문장으로 대답 유도", en: true },
        { who: "kids", text: "Yes I can!!", action: "" },
        { who: "teacher", text: "Let's find out!! Are you ready?", action: "", en: true },
        { who: "kids", text: "Yes I'm ready!!", action: "" },
      ],
      tip: "단어 대답 나오면 '문장으로 해봐요' 한번 더 유도. Bridge! → It's a bridge! → I can climb! 순서로"
    },
    {
      stage: "intro",
      tagLabel: "안전 규칙",
      tagColor: "amber",
      time: "1분",
      note: "단어 대답 → 문장으로 확장",
      script: [
        { who: "teacher", text: "Before we start — rules! Can I run on the bridge?", action: "뛰는 동작하며", en: true },
        { who: "kids", text: "No!", action: "" },
        { who: "teacher", text: "Right! We cannot run. Say — we cannot run!", action: "", en: true },
        { who: "kids", text: "We cannot run!", action: "" },
        { who: "teacher", text: "Can I push my friend?", action: "", en: true },
        { who: "kids", text: "No!", action: "" },
        { who: "teacher", text: "We must keep the rules! Say — we must keep the rules!", action: "", en: true },
        { who: "kids", text: "We must keep the rules!", action: "" },
        { who: "teacher", text: "Are you ready? Yes I'm ready!!", action: "", en: true },
        { who: "kids", text: "Yes I'm ready!!", action: "" },
      ],
      tip: "No! → We cannot run! 으로 확장. 짧은 문장 패턴 반복이 핵심"
    },
    {
      stage: "level1",
      tagLabel: "Level 1",
      tagColor: "default",
      time: "5~7분",
      note: "활동 중 질문하고 문장으로 대답하게 유도",
      script: [
        { who: "teacher", text: "Okay! If I call your name — line up here!", action: "이름 한명씩 부르기", en: true },
        { who: "teacher", text: "Leave some space between you and your friend!", action: "간격 손동작", en: true },
        { who: "teacher", text: "Ready? 3, 2, 1 — GO!", action: "", en: true },
        { who: "teacher", text: "Climb up! Good! Keep going! Almost there!", action: "이름 부르며 응원", en: true },
        { who: "teacher", text: "How do you feel? Is it easy or hard?", action: "내려온 아이에게 질문", en: true },
        { who: "kids", text: "Easy! / Hard! / It's fun!", action: "단어나 짧은 문장으로" },
        { who: "teacher", text: "Tell me in a sentence — it is easy or it is hard!", action: "문장으로 확장 유도", en: true },
        { who: "kids", text: "It is easy! / It is hard!", action: "" },
        { who: "teacher", text: "Amazing!! One more time! Can you do better?", action: "", en: true },
        { who: "kids", text: "Yes I can!", action: "" },
        { who: "teacher", text: "Freeze! Great job! Sit down please!", action: "휘슬 + 손 들기", en: true },
      ],
      tip: "활동 중 질문하고 문장으로 대답하게 유도. 단어 대답 나오면 '문장으로 해봐요' 한번 더"
    },
    {
      stage: "level1",
      tagLabel: "전환 L1→L2",
      tagColor: "amber",
      time: "30초",
      note: "새 표현 하나씩 심기",
      script: [
        { who: "teacher", text: "This time — we flip the bridge! Everyone say — upside down!", action: "뒤집으며", en: true },
        { who: "kids", text: "Upside down!", action: "" },
        { who: "teacher", text: "What does it look like now? Tell me!", action: "", en: true },
        { who: "kids", text: "A boat! It looks like a boat!", action: "" },
        { who: "teacher", text: "Yes!! Say — it looks like a boat!", action: "", en: true },
        { who: "kids", text: "It looks like a boat!", action: "" },
      ],
      tip: "전환마다 새로운 문장 패턴 하나씩 심기. 이 섹션: 'It looks like a ___'"
    },
    {
      stage: "level2",
      tagLabel: "Level 2",
      tagColor: "default",
      time: "5~7분",
      note: "비교 문장 유도. harder than 패턴",
      script: [
        { who: "teacher", text: "This boat moves! It goes back and forth! Say — back and forth!", action: "몸으로 앞뒤 흔들기", en: true },
        { who: "kids", text: "Back and forth!", action: "" },
        { who: "teacher", text: "Be careful! Keep your balance! Arms up like this!", action: "팔 벌리는 자세", en: true },
        { who: "teacher", text: "3, 2, 1 — GO! Balance balance balance!", action: "", en: true },
        { who: "teacher", text: "How does it feel? Is it the same as Level 1?", action: "내려온 아이에게", en: true },
        { who: "kids", text: "No! It's different! It moves!", action: "" },
        { who: "teacher", text: "Tell me — Level 2 is harder than Level 1! Say it!", action: "비교 문장 유도", en: true },
        { who: "kids", text: "Level 2 is harder than Level 1!", action: "" },
        { who: "teacher", text: "Yes!! Because it moves! Great balance everyone!!", action: "", en: true },
        { who: "teacher", text: "Freeze! Sit down! Level 3 is coming!", action: "기대감 심기", en: true },
      ],
      tip: "'harder than', 'different from' 비교 표현 자연스럽게 심어주기"
    },
    {
      stage: "level2",
      tagLabel: "전환 L2→L3",
      tagColor: "amber",
      time: "1분",
      note: "",
      script: [
        { who: "teacher", text: "Now... I am very very tired...", action: "기지개 켜며", en: true },
        { who: "teacher", text: "I want to sleep in my bridge house. Can I sleep?", action: "에어브릿지 안으로", en: true },
        { who: "kids", text: "No!! You cannot sleep!!", action: "" },
        { who: "teacher", text: "Why not? Tell me — you cannot sleep because...", action: "문장 완성 유도", en: true },
        { who: "kids", text: "You cannot sleep because we want to play!", action: "" },
        { who: "teacher", text: "Okay okay... zzzz", action: "드러누우며 코 고기", en: true },
      ],
      tip: "'because'로 이유 문장 만들기. Interactive 레벨에서 연습하기 좋은 문형"
    },
    {
      stage: "level3",
      tagLabel: "Level 3",
      tagColor: "default",
      time: "5~7분",
      note: "규칙 → 아이들이 스스로 말하게",
      script: [
        { who: "teacher", text: "zzzz... If you want to wake me up — throw the balls inside!", action: "반쯤 눈 뜨고 속삭이듯", en: true },
        { who: "teacher", text: "Rule 1 — stand on the plate! Rule 2 — do not run! Rule 3 — do not step on the balls!", action: "손가락으로 하나씩", en: true },
        { who: "teacher", text: "What are the rules? Tell me!", action: "아이들이 규칙 말하게", en: true },
        { who: "kids", text: "Stand on the plate! Do not run! Do not step on the balls!", action: "" },
        { who: "teacher", text: "Perfect! Ready? 3, 2, 1 — throw!!", action: "누우면서", en: true },
        { who: "teacher", text: "Ow! Ouch! Who is throwing balls at me?! I don't like it!!", action: "꿈틀거리며 일어나는 척", en: true },
        { who: "teacher", text: "Get out!! Get out of my house you little balls!!", action: "공 집 밖으로 던지기", en: true },
      ],
      tip: "규칙을 선생님이 말하고 아이들이 따라하다가 마지막엔 아이들이 스스로 말하게"
    },
    {
      stage: "closing",
      tagLabel: "마무리",
      tagColor: "green",
      time: "3~5분",
      note: "오늘 배운 표현 복습으로 끝",
      script: [
        { who: "teacher", text: "Oh my goodness!! I give up!! I am awake now!!", action: "벌떡 일어나며", en: true },
        { who: "teacher", text: "Amazing job everyone!! Clean up time! Everyone help!", action: "", en: true },
        { who: "teacher", text: "Did you have fun today? Tell me — I had fun because...", action: "문장 완성 유도", en: true },
        { who: "kids", text: "I had fun because I threw the balls! / Because I climbed!", action: "" },
        { who: "teacher", text: "Today we learned — climb up, climb down, balance, throw! Say them all!", action: "오늘 배운 단어 복습", en: true },
        { who: "kids", text: "Climb up! Climb down! Balance! Throw!", action: "" },
        { who: "teacher", text: "Perfect!! See you next time! Line up please — walk!", action: "문 앞에서 한명씩 보내기", en: true },
      ],
      tip: "마무리에 오늘 배운 단어 복습 꼭 넣기. because 문장 한번 더"
    },
  ],

  // ═══════════════════════════════════════════════
  // INQUIRY ENGLISH
  // 완전 영어 / 예측·토론·설명
  // ═══════════════════════════════════════════════
  inquiry: [
    {
      stage: "intro",
      tagLabel: "교구 소개",
      tagColor: "default",
      time: "3~5분",
      note: "예측하고 생각하게 유도. 왜 하는지 알면 더 진지하게 참여",
      script: [
        { who: "teacher", text: "Alright everyone, gather around. Take a look at this carefully.", action: "교구를 천천히 꺼내며", en: true },
        { who: "teacher", text: "Take a moment. What do you think this is? What does it remind you of?", action: "5초 기다리기. 생각할 시간 주기", en: true },
        { who: "kids", text: "A bridge! A ramp! Maybe a slide?", action: "다양한 대답", en: true },
        { who: "teacher", text: "Great observation. What kind of bridge does this remind you of?", action: "한 아이 대답 확장", en: true },
        { who: "kids", text: "Like a mountain bridge! A balance bridge!", action: "", en: true },
        { who: "teacher", text: "Exactly. This is an Air Bridge. Any predictions on what we'll do today? Three levels — each harder than the last.", action: "세 손가락", en: true },
        { who: "kids", text: "Climb it! Balance! Maybe throw something?", action: "", en: true },
        { who: "teacher", text: "Before we start — what skills do you think this develops? Think about it.", action: "진지하게", en: true },
        { who: "kids", text: "Balance! Coordination! Focus! Strength!", action: "", en: true },
        { who: "teacher", text: "All of those. Plus something called proprioception — your body's sense of where it is in space. Let's go.", action: "간결하게", en: true },
      ],
      tip: "'왜 하는지'를 알면 훨씬 진지하게 참여함. 설명에 시간 써도 됨"
    },
    {
      stage: "intro",
      tagLabel: "안전 규칙",
      tagColor: "amber",
      time: "2분",
      note: "아이들이 스스로 규칙 만들게",
      script: [
        { who: "teacher", text: "Before we begin — don't just listen. Tell ME the safety rules. What could go wrong up there?", action: "아이들에게 직접", en: true },
        { who: "kids", text: "No running! No pushing! Wait your turn! Arms out for balance!", action: "", en: true },
        { who: "teacher", text: "Excellent. You made the rules yourselves — so you already know what to do.", action: "", en: true },
        { who: "teacher", text: "If someone breaks a rule — what should WE do as a group?", action: "그룹 책임감", en: true },
        { who: "kids", text: "Remind them! Say the rule!", action: "", en: true },
        { who: "teacher", text: "Exactly. We support each other. Ready?", action: "", en: true },
      ],
      tip: "아이들이 스스로 만든 규칙은 훨씬 잘 지킴"
    },
    {
      stage: "level1",
      tagLabel: "Level 1",
      tagColor: "default",
      time: "5~7분",
      note: "활동 중 대화. 생각하게 만들기",
      script: [
        { who: "teacher", text: "Level 1 — basic traverse. Climb up, walk across, climb down. Focus on your technique.", action: "시범 보이며", en: true },
        { who: "teacher", text: "Watch your foot placement. Watch your center of gravity. Go.", action: "한명씩 출발", en: true },
        { who: "teacher", text: "Notice how you shift your weight. Which foot is carrying more load right now?", action: "올라가는 아이에게", en: true },
        { who: "kids", text: "My right foot! Both feel equal!", action: "", en: true },
        { who: "teacher", text: "Good body awareness. Arms help with balance — where should they be?", action: "", en: true },
        { who: "teacher", text: "After everyone goes — what was the hardest part and why?", action: "reflection 예고", en: true },
        { who: "kids", text: "Getting down was harder! The top was wobbly!", action: "", en: true },
        { who: "teacher", text: "Interesting. Why is going down harder than going up?", action: "토론 유도", en: true },
      ],
      tip: "하면서 질문하고 생각하게 만드는 게 핵심. Inquiry는 활동 중 대화 가능"
    },
    {
      stage: "level1",
      tagLabel: "전환 L1→L2",
      tagColor: "amber",
      time: "1분",
      note: "예측 → 실험 구조",
      script: [
        { who: "teacher", text: "Freeze. Sit down. Level 2 — same bridge, different challenge. What changes when I flip it?", action: "뒤집기 전 예측", en: true },
        { who: "kids", text: "It'll rock! Less stable! The surface changes!", action: "", en: true },
        { who: "teacher", text: "Let's test your predictions.", action: "뒤집기", en: true },
      ],
      tip: "예측 → 실험 구조. 집중도가 높아짐"
    },
    {
      stage: "level2",
      tagLabel: "Level 2",
      tagColor: "default",
      time: "5~7분",
      note: "전략 세우고 실행하고 비교",
      script: [
        { who: "teacher", text: "The bridge is now unstable. Cross it without letting it touch the ground on either side.", action: "", en: true },
        { who: "teacher", text: "What's your strategy before you go?", action: "시작 전 전략", en: true },
        { who: "kids", text: "Go slow! Center my weight! Arms wide!", action: "", en: true },
        { who: "teacher", text: "Apply your strategy. Go.", action: "", en: true },
        { who: "teacher", text: "How does this compare to Level 1?", action: "건너는 아이에게", en: true },
        { who: "kids", text: "Way harder! I have to think about every step!", action: "", en: true },
        { who: "teacher", text: "That's mindful movement — being intentional about every action. Remember this feeling.", action: "", en: true },
        { who: "teacher", text: "Did your predictions match reality? What surprised you?", action: "debrief", en: true },
      ],
      tip: "예측→실행→비교. 아이들이 과학자처럼 생각하게"
    },
    {
      stage: "level2",
      tagLabel: "전환 L2→L3",
      tagColor: "amber",
      time: "1분",
      note: "",
      script: [
        { who: "teacher", text: "Nice work. Level 3 is completely different — involves teamwork and accuracy. Guesses?", action: "", en: true },
        { who: "kids", text: "Throw something? Work together? A relay?", action: "", en: true },
        { who: "teacher", text: "Watch this.", action: "에어브릿지 안으로 들어가 눕기", en: true },
      ],
      tip: "Inquiry 아이들도 선생님이 드러눕는 건 신남"
    },
    {
      stage: "level3",
      tagLabel: "Level 3",
      tagColor: "default",
      time: "5~7분",
      note: "팀 전략 + 실행 + reflection",
      script: [
        { who: "teacher", text: "Here's the scenario. I'm asleep in my house. Your mission — as a team — wake me up by throwing all the balls inside.", action: "진지하게", en: true },
        { who: "teacher", text: "Constraints: feet on plate only, no running, no stepping on balls. Why do these rules exist?", action: "", en: true },
        { who: "kids", text: "Safety! We might slip! Trip hazard!", action: "", en: true },
        { who: "teacher", text: "Exactly. 30 seconds to make a team plan. Go.", action: "타이머 30초", en: true },
        { who: "kids", text: "(서로 작전 짜기)", action: "선생님은 에어브릿지 안으로" },
        { who: "teacher", text: "zzzz...", action: "진짜 자는 척", en: true },
        { who: "teacher", text: "Ow!! What is happening?! Who authorized this?!", action: "과장되게 일어나며", en: true },
        { who: "teacher", text: "How did your plan work? What would you change?", action: "reflection", en: true },
      ],
      tip: "팀 전략 시간 주면 스스로 조직함. 개입하지 않아도 됨"
    },
    {
      stage: "closing",
      tagLabel: "마무리",
      tagColor: "green",
      time: "3~5분",
      note: "진심 어린 한마디로 끝. 과장 금지",
      script: [
        { who: "teacher", text: "Clean up together. Everyone picks up at least 5 balls.", action: "", en: true },
        { who: "teacher", text: "While you clean — what was the most challenging moment today and why?", action: "생각하며 정리", en: true },
        { who: "teacher", text: "Quick reflection — who wants to share?", action: "2~3명", en: true },
        { who: "kids", text: "Level 2 was hardest because I had to control my weight!", action: "", en: true },
        { who: "teacher", text: "The hardest part wasn't physical — it was the thinking. That's what separates good athletes from great ones.", action: "진지하게", en: true },
        { who: "teacher", text: "Next time we're adding another dimension to this. Think about what that might be.", action: "다음 수업 기대감", en: true },
        { who: "teacher", text: "Line up. Walk to the door. Good work today — genuinely.", action: "진심으로. 과장하지 않고", en: true },
      ],
      tip: "과장된 칭찬보다 진심 어린 한마디가 더 효과적"
    },
  ],
};

export const scripts = [
  ...AIRBRIDGE_SCRIPTS.foundation,
  ...AIRBRIDGE_SCRIPTS.interactive,
  ...AIRBRIDGE_SCRIPTS.inquiry,
];
