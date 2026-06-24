// GTS 발음 팁 코너
// 선생님들이 자연스러운 영어 발음으로 수업할 수 있도록 돕는 축약형/연음 패턴 모음
// 영어 대본 프로그램 전반에서 공통으로 참고하는 자료

export const PRONUNCIATION_CATEGORIES = [
    { id: "want", label: "원하다 표현", icon: "💭" },
    { id: "going", label: "예정/계획 표현", icon: "🎯" },
    { id: "have", label: "필요/의무 표현", icon: "✅" },
    { id: "question", label: "질문 표현", icon: "❓" },
    { id: "connect", label: "연음/이어 읽기", icon: "🔗" },
  ];
  
  export const PRONUNCIATION_TIPS = [
  
    // ─────────────────────────────────
    // 원하다 표현
    // ─────────────────────────────────
    {
      cat: "want",
      written: "I want to sleep.",
      natural: "I wanna sleep.",
      pron: "아이 워너 슬립",
      note: "'want to'는 거의 항상 'wanna'로 줄여서 말해요. 또박또박 'want to'라고 하면 오히려 더 어색하게 들려요.",
      usedIn: "에어브릿지 — 선생님이 졸린 척할 때",
    },
    {
      cat: "want",
      written: "Do you want to try?",
      natural: "Do you wanna try?",
      pron: "두유 워너 트라이",
      note: "질문에서도 동일하게 적용. 아이들에게 물어볼 때 자연스럽게 쓰면 좋아요.",
      usedIn: "전체 활동 — 도전 유도할 때",
    },
  
    // ─────────────────────────────────
    // 예정/계획 표현
    // ─────────────────────────────────
    {
      cat: "going",
      written: "I am going to throw the ball.",
      natural: "I'm gonna throw the ball.",
      pron: "아임 거너 쓰로우 더 볼",
      note: "'going to'가 미래/계획을 나타낼 때는 'gonna'로 자연스럽게. 단, 진짜 '가다(이동)'를 의미할 때는 줄이지 않아요. (예: I'm going to the door는 그대로)",
      usedIn: "에어브릿지 — 다음 행동 예고할 때",
    },
    {
      cat: "going",
      written: "We are going to flip it upside down.",
      natural: "We're gonna flip it upside down.",
      pron: "위어 거너 플립 잇 업사이드 다운",
      note: "전환 멘트에서 자주 쓰는 패턴. 'We are' → 'We're'도 같이 줄여서 말하기.",
      usedIn: "에어브릿지 — 레벨 전환할 때",
    },
  
    // ─────────────────────────────────
    // 필요/의무 표현
    // ─────────────────────────────────
    {
      cat: "have",
      written: "You have to follow the rules.",
      natural: "You gotta follow the rules.",
      pron: "유 가러 팔로우 더 룰즈",
      note: "'have to'의 캐주얼한 버전이 'gotta'. 규칙 설명할 때 친근하게 들려서 아이들 수업에 잘 어울려요.",
      usedIn: "전체 활동 — 안전 규칙 설명할 때",
    },
    {
      cat: "have",
      written: "I have got to go now.",
      natural: "I gotta go now.",
      pron: "아이 가러 고 나우",
      note: "'have got to'도 'gotta'로. 'have'를 통째로 생략하는 경우가 많아요.",
      usedIn: "마무리 — 시간 안내할 때",
    },
  
    // ─────────────────────────────────
    // 질문 표현
    // ─────────────────────────────────
    {
      cat: "question",
      written: "What are you doing?",
      natural: "Whatcha doing?",
      pron: "와차 두잉",
      note: "아주 캐주얼한 버전. 수업에서는 'What are you doing?'을 천천히 또박또박 해도 괜찮지만, 빠르게 말할 때는 'whatcha'처럼 들려요. 알아두면 아이들이 원어민 영상 볼 때도 도움됨.",
      usedIn: "참고용 — 아이들이 다른 영상에서 들을 수 있는 표현",
    },
    {
      cat: "question",
      written: "Did you see that?",
      natural: "Didja see that?",
      pron: "디줘 씨 댓",
      note: "'Did you'는 빠르게 말하면 'd'와 'y'가 붙어서 '디줘'처럼 들려요. 의도적으로 줄여 말하지 않아도, 자연스럽게 빨리 말하면 이렇게 들린다는 걸 알면 듣기에 도움됨.",
      usedIn: "참고용 — 듣기 이해 도움",
    },
    {
      cat: "question",
      written: "What do you think?",
      natural: "Whaddaya think?",
      pron: "와더야 띵크",
      note: "Interactive 레벨에서 자주 쓰는 질문 패턴. 천천히 말해도 되지만 자연스러운 버전도 알아두면 좋아요.",
      usedIn: "Interactive 레벨 — 토론 유도할 때",
    },
  
    // ─────────────────────────────────
    // 연음/이어 읽기
    // ─────────────────────────────────
    {
      cat: "connect",
      written: "Climb up.",
      natural: "Climb up (붙여서 클라이멉)",
      pron: "클라이멉",
      note: "단어 끝 자음 + 다음 단어 시작 모음은 이어서 발음. 'Climb' 끝의 'b'(묵음 아님 주의)와 'up'의 'u'가 이어져서 '클라이멉'처럼 들려요.",
      usedIn: "전체 활동 — 동작 지시할 때",
    },
    {
      cat: "connect",
      written: "Good job!",
      natural: "Good job (구좝)",
      pron: "구좝",
      note: "'Good'의 'd'와 'job'의 'j'가 만나면 '굳잡'이 아니라 자연스럽게 흘러서 '구좝'에 가깝게 들려요.",
      usedIn: "전체 활동 — 칭찬할 때 가장 많이 쓰는 표현",
    },
    {
      cat: "connect",
      written: "Get out of here!",
      natural: "Get outta here!",
      pron: "게라우러 히어",
      note: "'out of'가 합쳐져서 'outta'. 에어브릿지에서 선생님이 화난 척 할 때 쓰는 표현이라 자연스럽게 하면 더 재미있게 들림.",
      usedIn: "에어브릿지 — 공에 맞아 화난 연기할 때",
    },
  ];
  
  export const PRONUNCIATION_GENERAL_TIPS = [
    {
      title: "느낌표 두 개(!!)는 끝을 올려서",
      desc: "대본에 '!!'가 있으면 문장 끝의 음을 살짝 올리면서 신나게 말해요. 평탄하게 읽으면 텐션이 안 살아요.",
    },
    {
      title: "구호(BRIDGE!! CLIMB!!)는 한 박자에 끊어서",
      desc: "구호성 단어는 음절 하나하나를 또박또박, 짧고 강하게. 길게 늘이지 않는 게 더 명확하게 전달돼요.",
    },
    {
      title: "모르는 단어는 차라리 자신있게",
      desc: "발음이 100% 정확하지 않아도 자신있게 크게 말하는 게, 작고 머뭇거리며 말하는 것보다 아이들에게 훨씬 잘 전달돼요.",
    },
    {
      title: "TTS 듣고 따라하기 연습",
      desc: "각 대본의 TTS 버튼으로 먼저 듣고, 녹음 버튼으로 자기 목소리 비교해보면서 톤과 속도를 맞춰보세요.",
    },
  ];