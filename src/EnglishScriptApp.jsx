import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ChevronLeft, ChevronRight, Volume2, ChevronDown, Loader2,
  BookOpen, ShieldCheck, Lightbulb, User, ArrowRight,
  Bell, Info, Mic, Play, X,
} from "lucide-react";
import { PRONUNCIATION_TIPS } from "./pronunciationTipsData.js";
import {
  LEVELS, AIRBRIDGE_SCRIPTS, STAGES,
  scripts as airbridgeScripts,
} from "./airbridgeScriptData.js";
import { situations } from "./situationData.js";
import { activities as flowTipsActivities } from "./tipsData.js";
import { childTypes } from "./childTypesData.js";
import { useGoogleTts } from "./useGoogleTts.js";
import { useLineRecording } from "./useLineRecording.js";
import { useGearItems } from "./useGearItems.js";
import EnglishProgramLayout from "./EnglishProgramLayout.jsx";
import GearScriptLibraryView from "./GearScriptLibraryView.jsx";
import { useEnglishProgramNavigate } from "./useEnglishProgramNavigate.js";
import {
  getGearCatalog,
  LEVEL_IDS,
  matchGearId,
  getCategoryMeta,
  getActivityGearScripts,
  getGearLevelIds,
} from "./gearScriptMeta.js";
import { initGearScriptEntries } from "./gearScriptEntriesApi.js";

function computeScriptCount() {
  return airbridgeScripts.length
    + getGearCatalog().filter(g => g.type === "activities").reduce(
      (sum, g) => sum + (getActivityGearScripts(g.id)?.activities.length ?? 0),
      0,
    );
}

const LESSON_FLOW = [
  { num: 1, label: "교구소개" },
  { num: 2, label: "Foundation" },
  { num: 3, label: "Interactive" },
  { num: 4, label: "마무리" },
];

const LANDING_STAT_DEFS = [
  { label: "교구 대본", icon: BookOpen, getCount: () => computeScriptCount() },
  { label: "상황별 대응", icon: ShieldCheck, getCount: situations },
  { label: "수업 흐름 팁", icon: Lightbulb, getCount: flowTipsActivities },
  { label: "발음 팁", icon: Mic, getCount: PRONUNCIATION_TIPS },
  { label: "아이 유형", icon: User, getCount: childTypes },
];

const LANDING_MENU = [
  { id: "situations", icon: ShieldCheck, title: "상황별 대처", desc: "9가지 현장 상황별 대처 방법", ready: true },
  { id: "flow-tips", icon: Lightbulb, title: "수업 흐름 팁", desc: "인사·준비운동·게임 등 실전 활동 라이브러리", ready: true },
  { id: "pronunciation", icon: Mic, title: "발음 팁", desc: "자연스러운 영어 발음 · 축약형·연음 패턴", ready: true },
  { id: "child-types", icon: User, title: "아이 유형별 카드", desc: "12가지 아이 유형별 특징과 지도 방법", ready: true },
];

function stageIndex(stageTag) {
  const idx = STAGES.findIndex(s => s.tag === stageTag);
  return idx >= 0 ? idx : 0;
}

function resolveLevelText(source, levelId) {
  if (!source) return "";
  if (typeof source === "string") return source;
  return source[levelId] ?? "";
}

function resolveActivityLines(script, levelId) {
  return script.map(line => ({
    who: line.who,
    text: line.lines?.[levelId] ?? "",
    action: line.action,
    en: line.who === "teacher" && levelId !== "foundation",
  }));
}

function resolveTransitionLine(transitionIn, levelId) {
  const text = resolveLevelText(transitionIn, levelId);
  if (!text) return null;
  return {
    who: "teacher",
    text,
    en: levelId !== "foundation",
  };
}

function activityTitleLabel(activity) {
  const numTitle = `${activity.num}. ${activity.title}`;
  return activity.theme ? `${numTitle} — ${activity.theme}` : numTitle;
}

function buildActivityGearCards(gearScripts) {
  if (!gearScripts) return [];
  const activityCards = gearScripts.activities.map(data => ({ type: "activity", data }));
  if (gearScripts.activitiesOnly) return activityCards;
  return [
    ...(gearScripts.intro ? [{ type: "intro", data: gearScripts.intro }] : []),
    ...activityCards,
    ...(gearScripts.closing ? [{ type: "closing", data: gearScripts.closing }] : []),
  ];
}

function activityGearCardLabel(card, introTagSuffix) {
  if (!card) return "";
  if (card.type === "intro") return `${card.data.title} — ${introTagSuffix}`;
  if (card.type === "closing") return card.data.title;
  return activityTitleLabel(card.data);
}

function bubbleClass(line) {
  if (line.who === "kids") return "ab-bubble--kids";
  if (line.en) return "ab-bubble--teacher-en";
  return "ab-bubble--teacher-ko";
}

function whoLabel(who) {
  return who === "teacher" ? "선생님" : "아이들";
}

function TipBox({ tip }) {
  if (!tip) return null;
  return (
    <div className="ab-tip">
      <span className="ab-tip-label">TIP</span>
      <p>{tip}</p>
    </div>
  );
}

