// GTS 영어 구호(call & response) 패턴 모음 — 체육 수업 현장용 (압축 버전)
// 3개 카테고리, 카테고리당 4~5개. 짧고 즉각적인 체육 구호 위주.

export const CALL_RESPONSE_BANK = {

    // ─────────────────────────────────
    // 출발 전 (한 명 뽑고 시작 직전)
    // ─────────────────────────────────
    beforeStart: [
      { call: "Are you ready?", response: "Yes, I'm ready!" },
      { call: "Can you do it?", response: "I can do it!" },
      { call: "Ready, set...?", response: "GO!!" },
      { call: "One, two, three — go?", response: "Go!!" },
      { call: "Let's go?", response: "Let's go!" },
    ],
  
    // ─────────────────────────────────
    // 활동 중 응원
    // ─────────────────────────────────
    duringActivity: [
      { call: "Keep going!", response: "I'm doing it!" },
      { call: "You can do it!", response: "Yes I can!" },
      { call: "Almost there!", response: "Almost there!" },
      { call: "One more step!", response: "One more step!" },
    ],
  
    // ─────────────────────────────────
    // 끝나고 반응 (성공/재도전 모두 포함)
    // ─────────────────────────────────
    afterActivity: [
      { call: "Did you do it?", response: "Yes, I did it!" },
      { call: "Was that fun?", response: "Yes, that was fun!" },
      { call: "Will you try again?", response: "Yes, I'll try again!" },
      { call: "Good job — who's next?", response: "Me, me!" },
      { call: "One more time?", response: "One more time!" },
    ],
  };
  
  // 사용 가이드
  export const CALL_RESPONSE_USAGE_GUIDE = [
    { category: "beforeStart", label: "출발 전", when: "한 명 뽑은 직후, 활동 시작 바로 전" },
    { category: "duringActivity", label: "활동 중 응원", when: "아이가 활동을 하고 있는 동안 옆에서 응원할 때" },
    { category: "afterActivity", label: "끝나고 반응", when: "성공했을 때, 실패해서 재도전할 때, 다음 사람 찾을 때 모두 활용" },
  ];