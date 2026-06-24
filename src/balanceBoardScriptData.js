// GTS 밸런스보드 9가지 활동 대본 (v2 - 스토리 강화 버전)
// 컨셉: "신비한 동물 보드" — 보드 위에서 9가지 동물/모험으로 변신하는 하나의 이야기
// 활동 사이 전환 멘트 + 의성어/효과음 + 과장된 리액션 강화

export const BALANCE_BOARD_INTRO = {
    title: "오프닝",
    script: [
      {
        who: "teacher",
        action: "보드를 신비롭게 들고 등장",
        lines: {
          foundation: "짜잔~!! 이건 그냥 보드가 아니에요... 마법의 보드예요!!",
          interactive: "This isn't just a board... it's a MAGIC board!",
        },
      },
      {
        who: "kids",
        action: "신기해하며 모여듬",
        lines: { foundation: "마법요?? 진짜요??", interactive: "Magic?? Really??" },
      },
      {
        who: "teacher",
        action: "보드 바닥에 살짝 내려놓으며 비밀스럽게",
        lines: {
          foundation: "이 위에 올라가면~ 동물이 될 수 있어요!! 오늘 우리 9가지 동물이 될 거예요!",
          interactive: "When you get on this board, you can become any animal! Today we'll become 9 different things!",
        },
      },
      {
        who: "teacher",
        action: "손가락으로 9 만들며 기대감 조성",
        lines: {
          foundation: "준비됐어요?? Are you ready??",
          interactive: "Are you ready for this adventure??",
        },
      },
      {
        who: "kids",
        text: "YES I'M READY!!",
        action: "신나서 대답",
        lines: { foundation: "YES I'M READY!!", interactive: "YES I'M READY!!" },
      },
    ],
  };
  
  export const BALANCE_BOARD_ACTIVITIES = [
  
    // ─────────────────────────────────
    // 1. 앉아서 좌우 — "흔들흔들 배"
    // ─────────────────────────────────
    {
      id: "sit-side",
      num: 1,
      title: "앉아서 좌우",
      titleEn: "Sit & Rock Side to Side",
      theme: "흔들흔들 배",
      time: "2~3분",
      transitionIn: {
        foundation: "첫 번째 변신!! 우리는... 작은 배가 될 거예요!! 통통배~!!",
        interactive: "Transformation #1! We're becoming a little boat!",
      },
      script: [
        {
          who: "teacher",
          action: "밸런스보드를 아이 앞에 놓고 앉기 자세 시범",
          lines: {
            foundation: "여기 앉아봐요~ 다리 꼬고! 짠~ 우리는 이제 배예요!!",
            interactive: "Sit down like this! Cross your legs — you're now a little boat!",
          },
        },
        {
          who: "kids",
          action: "보드에 앉으며 흔들림에 반응",
          lines: { foundation: "(웃으며) 흔들려요!! 출렁출렁!!", interactive: "Whoa, it's rocking! Splash splash!" },
        },
        {
          who: "teacher",
          action: "보드 양쪽을 손으로 잡는 시범. 파도 소리 흉내",
          lines: {
            foundation: "손으로 여기 잡아요~ 그리고! 파도가 친다~!! SIDE TO SIDE!! 출렁~ 출렁~!!",
            interactive: "Hold the edges! Here comes a wave! Rock — side to side! Splash!",
          },
        },
        {
          who: "kids",
          action: "좌우로 몸을 기울이며 흔들기",
          lines: { foundation: "SIDE TO SIDE!! 출렁출렁!!", interactive: "Side to side! Splash splash!" },
        },
        {
          who: "teacher",
          action: "큰 파도 흉내내며 더 크게 흔들기 유도",
          lines: {
            foundation: "이번엔 큰 파도다!! WHOOSH!! 더 크게!! 와우 와우!!",
            interactive: "Big wave coming — WHOOSH! Bigger! Can you go bigger?",
          },
        },
      ],
      tip: "처음 앉을 때 무서워하는 아이들 많음. 선생님이 손 잡아주면서 시작하면 안정감을 줄 수 있음. '배' 컨셉으로 시작하면 다음 활동들도 이야기로 연결하기 쉬움",
    },
  
    // ─────────────────────────────────
    // 2. 앉아서 앞뒤 — "흔들흔들 배 (폭풍 버전)"
    // ─────────────────────────────────
    {
      id: "sit-front-back",
      num: 2,
      title: "앉아서 앞뒤",
      titleEn: "Sit & Rock Front to Back",
      theme: "폭풍 만난 배",
      time: "2~3분",
      transitionIn: {
        foundation: "어이쿠!! 갑자기 폭풍이 몰려와요!! 이번엔 앞뒤로 흔들려요!!",
        interactive: "Uh oh! A storm is coming! Now the boat rocks front to back!",
      },
      script: [
        {
          who: "teacher",
          action: "앞으로 기울이는 동작 보여주며 긴장감 조성",
          lines: {
            foundation: "폭풍이다!! 앞으로 휩쓸려요~ FRONT!! 그리고 뒤로~ BACK!!",
            interactive: "Storm waves! Lean forward — FRONT! Now lean back — BACK!",
          },
        },
        {
          who: "kids",
          action: "방향을 바꿔 시도하며 반응",
          lines: { foundation: "(시도하며) 어 다르다!! 무서워요!!", interactive: "It feels different! A little scary!" },
        },
        {
          who: "teacher",
          action: "더 빠르게 흔들며 폭풍 효과음",
          lines: {
            foundation: "FRONT!! BACK!! FRONT!! BACK!! 폭풍이 더 세진다!!",
            interactive: "Front! Back! Front! Back! The storm is getting stronger!",
          },
        },
        {
          who: "teacher",
          action: "폭풍 끝나는 척 천천히 멈추기",
          lines: {
            foundation: "휴~ 폭풍이 지나갔어요!! 우리 배가 살았다!!",
            interactive: "Phew! The storm has passed! Our boat survived!",
          },
        },
      ],
      tip: "좌우보다 앞뒤가 약간 더 어려움. '폭풍' 컨셉으로 강도를 자연스럽게 올렸다가 내리면서 긴장과 안정을 둘 다 경험시킬 수 있음",
    },
  
    // ─────────────────────────────────
    // 3. 일어서서 좌우 — "서핑보드 챌린지"
    // ─────────────────────────────────
    {
      id: "stand-side",
      num: 3,
      title: "일어서서 좌우",
      titleEn: "Stand & Rock Side to Side",
      theme: "서핑보드 챌린지",
      time: "3~4분",
      transitionIn: {
        foundation: "이제 배가 서핑보드로 변신!! 일어서볼까요?",
        interactive: "Our boat just became a surfboard! Time to stand up!",
      },
      script: [
        {
          who: "teacher",
          action: "서핑하는 자세로 양팔 벌리는 시범",
          lines: {
            foundation: "서퍼처럼!! 팔 벌려요~ 비행기처럼~! Arms out!",
            interactive: "Like a surfer! Arms out like an airplane! This helps you balance.",
          },
        },
        {
          who: "kids",
          action: "조심스럽게 일어서기",
          lines: { foundation: "(조심조심) 무서워요... 떨어질 것 같아요!", interactive: "I'm a little scared! It's wobbly!" },
        },
        {
          who: "teacher",
          action: "손 내밀어 도와주며 안심시키기",
          lines: {
            foundation: "선생님이 잡아줄게요! 천천히~ 서퍼들도 처음엔 다 그래요!",
            interactive: "I've got you. Take it slow! Even real surfers wobble at first!",
          },
        },
        {
          who: "teacher",
          action: "좌우로 균형 잡으며 파도 타는 흉내",
          lines: {
            foundation: "와!! 서있다!! 진짜 서퍼다!! BALANCE!! BALANCE!!",
            interactive: "You're standing! You're a real surfer! Now rock — side to side!",
          },
        },
        {
          who: "kids",
          action: "균형 잡으며 환호",
          lines: { foundation: "나 서핑한다!!", interactive: "I'm surfing!!" },
        },
      ],
      tip: "서서 하는 첫 활동이라 안전이 최우선. 선생님이 항상 가까이서 손 내밀 준비하고 있기. '서퍼' 컨셉이 아이들에게 자신감을 줌",
    },
  
    // ─────────────────────────────────
    // 4. 엎드려서 앞뒤로 흔들기 — "슈퍼히어로 비행"
    // ─────────────────────────────────
    {
      id: "prone-rock",
      num: 4,
      title: "엎드려서 앞뒤로 흔들기",
      titleEn: "Prone Rock Front to Back",
      theme: "슈퍼히어로 비행",
      time: "2~3분",
      transitionIn: {
        foundation: "서핑보드는 끝!! 이번엔... 하늘을 날아볼까요?? 슈퍼히어로처럼!!",
        interactive: "Surfboard time is over! Now let's FLY — like a superhero!",
      },
      script: [
        {
          who: "teacher",
          action: "엎드리는 자세를 슈퍼맨처럼 표현",
          lines: {
            foundation: "이번엔 슈퍼맨처럼!! 엎드려요~ 하늘을 날아갈 준비!!",
            interactive: "Like Superman! Lie down on your tummy — ready for take off!",
          },
        },
        {
          who: "kids",
          action: "배를 대고 엎드리며 슈퍼히어로 흉내",
          lines: { foundation: "슈퍼맨!! WHOOSH!!", interactive: "I'm Superman! WHOOSH!" },
        },
        {
          who: "teacher",
          action: "팔다리 살짝 들고 흔드는 시범. 바람 소리",
          lines: {
            foundation: "팔다리 살짝 들고~ 하늘을 날아가요~! WHOOSH!! ROCK ROCK!!",
            interactive: "Lift your arms and legs a little. You're flying! Rock front to back!",
          },
        },
        {
          who: "teacher",
          action: "구름 위를 나는 척 연기하며 응원",
          lines: {
            foundation: "구름 위를 날아간다!! 더 높이!! WHOOSH WHOOSH!!",
            interactive: "You're flying above the clouds! Higher! Keep that balance!",
          },
        },
      ],
      tip: "슈퍼맨 컨셉으로 가면 아이들이 훨씬 적극적으로 참여함. 효과음(WHOOSH!) 같이 내주면 좋음. 팔 벌리고 날아가는 모습 사진 찍기 좋은 포인트",
    },
  
    // ─────────────────────────────────
    // 5. 밸런스보드 위에서 고양이자세 — "야생 고양이"
    // ─────────────────────────────────
    {
      id: "cat-pose",
      num: 5,
      title: "고양이자세",
      titleEn: "Cat Pose on the Board",
      theme: "야생 고양이",
      time: "2~3분",
      transitionIn: {
        foundation: "착지!! 슈퍼히어로가 땅에 내려와서... 고양이로 변신!!",
        interactive: "Landing! Our superhero transforms into a wild cat!",
      },
      script: [
        {
          who: "teacher",
          action: "고양이처럼 네발기기 자세 시범",
          lines: {
            foundation: "이제 고양이가 돼볼까요? 야옹~!",
            interactive: "Let's be a cat! Get on your hands and knees!",
          },
        },
        {
          who: "kids",
          action: "네발기기 자세 시도하며 고양이 소리",
          lines: { foundation: "야옹~ 야옹~!!", interactive: "Meow meow!" },
        },
        {
          who: "teacher",
          action: "등을 둥글게/평평하게 움직이는 동작 시범",
          lines: {
            foundation: "화난 고양이!! 등을 동그랗게~! 그리고 졸린 고양이~! 평평하게~!",
            interactive: "Angry cat — round your back! Now sleepy cat — flat like sleeping!",
          },
        },
        {
          who: "teacher",
          action: "고양이 소리 내며 분위기 살리기. 놀란 고양이까지 추가",
          lines: {
            foundation: "MEOW!! 화난 고양이~! 졸린 고양이~! 놀란 고양이~!! 하악!!",
            interactive: "Angry cat — MEOW! Sleepy cat — yawwwn! Surprised cat — HISS!",
          },
        },
      ],
      tip: "고양이 흉내를 적극적으로 내면 아이들 호응이 폭발적. 화난/졸린/놀란 고양이 등 변형 추가 가능. 다음 활동(공 주고받기)을 '고양이 친구들이 노는 시간'으로 연결하기 좋음",
    },
  
    // ─────────────────────────────────
    // 6. 공 주고받기 — "고양이 친구들 놀이"
    // ─────────────────────────────────
    {
      id: "pass-ball",
      num: 6,
      title: "공 주고받기",
      titleEn: "Pass the Ball",
      theme: "고양이 친구들 놀이",
      time: "3~5분",
      transitionIn: {
        foundation: "고양이 친구가 나타났어요!! 이제 같이 놀아볼까요?",
        interactive: "Another cat friend appeared! Time to play together!",
      },
      script: [
        {
          who: "teacher",
          action: "두 명씩 짝지어 보드에 세우기",
          lines: {
            foundation: "친구랑 짝! 둘 다 보드 위에 서요~ 이제 고양이 둘이서 놀아요!",
            interactive: "Find a partner! Both of you stand on your boards — two cats ready to play!",
          },
        },
        {
          who: "teacher",
          action: "공 던지고 받는 동작 시범",
          lines: {
            foundation: "공을 던져요~ 그리고 받아요!! CATCH!!",
            interactive: "Throw the ball! Now catch — CATCH!",
          },
        },
        {
          who: "kids",
          action: "공을 주고받으며 균형 유지 시도",
          lines: { foundation: "(흔들리며) 어어!! 떨어진다!!", interactive: "Whoa, I almost fell!" },
        },
        {
          who: "teacher",
          action: "성공할 때마다 과장되게 칭찬",
          lines: {
            foundation: "잘했어요!! 고양이 친구들 최고!! 한 번 더!!",
            interactive: "Great catch! Best cat friends ever! One more time!",
          },
        },
      ],
      tip: "균형+공 받기 동시에 하는 거라 난이도가 확 올라감. 처음엔 가벼운 공으로, 거리도 짧게 시작. '고양이 친구들' 컨셉 유지하면서 재미 살리기",
    },
  
    // ─────────────────────────────────
    // 7. 보드 터널 통과 — "비밀 동굴 탐험"
    // ─────────────────────────────────
    {
      id: "tunnel",
      num: 7,
      title: "보드 터널 통과",
      titleEn: "Crawl Under",
      theme: "비밀 동굴 탐험",
      time: "2~3분",
      transitionIn: {
        foundation: "고양이 놀이는 끝!! 이제 우리 보드가 비밀 동굴로 변신해요!!",
        interactive: "Playtime is over! Now the board becomes a secret cave!",
      },
      script: [
        {
          who: "teacher",
          action: "보드를 터널처럼 세워서 보여주기",
          lines: {
            foundation: "와!! 동굴이다!! 탐험가처럼 통과해볼까요?",
            interactive: "Whoa, a cave! Can you explore through it like a real explorer?",
          },
        },
        {
          who: "kids",
          action: "기어가며 터널 통과 시도",
          lines: { foundation: "(기어가며) 어두워요~! 탐험가다!!", interactive: "It's dark in here! I'm an explorer!" },
        },
        {
          who: "teacher",
          action: "동굴 탐험 느낌으로 응원",
          lines: {
            foundation: "거의 다 왔어요!! 빛이 보인다!! 통과!! 짠~!!",
            interactive: "Almost there! I can see the light! You made it through!",
          },
        },
      ],
      tip: "터널 통과는 휴식 같은 활동. 다른 활동들 사이에 긴장 풀어주는 용도로 좋음. '동굴 탐험'으로 분위기를 차분하게 전환하는 타이밍",
    },
  
    // ─────────────────────────────────
    // 8. 보드 거꾸로 하고 누워 스트레칭 — "동굴 속 휴식"
    // ─────────────────────────────────
    {
      id: "inverted-stretch",
      num: 8,
      title: "보드 거꾸로 누워 스트레칭",
      titleEn: "Stretch on the Board (Inverted)",
      theme: "동굴 속 휴식",
      time: "2~3분",
      transitionIn: {
        foundation: "동굴 탐험을 마치고... 이제 잠깐 쉬어갈까요? 보드가 침대로 변신!",
        interactive: "After exploring, let's take a rest. The board becomes a bed!",
      },
      script: [
        {
          who: "teacher",
          action: "보드 뒤집어서 등을 대고 눕는 시범",
          lines: {
            foundation: "이번엔 누워서~ 등을 대고 쭉~! 편안한 휴식 시간이에요!",
            interactive: "Now lie down on your back. Stretch out and relax!",
          },
        },
        {
          who: "kids",
          action: "등을 대고 누워 스트레칭",
          lines: { foundation: "기분 좋아요~ 편안해요~", interactive: "This feels so relaxing!" },
        },
        {
          who: "teacher",
          action: "팔다리 쭉 뻗는 동작 유도. 호흡까지 같이",
          lines: {
            foundation: "팔다리 쭉쭉~! STRETCH!! 숨도 깊게~ 후~",
            interactive: "Stretch your arms and legs out — STRETCH! Take a deep breath too.",
          },
        },
      ],
      tip: "수업 마무리 직전 진정 단계에 넣기 좋은 활동. 호흡까지 같이 유도하면 효과적. 다음 활동(마지막 도전)을 위한 에너지 충전 타임",
    },
  
    // ─────────────────────────────────
    // 9. 표적 던지기 — "마지막 챌린지: 명사수"
    // ─────────────────────────────────
    {
      id: "target-throw",
      num: 9,
      title: "표적 던지기",
      titleEn: "Target Throw",
      theme: "마지막 챌린지: 명사수",
      time: "3~5분",
      transitionIn: {
        foundation: "충전 완료!! 마지막 챌린지예요!! 이번엔 명사수가 되어볼까요?",
        interactive: "Recharged! This is the final challenge — become a sharpshooter!",
      },
      script: [
        {
          who: "teacher",
          action: "콘 세워두고 보드 위에 서게 하기",
          lines: {
            foundation: "보드 위에 서서~ 저 콘을 맞춰봐요!! 명사수처럼!!",
            interactive: "Stand on the board and aim for the cone — like a sharpshooter!",
          },
        },
        {
          who: "teacher",
          action: "공 던지는 자세 시범. 긴장감 조성",
          lines: {
            foundation: "균형 잡고~ 조준~! 던져요!! THROW!!",
            interactive: "Find your balance, aim... and — THROW!",
          },
        },
        {
          who: "kids",
          action: "균형 잡으며 표적에 공 던지기",
          lines: { foundation: "(던지며) 맞았다!! 명사수다!!", interactive: "I hit it! I'm a sharpshooter!" },
        },
        {
          who: "teacher",
          action: "성공/실패 모두 격려하며 9가지 도전 완료 축하",
          lines: {
            foundation: "잘했어요!! 9가지 변신 완료!! 우리 모두 챔피언이에요!!",
            interactive: "Great try! You completed all 9 transformations — you're all champions!",
          },
        },
      ],
      tip: "마지막 활동으로 좋음. 경쟁 요소 살짝 넣어서 '누가 더 많이 맞히나' 게임으로 마무리 가능. 9가지 변신을 모두 완료했다는 성취감을 강조하며 마무리",
    },
  ];
  
  export const BALANCE_BOARD_CLOSING = {
    title: "마무리",
    script: [
      {
        who: "teacher",
        action: "보드를 들고 9가지 변신을 정리하며 회상",
        lines: {
          foundation: "오늘 우리 뭐였지? 배! 서퍼! 슈퍼히어로! 고양이! 탐험가! 명사수!! 다 기억나요??",
          interactive: "What were we today? A boat! A surfer! A superhero! A cat! An explorer! A sharpshooter! Remember them all?",
        },
      },
      {
        who: "kids",
        action: "신나서 하나씩 외치기",
        lines: { foundation: "배!! 슈퍼맨!! 고양이!!", interactive: "Boat! Superhero! Cat!" },
      },
      {
        who: "teacher",
        action: "마무리 인사",
        lines: {
          foundation: "오늘 다들 최고였어요!! 정리하고 다음에 또 만나요~!",
          interactive: "You were all amazing today! Let's clean up and see you next time!",
        },
      },
    ],
  };
  
  export const BALANCE_BOARD_SAFETY = [
    "보드는 안전한 공간에서 사용해요",
    "친구와 부딫히지 않도록 충분한 간격을 유지해요",
    "맨발로 하거나 미끄럼 방지 양말을 신고 사용해요",
    "보드 위에서 뛰거나 장난치지 않아요",
    "보드가 움직이지 않는지 확인하고 사용해요",
    "활동 전후 보드를 깨끗이 정리해요",
  ];