function LinePracticeControls({ text, lineKey, tts, recording, enableMic = true, iconSize = 14 }) {
  if (!tts || !text?.trim()) return null;

  const ttsLoading = tts.isLineLoading(lineKey);
  const ttsPlaying = tts.isLinePlaying(lineKey);
  const showMic = enableMic && recording;
  const isRecording = showMic && recording.isRecording(lineKey);
  const hasRecording = showMic && recording.hasRecording(lineKey);
  const isPlayingSelf = showMic && recording.isPlayingRecording(lineKey);

  return (
    <div className="ab-practice-controls">
      <button
        type="button"
        className={`ab-bubble-tts${ttsPlaying ? " ab-bubble-tts--playing" : ""}`}
        onClick={() => {
          recording?.stopPlayback?.();
          tts.toggle(text, lineKey);
        }}
        aria-label={ttsPlaying || ttsLoading ? "재생 정지" : "영어 발음 듣기"}
        aria-busy={ttsLoading}
      >
        {ttsLoading
          ? <Loader2 size={iconSize} className="ab-listen-spin" aria-hidden/>
          : <Volume2 size={iconSize} strokeWidth={2} aria-hidden/>}
      </button>
      {showMic ? (
        <button
          type="button"
          className={`ab-bubble-mic${isRecording ? " ab-bubble-mic--recording" : ""}`}
          onClick={() => {
            tts.stop?.();
            recording.toggleMic(lineKey);
          }}
          aria-label={isRecording ? "녹음 정지" : "발음 녹음"}
          aria-pressed={isRecording}
        >
          <Mic size={iconSize} strokeWidth={2} aria-hidden/>
        </button>
      ) : null}
      {showMic && hasRecording ? (
        <button
          type="button"
          className={`ab-bubble-playback${isPlayingSelf ? " ab-bubble-playback--playing" : ""}`}
          onClick={() => {
            tts.stop?.();
            recording.playRecording(lineKey);
          }}
          aria-label={isPlayingSelf ? "내 녹음 정지" : "내 목소리 들어보기"}
        >
          <Play size={iconSize} strokeWidth={2} aria-hidden/>
        </button>
      ) : null}
    </div>
  );
}

