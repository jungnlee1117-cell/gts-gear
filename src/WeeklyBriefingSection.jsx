import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Sparkles } from "lucide-react";
import { fetchTeacherGearExtras } from "./teacherGearStatus.js";
import {
  buildBriefingAskPayload,
  buildWeeklyBriefingCards,
  dispatchGitiAsk,
} from "./giti/weeklyBriefing.js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

function BriefingCard({ card, onAsk }) {
  return (
    <article className="weekly-briefing-card">
      <div className="weekly-briefing-card__media">
        {card.photoUrl ? (
          <img src={card.photoUrl} alt={card.gearName} />
        ) : (
          <div className="weekly-briefing-card__media-empty" aria-hidden>
            {card.gearName.slice(0, 1)}
          </div>
        )}
      </div>
      <div className="weekly-briefing-card__body">
        <p className="weekly-briefing-card__eyebrow">이번 주 브리핑</p>
        <h3 className="weekly-briefing-card__title">{card.gearName}</h3>
        <p className="weekly-briefing-card__meta">
          사용 가능 기간 · {card.availabilityRange}
        </p>
        <p className="weekly-briefing-card__meta">
          {card.classLabel}
          <span className="weekly-briefing-card__dot">·</span>
          {card.ageLabel}
        </p>
        <div className="weekly-briefing-card__acts">
          <p className="weekly-briefing-card__acts-label">추천 활동</p>
          <ol>
            {card.recommendedActivities.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ol>
        </div>
        <button type="button" className="weekly-briefing-card__cta" onClick={() => onAsk(card)}>
          <Sparkles size={16} strokeWidth={2.2} aria-hidden />
          지티에게 물어보기
        </button>
      </div>
    </article>
  );
}

/**
 * 선생님 홈(공지) — 이번 주 교구 브리핑 카드
 * 복수 배정 시 카드 분리 (교구×기관)
 */
export default function WeeklyBriefingSection({ me, items }) {
  const [extras, setExtras] = useState(null);
  const [loading, setLoading] = useState(true);
  const [todayKey, setTodayKey] = useState(() => new Date().toDateString());

  useEffect(() => {
    const refresh = () => setTodayKey(new Date().toDateString());
    const timer = window.setInterval(refresh, 60 * 1000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  useEffect(() => {
    if (!me?.id) return undefined;
    let cancelled = false;
    setLoading(true);
    fetchTeacherGearExtras(supabase, me)
      .then((data) => {
        if (!cancelled) setExtras(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [me?.id]);

  const briefing = useMemo(() => {
    if (!extras) return { cards: [], calendarWeek: null, asOf: null };
    return buildWeeklyBriefingCards({
      schedules: extras.schedules,
      weeklyLists: extras.weeklyLists,
      monthWeeks: extras.monthWeeks,
      weeklySlots: extras.weeklySlots,
      items,
      me,
    });
  }, [extras, items, me, todayKey]);

  const onAsk = (card) => {
    const payload = buildBriefingAskPayload(card);
    if (payload) dispatchGitiAsk(payload);
  };

  if (loading) {
    return (
      <section className="weekly-briefing-section" aria-busy="true">
        <div className="weekly-briefing-section__intro">
          <h2 className="weekly-briefing-section__title">이번 주 브리핑</h2>
          <p className="weekly-briefing-section__sub">배정 정보를 불러오는 중…</p>
        </div>
      </section>
    );
  }

  if (!briefing.cards.length) {
    return (
      <section className="weekly-briefing-section">
        <div className="weekly-briefing-section__intro">
          <h2 className="weekly-briefing-section__title">이번 주 브리핑</h2>
          <p className="weekly-briefing-section__sub">
            이번 주(월~일) 확인 가능한 교구 배정이 없습니다.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="weekly-briefing-section" aria-label="이번 주 브리핑">
      <div className="weekly-briefing-section__intro">
        <h2 className="weekly-briefing-section__title">이번 주 브리핑</h2>
        <p className="weekly-briefing-section__sub">
          {briefing.calendarWeek?.label
            ? `${briefing.calendarWeek.label} (월~일)`
            : "이번 주"}
          {" · "}
          배정 교구와 반별로 나눠 보여드려요.
          {briefing.asOf ? ` · 기준 ${briefing.asOf}` : ""}
        </p>
      </div>
      <div className="weekly-briefing-grid">
        {briefing.cards.map((card) => (
          <BriefingCard key={card.id} card={card} onAsk={onAsk} />
        ))}
      </div>
    </section>
  );
}