function Dialogue({ lines, compact = false, tts, recording, lineKeyPrefix = "", enablePractice = false }) {
  return (
    <div className={`ab-dialogue${compact ? " ab-dialogue--compact" : ""}`}>
      {lines.map((line, i) => {
        const lineKey = `${lineKeyPrefix}${i}`;
        const showPractice = line.who === "teacher" && line.en === true;

        return (
          <div key={i} className={`ab-line ab-line--${line.who}`}>
            <div className={`ab-bubble ${bubbleClass(line)}`}>
              <span className="ab-who">{whoLabel(line.who)}</span>
              <div className="ab-text-row">
                <p className="ab-text">{line.text}</p>
                {showPractice ? (
                  <LinePracticeControls
                    text={line.text}
                    lineKey={lineKey}
                    tts={tts}
                    recording={recording}
                    enableMic={enablePractice}
                  />
                ) : null}
              </div>
              {line.action ? <p className="ab-action">{line.action}</p> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SectionMeta({ section }) {
  return (
    <div className="ab-section-meta">
      <span className={`ab-tag ab-tag--${section.tagColor}`}>{section.tagLabel}</span>
      <span className="ab-time">{section.time}</span>
      {section.note ? <span className="ab-note">{section.note}</span> : null}
    </div>
  );
}

function ActivityMeta({ activity, showTheme = true }) {
  return (
    <div className="ab-section-meta">
      <span className="ab-tag">
        {showTheme ? activityTitleLabel(activity) : `${String(activity.num).padStart(2, "0")}. ${activity.title}`}
      </span>
      <span className="ab-time">{activity.time}</span>
      {activity.titleEn ? <span className="ab-note">{activity.titleEn}</span> : null}
    </div>
  );
}

function TransitionInBlock({ transitionIn, levelId, tts, recording, lineKeyPrefix, enablePractice = false }) {
  const line = resolveTransitionLine(transitionIn, levelId);
  if (!line) return null;

  return (
    <div className="ab-transition-block">
      <p className="ab-transition-label">전환 멘트</p>
      <Dialogue
        lines={[line]}
        tts={tts}
        recording={recording}
        enablePractice={enablePractice}
        lineKeyPrefix={`${lineKeyPrefix}transition-`}
      />
    </div>
  );
}

function PrepAccordion({ sectionKey, isOpen, onToggle, head, children }) {
  return (
    <div className={`ab-accordion${isOpen ? " open" : ""}`}>
      <button
        type="button"
        className="ab-accordion-trigger"
        onClick={() => onToggle(sectionKey)}
        aria-expanded={isOpen}
      >
        {head}
        <ChevronDown size={20} className="ab-accordion-chevron" aria-hidden/>
      </button>
      {isOpen && <div className="ab-accordion-body">{children}</div>}
    </div>
  );
}

function LandingView({ onBack, onGoMain, onNavigate, onStartScript, onGoSituations, onGoChildTypes, onGoFlowTips, onGoPronunciationTips }) {
  const landingStats = useMemo(
    () => LANDING_STAT_DEFS.map(({ label, icon, getCount }) => ({
      label,
      icon,
      value: typeof getCount === "function" ? getCount() : getCount.length,
    })),
    [],
  );

  const handleMenu = (id, ready) => {
    if (!ready) return;
    if (id === "situations") onGoSituations?.();
    if (id === "flow-tips") onGoFlowTips?.();
    if (id === "child-types") onGoChildTypes?.();
    if (id === "pronunciation") onGoPronunciationTips?.();
  };

  return (
    <EnglishProgramLayout activeId="" onBack={onBack} onGoMain={onGoMain} onNavigate={onNavigate}>
    <div className="eng-landing">
      <header className="eng-landing-nav">
        <div className="eng-landing-nav-left">
          <button type="button" className="eng-landing-brand-btn" onClick={onBack} aria-label="뒤로가기">
            <span className="eng-landing-brand">GTS <strong>English Program</strong></span>
          </button>
        </div>
        <div className="eng-landing-nav-right">
          <button type="button" className="eng-landing-nav-link"><Bell size={16} strokeWidth={2}/>공지사항</button>
          <span className="eng-landing-nav-divider" aria-hidden/>
          <button type="button" className="eng-landing-nav-link">내 정보</button>
        </div>
      </header>

      <main className="eng-landing-main">
        <section className="eng-landing-hero">
          <div className="eng-landing-hero-text">
            <p className="eng-landing-eyebrow">현장에서 바로 사용할 수 있는</p>
            <h1 className="eng-landing-title">GTS 영어 수업 대본 프로그램</h1>
            <p className="eng-landing-desc">
              Foundation · Interactive 2단계 레벨별 교구 수업 대본
            </p>
            <button type="button" className="eng-landing-cta" onClick={onStartScript}>
              교구 대본 시작하기
              <ArrowRight size={18} strokeWidth={2.5}/>
            </button>
          </div>
          <div className="eng-landing-stats-panel">
            <div className="eng-landing-stats">
              {landingStats.map(stat => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="eng-landing-stat">
                    <div className="eng-landing-stat-icon">{Icon && <Icon size={20} strokeWidth={2}/>}</div>
                    <div className="eng-landing-stat-text">
                      <div className="eng-landing-stat-value">{stat.value}<span>개</span></div>
                      <div className="eng-landing-stat-label">{stat.label}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="eng-landing-grid">
          <button type="button" className="eng-landing-card eng-landing-card--featured" onClick={onStartScript}>
            <span className="eng-landing-featured-badge">★ 대표 기능</span>
            <div className="eng-landing-card-row">
              <div className="eng-landing-card-icon"><BookOpen size={24} strokeWidth={1.75}/></div>
              <div className="eng-landing-card-body">
                <div className="eng-landing-card-title">교구 대본</div>
                <div className="eng-landing-card-desc">에어브릿지 · 밸런스보드 등 교구별 스크립트</div>
              </div>
              <ChevronRight size={20} className="eng-landing-card-chevron"/>
            </div>
            <div className="eng-landing-card-flow">
              {LESSON_FLOW.map((step, i) => (
                <div key={step.num} className="eng-landing-flow-item">
                  <div className="eng-landing-flow-step">
                    <span className="eng-landing-flow-num">{step.num}</span>
                    <span className="eng-landing-flow-ko">{step.label}</span>
                  </div>
                  {i < LESSON_FLOW.length - 1 && <div className="eng-landing-flow-line" aria-hidden/>}
                </div>
              ))}
            </div>
          </button>

          {LANDING_MENU.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={`eng-landing-card${item.ready ? "" : " eng-landing-card--soon"}`}
                onClick={() => handleMenu(item.id, item.ready)}
                disabled={!item.ready}
              >
                <div className="eng-landing-card-row">
                  <div className={`eng-landing-card-icon${item.ready ? "" : " eng-landing-card-icon--soon"}`}>
                    <Icon size={22} strokeWidth={1.75}/>
                  </div>
                  <div className="eng-landing-card-body">
                    <div className="eng-landing-card-title-row">
                      <div className="eng-landing-card-title">{item.title}</div>
                      {!item.ready ? <span className="eng-landing-soon-badge">준비중</span> : null}
                    </div>
                    <div className="eng-landing-card-desc">{item.desc}</div>
                  </div>
                  <ChevronRight size={20} className="eng-landing-card-chevron"/>
                </div>
              </button>
            );
          })}
        </section>

        <footer className="eng-landing-footer">
          <Info size={15} strokeWidth={2}/>
          <span>모든 콘텐츠는 현장 경험을 바탕으로 제작되었으며, 실제 수업에서 바로 활용할 수 있습니다.</span>
        </footer>
      </main>
    </div>
    </EnglishProgramLayout>
  );
}

function PrepView({ sections, openSections, onToggle, tts, recording }) {
  const grouped = useMemo(() => {
    const map = new Map();
    sections.forEach((sec, idx) => {
      if (!map.has(sec.stage)) map.set(sec.stage, []);
      map.get(sec.stage).push({ sec, idx });
    });
    return STAGES
      .map(s => ({ stage: s, items: map.get(s.tag) ?? [] }))
      .filter(g => g.items.length > 0);
  }, [sections]);

  if (sections.length === 0) {
    return <p className="ab-prep-empty">이 레벨의 대본 데이터가 없습니다.</p>;
  }

  if (grouped.length === 0) {
    return <p className="ab-prep-empty">섹션을 불러올 수 없습니다.</p>;
  }

  return (
    <div className="ab-prep">
      {recording?.micError && (
        <div className="ab-mic-error" role="alert">
          <span>{recording.micError}</span>
          <button type="button" className="ab-mic-error-dismiss" onClick={recording.dismissMicError} aria-label="닫기">
            <X size={16} aria-hidden/>
          </button>
        </div>
      )}
      {grouped.map(({ stage, items }) => (
        <div key={stage.tag} className="ab-prep-stage">
          <h3 className="ab-prep-stage-title">{stage.label}</h3>
          {items.map(({ sec, idx }) => {
            const isOpen = openSections.has(idx);
            return (
              <div key={idx} className={`ab-accordion${isOpen ? " open" : ""}`}>
                <button
                  type="button"
                  className="ab-accordion-trigger"
                  onClick={() => onToggle(idx)}
                  aria-expanded={isOpen}
                >
                  <div className="ab-accordion-head">
                    <span className={`ab-tag ab-tag--${sec.tagColor}`}>{sec.tagLabel}</span>
                    <span className="ab-accordion-time">{sec.time}</span>
                  </div>
                  <ChevronDown size={20} className="ab-accordion-chevron" aria-hidden/>
                </button>
                {isOpen && (
                  <div className="ab-accordion-body">
                    {sec.note ? <p className="ab-note ab-note--block">{sec.note}</p> : null}
                    <Dialogue
                      lines={sec.script}
                      tts={tts}
                      recording={recording}
                      enablePractice
                      lineKeyPrefix={`prep-${idx}-`}
                    />
                    <TipBox tip={sec.tip}/>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function ActivityPrepView({ gearScripts, levelId, openSections, onToggle, tts, recording }) {
  const { intro, activities, closing, introTagSuffix, activitiesOnly } = gearScripts;
  const introLines = useMemo(
    () => (intro?.script ? resolveActivityLines(intro.script, levelId) : []),
    [intro, levelId],
  );
  const closingLines = useMemo(
    () => (closing?.script ? resolveActivityLines(closing.script, levelId) : []),
    [closing, levelId],
  );

  return (
    <div className="ab-prep">
      {recording?.micError && (
        <div className="ab-mic-error" role="alert">
          <span>{recording.micError}</span>
          <button type="button" className="ab-mic-error-dismiss" onClick={recording.dismissMicError} aria-label="닫기">
            <X size={16} aria-hidden/>
          </button>
        </div>
      )}

      {!activitiesOnly && intro ? (
        <PrepAccordion
          sectionKey="intro"
          isOpen={openSections.has("intro")}
          onToggle={onToggle}
          head={(
            <div className="ab-accordion-head">
              <span className="ab-tag ab-tag--green">{intro.title} — {introTagSuffix}</span>
            </div>
          )}
        >
          <Dialogue
            lines={introLines}
            tts={tts}
            recording={recording}
            enablePractice
            lineKeyPrefix="prep-intro-"
          />
        </PrepAccordion>
      ) : null}

      {activities.map((activity, idx) => {
        const sectionKey = `activity-${idx}`;
        const isOpen = openSections.has(sectionKey);
        const lines = resolveActivityLines(activity.script, levelId);

        return (
          <PrepAccordion
            key={activity.id ?? idx}
            sectionKey={sectionKey}
            isOpen={isOpen}
            onToggle={onToggle}
            head={(
              <div className="ab-accordion-head">
                <span className="ab-tag">{activityTitleLabel(activity)}</span>
                <span className="ab-accordion-time">{activity.time}</span>
              </div>
            )}
          >
            {activity.titleEn ? <p className="ab-note ab-note--block">{activity.titleEn}</p> : null}
            <TransitionInBlock
              transitionIn={activity.transitionIn}
              levelId={levelId}
              tts={tts}
              recording={recording}
              enablePractice
              lineKeyPrefix={`prep-act-${idx}-`}
            />
            <Dialogue
              lines={lines}
              tts={tts}
              recording={recording}
              enablePractice
              lineKeyPrefix={`prep-act-${idx}-`}
            />
            <TipBox tip={activity.tip}/>
          </PrepAccordion>
        );
      })}

      {!activitiesOnly && closing ? (
        <PrepAccordion
          sectionKey="closing"
          isOpen={openSections.has("closing")}
          onToggle={onToggle}
          head={(
            <div className="ab-accordion-head">
              <span className="ab-tag ab-tag--amber">{closing.title}</span>
            </div>
          )}
        >
          <Dialogue
            lines={closingLines}
            tts={tts}
            recording={recording}
            enablePractice
            lineKeyPrefix="prep-closing-"
          />
        </PrepAccordion>
      ) : null}
    </div>
  );
}

function FieldCardView({ section, levelColor, tts, recording, sectionIndex }) {
  const enLines = section.script.filter(l => l.en && l.who === "teacher");
  const ttsText = enLines.map(l => l.text).join(" ");
  const allKey = `field-${sectionIndex}`;

  const handleListen = () => {
    if (ttsText) {
      recording?.stopPlayback?.();
      tts.toggle(ttsText, allKey);
    }
  };

  const listenLabel = tts.isLineLoading(allKey)
    ? "로딩..."
    : tts.isLinePlaying(allKey)
      ? "정지"
      : "듣기";

  return (
    <div className="ab-field-card">
      {recording?.micError ? (
        <div className="ab-mic-error" role="alert">
          <span>{recording.micError}</span>
          <button type="button" className="ab-mic-error-dismiss" onClick={recording.dismissMicError} aria-label="닫기">
            <X size={16} aria-hidden/>
          </button>
        </div>
      ) : null}
      <div className="ab-field-card-top">
        <SectionMeta section={section}/>
        {enLines.length > 0 && (
          <button
            type="button"
            className={`ab-listen-btn${tts.isLineLoading(allKey) ? " ab-listen-btn--loading" : ""}${tts.isLinePlaying(allKey) ? " ab-listen-btn--playing" : ""}`}
            onClick={handleListen}
            style={{ borderColor: levelColor, color: levelColor }}
            aria-busy={tts.isLineLoading(allKey)}
          >
            {tts.isLineLoading(allKey)
              ? <Loader2 size={16} className="ab-listen-spin" aria-hidden/>
              : <Volume2 size={16} aria-hidden/>}
            {listenLabel}
          </button>
        )}
      </div>
      <Dialogue
        lines={section.script}
        compact
        tts={tts}
        recording={recording}
        enablePractice
        lineKeyPrefix={`field-${sectionIndex}-`}
      />
      <TipBox tip={section.tip}/>
    </div>
  );
}

function ActivityCardLines({ lines, levelColor, tts, recording, lineKeyPrefix }) {
  if (!lines?.length) return null;

  return (
    <ul className="ab-card-lines">
      {lines.map((text, i) => {
        const lineKey = `${lineKeyPrefix}${i}`;
        return (
          <li key={i} className="ab-card-line">
            <span className="ab-card-line-num" style={{ background: levelColor }}>{i + 1}</span>
            <div className="ab-card-line-body">
              <p className="ab-card-line-text">{text}</p>
              <LinePracticeControls
                text={text}
                lineKey={lineKey}
                tts={tts}
                recording={recording}
                iconSize={12}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function CardLinesActivityFieldCardView({ activity, levelId, levelColor, tts, recording, activityIndex }) {
  const lines = useMemo(
    () => activity.cardLines?.[levelId] ?? [],
    [activity.cardLines, levelId],
  );
  const lineKeyPrefix = `field-cards-${activityIndex}-`;

  return (
    <div className="ab-field-card ab-field-card--card-lines">
      {recording?.micError ? (
        <div className="ab-mic-error" role="alert">
          <span>{recording.micError}</span>
          <button type="button" className="ab-mic-error-dismiss" onClick={recording.dismissMicError} aria-label="닫기">
            <X size={16} aria-hidden/>
          </button>
        </div>
      ) : null}
      <div className="ab-field-card-top">
        <ActivityMeta activity={activity} showTheme={false}/>
      </div>
      <ActivityCardLines
        lines={lines}
        levelColor={levelColor}
        tts={tts}
        recording={recording}
        lineKeyPrefix={lineKeyPrefix}
      />
      {activity.tip ? (
        <p className="ab-card-lines-tip">{activity.tip}</p>
      ) : null}
    </div>
  );
}

function ActivityFieldCardView({ activity, levelId, levelColor, tts, recording, activityIndex }) {
  const lines = useMemo(
    () => resolveActivityLines(activity.script, levelId),
    [activity.script, levelId],
  );
  const transitionLine = useMemo(
    () => resolveTransitionLine(activity.transitionIn, levelId),
    [activity.transitionIn, levelId],
  );
  const allLines = useMemo(
    () => (transitionLine ? [transitionLine, ...lines] : lines),
    [transitionLine, lines],
  );
  const enLines = allLines.filter(l => l.en && l.who === "teacher");
  const ttsText = enLines.map(l => l.text).join(" ");
  const allKey = `field-act-${activityIndex}`;

  const handleListen = () => {
    if (ttsText) {
      recording?.stopPlayback?.();
      tts.toggle(ttsText, allKey);
    }
  };

  const listenLabel = tts.isLineLoading(allKey)
    ? "로딩..."
    : tts.isLinePlaying(allKey)
      ? "정지"
      : "듣기";

  return (
    <div className="ab-field-card">
      {recording?.micError ? (
        <div className="ab-mic-error" role="alert">
          <span>{recording.micError}</span>
          <button type="button" className="ab-mic-error-dismiss" onClick={recording.dismissMicError} aria-label="닫기">
            <X size={16} aria-hidden/>
          </button>
        </div>
      ) : null}
      <div className="ab-field-card-top">
        <ActivityMeta activity={activity}/>
        {enLines.length > 0 && (
          <button
            type="button"
            className={`ab-listen-btn${tts.isLineLoading(allKey) ? " ab-listen-btn--loading" : ""}${tts.isLinePlaying(allKey) ? " ab-listen-btn--playing" : ""}`}
            onClick={handleListen}
            style={{ borderColor: levelColor, color: levelColor }}
            aria-busy={tts.isLineLoading(allKey)}
          >
            {tts.isLineLoading(allKey)
              ? <Loader2 size={16} className="ab-listen-spin" aria-hidden/>
              : <Volume2 size={16} aria-hidden/>}
            {listenLabel}
          </button>
        )}
      </div>
      <TransitionInBlock
        transitionIn={activity.transitionIn}
        levelId={levelId}
        tts={tts}
        recording={recording}
        enablePractice
        lineKeyPrefix={`field-act-${activityIndex}-`}
      />
      <Dialogue
        lines={lines}
        compact
        tts={tts}
        recording={recording}
        enablePractice
        lineKeyPrefix={`field-act-${activityIndex}-`}
      />
      <TipBox tip={activity.tip}/>
    </div>
  );
}

function ActivityIntroClosingCard({ section, levelId, levelColor, tts, recording, cardIndex, variant, introTagSuffix }) {
  const lines = useMemo(
    () => resolveActivityLines(section.script, levelId),
    [section.script, levelId],
  );
  const enLines = lines.filter(l => l.en && l.who === "teacher");
  const ttsText = enLines.map(l => l.text).join(" ");
  const allKey = `field-actgear-${variant}-${cardIndex}`;
  const tagClass = variant === "intro" ? "ab-tag--green" : "ab-tag--amber";
  const tagLabel = variant === "intro"
    ? `${section.title} — ${introTagSuffix}`
    : section.title;

  const handleListen = () => {
    if (ttsText) {
      recording?.stopPlayback?.();
      tts.toggle(ttsText, allKey);
    }
  };

  const listenLabel = tts.isLineLoading(allKey)
    ? "로딩..."
    : tts.isLinePlaying(allKey)
      ? "정지"
      : "듣기";

  return (
    <div className="ab-field-card">
      {recording?.micError ? (
        <div className="ab-mic-error" role="alert">
          <span>{recording.micError}</span>
          <button type="button" className="ab-mic-error-dismiss" onClick={recording.dismissMicError} aria-label="닫기">
            <X size={16} aria-hidden/>
          </button>
        </div>
      ) : null}
      <div className="ab-field-card-top">
        <div className="ab-section-meta">
          <span className={`ab-tag ${tagClass}`}>{tagLabel}</span>
        </div>
        {enLines.length > 0 && (
          <button
            type="button"
            className={`ab-listen-btn${tts.isLineLoading(allKey) ? " ab-listen-btn--loading" : ""}${tts.isLinePlaying(allKey) ? " ab-listen-btn--playing" : ""}`}
            onClick={handleListen}
            style={{ borderColor: levelColor, color: levelColor }}
            aria-busy={tts.isLineLoading(allKey)}
          >
            {tts.isLineLoading(allKey)
              ? <Loader2 size={16} className="ab-listen-spin" aria-hidden/>
              : <Volume2 size={16} aria-hidden/>}
            {listenLabel}
          </button>
        )}
      </div>
      <Dialogue
        lines={lines}
        compact
        tts={tts}
        recording={recording}
        enablePractice
        lineKeyPrefix={`field-actgear-${variant}-${cardIndex}-`}
      />
    </div>
  );
}

function ActivityScriptCardView({ card, levelId, levelColor, tts, recording, cardIndex, introTagSuffix }) {
  if (card.type === "activity") {
    if (card.data.cardLines) {
      return (
        <CardLinesActivityFieldCardView
          activity={card.data}
          levelId={levelId}
          levelColor={levelColor}
          tts={tts}
          recording={recording}
          activityIndex={cardIndex}
        />
      );
    }
    return (
      <ActivityFieldCardView
        activity={card.data}
        levelId={levelId}
        levelColor={levelColor}
        tts={tts}
        recording={recording}
        activityIndex={cardIndex}
      />
    );
  }

  return (
    <ActivityIntroClosingCard
      section={card.data}
      levelId={levelId}
      levelColor={levelColor}
      tts={tts}
      recording={recording}
      cardIndex={cardIndex}
      variant={card.type}
      introTagSuffix={introTagSuffix}
    />
  );
}

function parseEnglishScriptUrl(search) {
  const raw = search ?? (typeof window !== "undefined" ? window.location.search : "");
  const params = new URLSearchParams(raw.startsWith("?") ? raw.slice(1) : raw);
  const gear = params.get("gear");
  const validGear = getGearCatalog().some(g => g.id === gear) ? gear : null;
  const picker = params.get("picker") === "1";
  let screen = "gear-picker";
  if (validGear) screen = "script";
  else if (params.get("landing") === "1") screen = "landing";
  return {
    screen,
    gearId: validGear || "air-bridge",
    levelId: LEVEL_IDS.includes(params.get("level")) ? params.get("level") : LEVELS[0].id,
    mode: params.get("mode") === "field" ? "field" : "prep",
    cardIndex: Math.max(0, parseInt(params.get("card"), 10) || 0),
  };
}

function buildEnglishScriptUrl({ screen, gearId, levelId, mode, cardIndex }) {
  const params = new URLSearchParams();
  if (screen === "landing") {
    params.set("landing", "1");
  } else if (screen === "script") {
    params.set("gear", gearId);
    if (levelId !== LEVELS[0].id) params.set("level", levelId);
    if (mode === "field") params.set("mode", "field");
    if (cardIndex > 0) params.set("card", String(cardIndex));
  }
  const qs = params.toString();
  return `/english-script${qs ? `?${qs}` : ""}`;
}

function ScriptView({ gearId, onBack, onChangeGear, levelId, mode, cardIndex, onStateChange }) {
  const catalog = getGearCatalog();
  const gear = catalog.find(g => g.id === gearId) ?? catalog[0];
  const gearLevelIds = useMemo(() => getGearLevelIds(gearId), [gearId]);
  const visibleLevels = useMemo(
    () => LEVELS.filter(lv => gearLevelIds.includes(lv.id)),
    [gearLevelIds],
  );
  const isActivityGear = gear.type === "activities";
  const activityGearScripts = useMemo(
    () => (isActivityGear ? getActivityGearScripts(gearId) : null),
    [gearId, isActivityGear],
  );

  const [openSections, setOpenSections] = useState(() => new Set());
  const tts = useGoogleTts();
  const { stop: stopTts } = tts;
  const recording = useLineRecording();
  const { clearAll: clearRecording } = recording;

  const patchState = useCallback((patch) => {
    onStateChange?.(patch);
  }, [onStateChange]);

  const setLevelId = useCallback((id) => {
    patchState({ levelId: id, cardIndex: 0 });
  }, [patchState]);

  const setMode = useCallback((nextMode) => {
    patchState({ mode: nextMode });
  }, [patchState]);

  const setCardIndex = useCallback((next) => {
    const resolved = typeof next === "function" ? next(cardIndex) : next;
    patchState({ cardIndex: resolved });
  }, [patchState, cardIndex]);

  const level = useMemo(
    () => visibleLevels.find(l => l.id === levelId) ?? visibleLevels[0] ?? LEVELS[0],
    [levelId, visibleLevels],
  );

  useEffect(() => {
    if (!gearLevelIds.includes(levelId)) {
      patchState({ levelId: gearLevelIds[0], cardIndex: 0 });
    }
  }, [gearId, gearLevelIds, levelId, patchState]);

  const sections = useMemo(
    () => (isActivityGear ? [] : AIRBRIDGE_SCRIPTS[levelId] ?? []),
    [levelId, isActivityGear],
  );
  const activityCards = useMemo(
    () => (activityGearScripts ? buildActivityGearCards(activityGearScripts) : []),
    [activityGearScripts],
  );
  const itemCount = isActivityGear ? activityCards.length : sections.length;
  const currentSection = sections[cardIndex];
  const currentActivityCard = activityCards[cardIndex];
  const currentStageIdx = stageIndex(currentSection?.stage ?? "intro");

  useEffect(() => {
    if (isActivityGear && activityGearScripts) {
      const keys = activityGearScripts.activitiesOnly
        ? activityGearScripts.activities.map((_, i) => `activity-${i}`)
        : [
          ...(activityGearScripts.intro ? ["intro"] : []),
          ...activityGearScripts.activities.map((_, i) => `activity-${i}`),
          ...(activityGearScripts.closing ? ["closing"] : []),
        ];
      setOpenSections(new Set(keys));
    } else {
      setOpenSections(new Set(sections.map((_, i) => i)));
    }
    stopTts();
    clearRecording();
  }, [levelId, gearId, isActivityGear, activityGearScripts, sections.length, stopTts, clearRecording]);

  useEffect(() => {
    stopTts();
    clearRecording();
  }, [cardIndex, mode, stopTts, clearRecording]);

  const goPrev = useCallback(() => setCardIndex(i => Math.max(0, i - 1)), []);
  const goNext = useCallback(
    () => setCardIndex(i => Math.min(itemCount - 1, i + 1)),
    [itemCount],
  );

  const toggleSection = useCallback((idx) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  return (
    <div
      className="eng-script-app ab-script"
      style={{
        "--ab-level": level.color,
        "--ab-level-bg": level.bg,
      }}
    >
      <header className="eng-script-header">
        <button type="button" className="eng-script-back" onClick={onBack}>
          <ChevronLeft size={18} strokeWidth={2.5}/> 뒤로가기
        </button>
        <div className="eng-script-header-controls">
          <span className="ab-gear-label">{gear.label}</span>
          <button type="button" className="ab-change-gear-btn" onClick={onChangeGear}>
            교구 변경
          </button>
        </div>
      </header>

      <div className="eng-script-tabs ab-level-tabs">
        {visibleLevels.map(lv => (
          <button
            key={lv.id}
            type="button"
            className={`eng-script-tab ab-level-tab${levelId === lv.id ? " active" : ""}`}
            style={levelId === lv.id ? { borderColor: lv.color, background: lv.bg, color: lv.color } : undefined}
            onClick={() => setLevelId(lv.id)}
          >
            {lv.label}
          </button>
        ))}
      </div>

      <p className="ab-level-desc">{level.desc}</p>

      <div className="eng-script-mode-toggle">
        <button
          type="button"
          className={`eng-script-mode-btn${mode === "prep" ? " active" : ""}`}
          onClick={() => setMode("prep")}
        >
          예습
        </button>
        <button
          type="button"
          className={`eng-script-mode-btn${mode === "field" ? " active" : ""}`}
          onClick={() => setMode("field")}
        >
          현장 카드
        </button>
      </div>

      {mode === "field" && !isActivityGear && (
        <div className="eng-script-progress">
          {STAGES.map((stage, idx) => (
            <div
              key={stage.tag}
              className={`eng-script-progress-step${idx === currentStageIdx ? " current" : ""}${idx < currentStageIdx ? " done" : ""}`}
            >
              <div className="eng-script-progress-dot" style={idx === currentStageIdx ? { background: level.color } : undefined}>
                {idx + 1}
              </div>
              <span className="eng-script-progress-label">{stage.label}</span>
            </div>
          ))}
        </div>
      )}

      <main className={`eng-script-main${mode === "prep" ? " eng-script-main--prep" : ""}`}>
        {mode === "prep" ? (
          isActivityGear && activityGearScripts ? (
            <ActivityPrepView
              gearScripts={activityGearScripts}
              levelId={levelId}
              openSections={openSections}
              onToggle={toggleSection}
              tts={tts}
              recording={recording}
            />
          ) : (
            <PrepView
              sections={sections}
              openSections={openSections}
              onToggle={toggleSection}
              tts={tts}
              recording={recording}
            />
          )
        ) : isActivityGear && currentActivityCard && activityGearScripts ? (
          <ActivityScriptCardView
            card={currentActivityCard}
            levelId={levelId}
            levelColor={level.color}
            tts={tts}
            recording={recording}
            cardIndex={cardIndex}
            introTagSuffix={activityGearScripts.introTagSuffix}
          />
        ) : !isActivityGear && currentSection ? (
          <FieldCardView
            section={currentSection}
            levelColor={level.color}
            tts={tts}
            recording={recording}
            sectionIndex={cardIndex}
          />
        ) : null}
      </main>

      {mode === "field" && (
        <footer className="eng-script-footer">
          <div className="ab-card-counter">
            {cardIndex + 1} / {itemCount}
            <span className="ab-card-counter-label">
              {isActivityGear && activityGearScripts
                ? activityGearCardLabel(currentActivityCard, activityGearScripts.introTagSuffix)
                : currentSection?.tagLabel}
            </span>
          </div>
          <div className="eng-script-nav">
            <button type="button" className="eng-script-nav-btn" onClick={goPrev} disabled={cardIndex === 0}>
              <ChevronLeft size={18}/> 이전
            </button>
            <button
              type="button"
              className="eng-script-nav-btn eng-script-nav-btn-primary"
              onClick={goNext}
              disabled={cardIndex >= itemCount - 1}
              style={{ background: level.color, borderColor: level.color }}
            >
              다음 <ChevronRight size={18}/>
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}

export default function EnglishScriptApp({ onBack, onGoMain, onGoSituations, onGoChildTypes, onGoFlowTips, onGoPronunciationTips, me }) {
  const location = useLocation();
  const navigate = useNavigate();
  const handleProgramNavigate = useEnglishProgramNavigate();
  const [catalogReady, setCatalogReady] = useState(false);

  useEffect(() => {
    initGearScriptEntries()
      .finally(() => setCatalogReady(true));
  }, []);

  const urlState = useMemo(
    () => parseEnglishScriptUrl(location.search),
    [location.search, catalogReady],
  );

  const pushUrl = useCallback((patch, usePush = false) => {
    const next = { ...urlState, ...patch };
    const path = buildEnglishScriptUrl(next);
    navigate(path, { replace: !usePush });
  }, [urlState, navigate]);

  const { screen, gearId, levelId, mode, cardIndex } = urlState;

  if (!catalogReady && new URLSearchParams(location.search).get("gear")) {
    return (
      <div className="eng-lib-loading" style={{ minHeight: "40vh" }}>
        <Loader2 size={28} className="ab-listen-spin" aria-hidden/>
        <p>대본 불러오는 중...</p>
      </div>
    );
  }

  if (screen === "script") {
    return (
      <ScriptView
        gearId={gearId}
        levelId={levelId}
        mode={mode}
        cardIndex={cardIndex}
        onStateChange={patch => pushUrl(patch)}
        onBack={() => pushUrl({ screen: "gear-picker" })}
        onChangeGear={() => pushUrl({ screen: "gear-picker" })}
      />
    );
  }

  if (screen === "gear-picker") {
    return (
      <GearScriptLibraryView
        me={me}
        onBack={onBack}
        onGoMain={onGoMain}
        onSelect={(id) => pushUrl({
          screen: "script",
          gearId: id,
          levelId: LEVELS[0].id,
          mode: "prep",
          cardIndex: 0,
        })}
        onNavigate={handleProgramNavigate}
      />
    );
  }

  if (screen === "landing") {
    return (
      <LandingView
        onBack={onBack}
        onGoMain={onGoMain}
        onNavigate={handleProgramNavigate}
        onStartScript={() => pushUrl({ screen: "gear-picker" })}
        onGoSituations={onGoSituations ?? (() => navigate("/situation-manual"))}
        onGoChildTypes={onGoChildTypes ?? (() => navigate("/child-types"))}
        onGoFlowTips={onGoFlowTips ?? (() => navigate("/class-flow-tips"))}
        onGoPronunciationTips={onGoPronunciationTips ?? (() => navigate("/pronunciation-tips"))}
      />
    );
  }

  return (
    <GearScriptLibraryView
      me={me}
      onBack={onBack}
      onGoMain={onGoMain}
      onSelect={(id) => pushUrl({
        screen: "script",
        gearId: id,
        levelId: LEVELS[0].id,
        mode: "prep",
        cardIndex: 0,
      })}
      onNavigate={handleProgramNavigate}
    />
  );
}
