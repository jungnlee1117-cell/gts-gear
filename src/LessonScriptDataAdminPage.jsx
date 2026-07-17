import { useMemo, useState } from "react";
import { ChevronLeft, Database, Plus, RotateCcw, Sparkles, Upload } from "lucide-react";
import { PE_ADMIN } from "./peMedia/peMediaUtils.js";
import { getGearCatalog } from "./gearScriptMeta.js";
import { LESSON_SCRIPT_LEVELS } from "./lessonScriptDataDefaults.js";
import {
  createSlugId,
} from "./lessonScriptDataTypes.js";
import {
  clearRemoteAdminData,
  getLocalMigrationSummary,
  hasLocalLessonScriptData,
  migrateLocalStorageToSupabase,
} from "./lessonScriptDataMigration.js";
import {
  deleteClosingActivity,
  deleteClosingVariant,
  deleteGameActivity,
  deleteGameVariant,
  deleteGearLessonOverride,
  deleteWarmupActivity,
  deleteWarmupActivityVariant,
  deleteWarmupSet,
  deleteWarmupSetVariant,
  getAdminPatchSummary,
  getClosingActivities,
  getClosingVariantsMap,
  getGameActivities,
  getGameVariantsMap,
  getGearLessonOverrideText,
  getGearLessonOverrideMeta,
  getWarmupActivities,
  getWarmupActivityVariantsMap,
  getWarmupSets,
  saveClosingActivity,
  saveClosingVariant,
  saveGameActivity,
  saveGameVariant,
  saveGearLessonOverride,
  saveWarmupActivity,
  saveWarmupActivityVariant,
  saveWarmupSet,
  saveWarmupSetVariant,
} from "./lessonScriptDataRepository.js";
import {
  AdminModal,
  ActivityContentEditor,
  ActivityMetaEditor,
  ItemListRow,
  normalizeVariantBlock,
  validateVariantBlock,
  VariantBlockEditor,
} from "./LessonScriptDataAdminForms.jsx";
import { useLessonScriptAdminData } from "./useLessonScriptData.js";
import LessonScriptAiGenerateModal from "./LessonScriptAiGenerateModal.jsx";
import {
  AI_ACTIVITY_TYPES,
  aiResultToActivityRecord,
  aiResultToSafetyBlock,
  aiResultToVariantBlock,
} from "./lessonScriptAiTypes.js";

const TABS = [
  { id: "warmup-sets", label: "인사 & 워밍업 세트" },
  { id: "warmup-activities", label: "준비운동 대본" },
  { id: "gear-lessons", label: "교구 수업 대본" },
  { id: "games", label: "게임 활동 대본" },
  { id: "closings", label: "마무리 인사" },
];

const SOURCE_LABELS = {
  supabase: "Supabase",
  local: "localStorage (오프라인)",
  defaults: "기본값",
};

export default function LessonScriptDataAdminPage({ me, onBack }) {
  const allowed = PE_ADMIN(me);
  const userId = me?.id;
  const { ready, refresh, version } = useLessonScriptAdminData();
  const [activeTab, setActiveTab] = useState(TABS[0].id);
  const [modal, setModal] = useState(null);
  const [aiModal, setAiModal] = useState(null);
  const [migrating, setMigrating] = useState(false);
  const [saving, setSaving] = useState(false);
  const migrationSummary = useMemo(() => getLocalMigrationSummary(), [version]);

  const summary = useMemo(() => getAdminPatchSummary(), [version]);
  const warmupSets = useMemo(() => getWarmupSets(), [version]);
  const warmupActivities = useMemo(() => getWarmupActivities(), [version]);
  const warmupActivityVariants = useMemo(() => getWarmupActivityVariantsMap(), [version]);
  const games = useMemo(() => getGameActivities(), [version]);
  const gameVariants = useMemo(() => getGameVariantsMap(), [version]);
  const closings = useMemo(() => getClosingActivities(), [version]);
  const closingVariants = useMemo(() => getClosingVariantsMap(), [version]);
  const closeModal = () => setModal(null);

  const openAiGenerate = (activityType, gearContext = null) => {
    setAiModal({ activityType, gearContext });
  };

  const handleAiApply = (result) => {
    const ctx = aiModal;
    setAiModal(null);
    const block = normalizeVariantBlock(aiResultToVariantBlock(result));

    if (ctx?.activityType === AI_ACTIVITY_TYPES.GEAR && ctx.gearContext) {
      setModal({
        type: "gear-lesson",
        gearId: ctx.gearContext.gearId,
        gearLabel: ctx.gearContext.gearLabel,
        levelId: ctx.gearContext.levelId,
        levelLabel: ctx.gearContext.levelLabel,
        text: result.gearLessonText || "",
        meta: result.meta,
      });
      return;
    }

    const isGame = ctx?.activityType === AI_ACTIVITY_TYPES.GAME;
    const record = aiResultToActivityRecord(result, "");
    record.meta = {
      ...record.meta,
      safetyMemo: aiResultToSafetyBlock(result),
    };
    setModal({
      type: isGame ? "game" : "warmup-activity",
      record,
      block,
    });
  };

  const metaSubtitle = (meta) => {
    if (!meta) return null;
    const parts = [];
    if (meta.recommendedAge) parts.push(meta.recommendedAge);
    if (meta.recommendedDuration) parts.push(meta.recommendedDuration);
    if (meta.energyLevel) parts.push(`에너지 ${meta.energyLevel}`);
    return parts.length ? parts.join(" · ") : null;
  };

  const activitySubtitle = (item) => {
    const parts = [
      item.title_en,
      item.duration_minutes ? `${item.duration_minutes}분` : null,
      item.materials ? `준비물 ${item.materials}` : null,
    ].filter(Boolean);
    return parts.length ? parts.join(" · ") : metaSubtitle(item.meta);
  };

  const runMutation = async (fn) => {
    if (!userId) {
      alert("로그인이 필요합니다.");
      return;
    }
    try {
      await fn(userId);
      await refresh();
    } catch (err) {
      alert(err?.message || "작업에 실패했습니다.");
    }
  };

  const handleResetAll = async () => {
    if (!summary.hasData) return;
    if (!confirm("저장된 관리자 데이터를 모두 삭제하고 기본값으로 되돌릴까요?")) return;
    try {
      await clearRemoteAdminData();
      await refresh();
    } catch (err) {
      alert(err?.message || "초기화에 실패했습니다.");
    }
  };

  const handleMigrate = async () => {
    if (!userId) {
      alert("로그인이 필요합니다.");
      return;
    }
    if (!hasLocalLessonScriptData()) {
      alert("이전할 localStorage 데이터가 없습니다.");
      return;
    }
    if (!confirm("localStorage의 관리자 데이터와 저장 대본을 Supabase로 옮길까요?")) return;

    setMigrating(true);
    try {
      const result = await migrateLocalStorageToSupabase(userId);
      if (result.errors.length) {
        alert(`일부 항목 이전 실패:\n${result.errors.join("\n")}`);
      } else {
        alert(`이전 완료: 관리자 컬렉션 ${result.adminCollections}개, 저장 대본 ${result.savedLessons}개`);
      }
      await refresh();
    } catch (err) {
      alert(err?.message || "마이그레이션에 실패했습니다.");
    } finally {
      setMigrating(false);
    }
  };

  const renderWarmupSets = () => (
    <section className="lsda-panel">
      <div className="lsda-panel__head">
        <h2>인사 & 워밍업 세트</h2>
        <button
          type="button"
          className="lsda-btn lsda-btn--primary lsda-btn--sm"
          onClick={() => setModal({
            type: "warmup-set",
            record: {
              id: "",
              label: "",
              desc: "",
              title: "",
              title_en: "",
              stage: "warmup-set",
              duration_minutes: 5,
              materials: "",
              script: "",
            },
            block: { label: "", default: { easy: "", medium: "", hard: "" }, alternatives: [] },
          })}
        >
          <Plus size={14}/>
          세트 추가
        </button>
      </div>
      <ul className="lsda-list">
        {warmupSets.map(set => (
          <ItemListRow
            key={set.id}
            title={set.label}
            subtitle={[set.desc, set.duration_minutes ? `${set.duration_minutes}분` : null].filter(Boolean).join(" · ")}
            badges={[set.id]}
            onEdit={() => setModal({
              type: "warmup-set",
              record: { ...set },
              block: normalizeVariantBlock({
                label: set.label,
                default: set.script
                  ? { easy: set.script, medium: set.script, hard: set.script }
                  : { easy: "", medium: "", hard: "" },
                alternatives: [],
              }),
            })}
            onDelete={async () => {
              if (!confirm(`「${set.label}」 세트를 삭제할까요?`)) return;
              await runMutation(async (uid) => {
                await deleteWarmupSet(set.id, uid);
                await deleteWarmupSetVariant(set.id, uid);
              });
            }}
          />
        ))}
      </ul>
    </section>
  );

  const renderWarmupActivities = () => (
    <section className="lsda-panel">
      <div className="lsda-panel__head">
        <h2>준비운동 대본</h2>
        <div className="lsda-panel__actions">
          <button
            type="button"
            className="lsda-btn lsda-btn--ghost lsda-btn--sm"
            onClick={() => openAiGenerate(AI_ACTIVITY_TYPES.WARMUP)}
          >
            <Sparkles size={14}/>
            AI로 생성
          </button>
          <button
            type="button"
            className="lsda-btn lsda-btn--primary lsda-btn--sm"
            onClick={() => setModal({
              type: "warmup-activity",
              record: { id: "", label: "", title: "", title_en: "", stage: "warmup", space_requirement: "none", duration_minutes: null, materials: "", script: "", meta: {} },
              block: { label: "", default: { easy: "", medium: "", hard: "" }, alternatives: [] },
            })}
          >
            <Plus size={14}/>
            직접 추가
          </button>
        </div>
      </div>
      <ul className="lsda-list">
        {warmupActivities.map(item => {
          const block = warmupActivityVariants[item.id];
          return (
            <ItemListRow
              key={item.id}
              title={item.label}
              subtitle={activitySubtitle(item) || (block ? `대체 멘트 ${block.alternatives?.length || 0}개` : "대본 미등록 (placeholder 사용)")}
              badges={[item.id, item.space_requirement || null].filter(Boolean)}
              onEdit={() => setModal({
                type: "warmup-activity",
                record: { ...item, meta: item.meta || {} },
                block: normalizeVariantBlock(block || { label: item.label, default: { easy: "", medium: "", hard: "" }, alternatives: [] }),
              })}
              onDelete={async () => {
                if (!confirm(`「${item.label}」 준비운동을 삭제할까요?`)) return;
                await runMutation(async (uid) => {
                  await deleteWarmupActivity(item.id, uid);
                  await deleteWarmupActivityVariant(item.id, uid);
                });
              }}
            />
          );
        })}
      </ul>
    </section>
  );

  const renderGearLessons = () => (
    <section className="lsda-panel">
      <div className="lsda-panel__head">
        <h2>교구 수업 대본 오버라이드</h2>
        <div className="lsda-panel__actions">
          <button
            type="button"
            className="lsda-btn lsda-btn--ghost lsda-btn--sm"
            onClick={() => openAiGenerate(AI_ACTIVITY_TYPES.GEAR)}
          >
            <Sparkles size={14}/>
            AI로 생성
          </button>
        </div>
        <p className="lsda-muted">코드 기본 대본 대신 관리자가 입력한 전체 텍스트를 사용합니다.</p>
      </div>
      <ul className="lsda-list">
        {getGearCatalog().map(gear => (
          LESSON_SCRIPT_LEVELS.map(level => {
            const override = getGearLessonOverrideText(gear.id, level.id);
            return (
              <ItemListRow
                key={`${gear.id}-${level.id}`}
                title={`${gear.label} · ${level.label}`}
                subtitle={override ? "관리자 대본 적용 중" : "코드 기본 대본 사용"}
                badges={override ? ["오버라이드"] : ["기본값"]}
                onEdit={() => setModal({
                  type: "gear-lesson",
                  gearId: gear.id,
                  gearLabel: gear.label,
                  levelId: level.id,
                  levelLabel: level.label,
                  text: override || "",
                  meta: getGearLessonOverrideMeta(gear.id, level.id) || {},
                })}
                onAi={() => openAiGenerate(AI_ACTIVITY_TYPES.GEAR, {
                  gearId: gear.id,
                  gearLabel: gear.label,
                  levelId: level.id,
                  levelLabel: level.label,
                })}
                onDelete={override ? async () => {
                  if (!confirm("오버라이드를 삭제하고 코드 기본 대본으로 되돌릴까요?")) return;
                  await runMutation(uid => deleteGearLessonOverride(gear.id, level.id, uid));
                } : null}
                deleteLabel="오버라이드 해제"
              />
            );
          })
        ))}
      </ul>
    </section>
  );

  const renderGames = () => (
    <section className="lsda-panel">
      <div className="lsda-panel__head">
        <h2>게임 활동 대본</h2>
        <div className="lsda-panel__actions">
          <button
            type="button"
            className="lsda-btn lsda-btn--ghost lsda-btn--sm"
            onClick={() => openAiGenerate(AI_ACTIVITY_TYPES.GAME)}
          >
            <Sparkles size={14}/>
            AI로 생성
          </button>
          <button
            type="button"
            className="lsda-btn lsda-btn--primary lsda-btn--sm"
            onClick={() => setModal({
              type: "game",
              record: { id: "", label: "", title: "", title_en: "", stage: "game", difficulty: "medium", duration_minutes: null, materials: "", script: "", meta: {} },
              block: { label: "", default: { easy: "", medium: "", hard: "" }, alternatives: [] },
            })}
          >
            <Plus size={14}/>
            직접 추가
          </button>
        </div>
      </div>
      <ul className="lsda-list">
        {games.map(item => {
          const block = gameVariants[item.id];
          return (
            <ItemListRow
              key={item.id}
              title={item.label}
              subtitle={activitySubtitle(item) || (block ? `대체 멘트 ${block.alternatives?.length || 0}개` : "대본 미등록 (placeholder 사용)")}
              badges={[item.id, item.difficulty || null].filter(Boolean)}
              onEdit={() => setModal({
                type: "game",
                record: { ...item, meta: item.meta || {} },
                block: normalizeVariantBlock(block || { label: item.label, default: { easy: "", medium: "", hard: "" }, alternatives: [] }),
              })}
              onDelete={async () => {
                if (!confirm(`「${item.label}」 게임을 삭제할까요?`)) return;
                await runMutation(async (uid) => {
                  await deleteGameActivity(item.id, uid);
                  await deleteGameVariant(item.id, uid);
                });
              }}
            />
          );
        })}
      </ul>
    </section>
  );

  const renderClosings = () => (
    <section className="lsda-panel">
      <div className="lsda-panel__head">
        <h2>마무리 인사</h2>
        <div className="lsda-panel__actions">
          <button
            type="button"
            className="lsda-btn lsda-btn--primary lsda-btn--sm"
            onClick={() => setModal({
              type: "closing",
              record: { id: "", label: "", title: "", title_en: "", stage: "closing", duration_minutes: 5, materials: "", script: "", meta: {} },
              block: { label: "", default: { easy: "", medium: "", hard: "" }, alternatives: [] },
            })}
          >
            <Plus size={14}/>
            직접 추가
          </button>
        </div>
      </div>
      <ul className="lsda-list">
        {closings.map(item => {
          const block = closingVariants[item.id];
          return (
            <ItemListRow
              key={item.id}
              title={item.label}
              subtitle={activitySubtitle(item) || (block ? `대체 멘트 ${block.alternatives?.length || 0}개` : "대본 미등록")}
              badges={[item.id].filter(Boolean)}
              onEdit={() => setModal({
                type: "closing",
                record: { ...item, meta: item.meta || {} },
                block: normalizeVariantBlock(block || { label: item.label, default: { easy: "", medium: "", hard: "" }, alternatives: [] }),
              })}
              onDelete={async () => {
                if (!confirm(`「${item.label}」 마무리 인사를 삭제할까요?`)) return;
                await runMutation(async (uid) => {
                  await deleteClosingActivity(item.id, uid);
                  await deleteClosingVariant(item.id, uid);
                });
              }}
            />
          );
        })}
      </ul>
    </section>
  );

  const saveModal = async () => {
    if (!modal) return;
    if (!userId) {
      alert("로그인이 필요합니다.");
      return;
    }

    setSaving(true);
    try {
      if (modal.type === "warmup-set") {
        const record = {
          ...modal.record,
          title: modal.record.label,
          stage: "warmup-set",
        };
        if (!record.label?.trim()) return alert("세트 이름을 입력해 주세요.");
        if (!record.id) record.id = createSlugId(record.label);
        if (!record.script?.trim()) return alert("대본 텍스트를 입력해 주세요.");
        const block = normalizeVariantBlock({
          ...modal.block,
          label: record.label,
          default: {
            easy: record.script.trim(),
            medium: record.script.trim(),
            hard: record.script.trim(),
          },
        });
        await saveWarmupSet(record, userId);
        await saveWarmupSetVariant(record.id, block, userId);
      }

      if (modal.type === "warmup-activity") {
        const record = {
          ...modal.record,
          title: modal.record.label,
          stage: "warmup",
          meta: modal.record.meta || {},
        };
        if (!record.label?.trim()) return alert("준비운동 이름을 입력해 주세요.");
        if (!record.id) record.id = createSlugId(record.label);
        const block = normalizeVariantBlock({
          ...modal.block,
          label: record.label,
          default: record.script?.trim()
            ? { easy: record.script.trim(), medium: record.script.trim(), hard: record.script.trim() }
            : modal.block.default,
        });
        const err = validateVariantBlock(block);
        if (err) return alert(err);
        await saveWarmupActivity(record, userId);
        await saveWarmupActivityVariant(record.id, block, userId);
      }

      if (modal.type === "gear-lesson") {
        await saveGearLessonOverride(modal.gearId, modal.levelId, modal.text || "", userId, modal.meta || null);
      }

      if (modal.type === "game") {
        const record = {
          ...modal.record,
          title: modal.record.label,
          stage: "game",
          meta: modal.record.meta || {},
        };
        if (!record.label?.trim()) return alert("게임 이름을 입력해 주세요.");
        if (!record.id) record.id = createSlugId(record.label);
        const block = normalizeVariantBlock({
          ...modal.block,
          label: record.label,
          default: record.script?.trim()
            ? { easy: record.script.trim(), medium: record.script.trim(), hard: record.script.trim() }
            : modal.block.default,
        });
        const err = validateVariantBlock(block);
        if (err) return alert(err);
        await saveGameActivity(record, userId);
        await saveGameVariant(record.id, block, userId);
      }

      if (modal.type === "closing") {
        const record = {
          ...modal.record,
          title: modal.record.label,
          stage: "closing",
          meta: modal.record.meta || {},
        };
        if (!record.label?.trim()) return alert("마무리 인사 이름을 입력해 주세요.");
        if (!record.id) record.id = createSlugId(record.label);
        const block = normalizeVariantBlock({
          ...modal.block,
          label: record.label,
          default: record.script?.trim()
            ? { easy: record.script.trim(), medium: record.script.trim(), hard: record.script.trim() }
            : modal.block.default,
        });
        const err = validateVariantBlock(block);
        if (err) return alert(err);
        await saveClosingActivity(record, userId);
        await saveClosingVariant(record.id, block, userId);
      }

      closeModal();
      await refresh();
    } catch (err) {
      alert(err?.message || "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const renderModal = () => {
    if (!modal) return null;

    if (modal.type === "warmup-set") {
      return (
        <AdminModal title={modal.record.id ? "워밍업 세트 수정" : "워밍업 세트 추가"} onClose={closeModal} onSave={saveModal} saving={saving} wide>
          <label className="lsda-field">
            <span>세트 ID</span>
            <input className="lsda-input" value={modal.record.id} disabled={!!modal.record.id} onChange={e => setModal({ ...modal, record: { ...modal.record, id: e.target.value } })}/>
          </label>
          <label className="lsda-field">
            <span>세트 이름</span>
            <input className="lsda-input" value={modal.record.label} onChange={e => setModal({ ...modal, record: { ...modal.record, label: e.target.value } })}/>
          </label>
          <label className="lsda-field">
            <span>설명</span>
            <input className="lsda-input" value={modal.record.desc || ""} onChange={e => setModal({ ...modal, record: { ...modal.record, desc: e.target.value } })}/>
          </label>
          <ActivityContentEditor
            value={modal.record}
            isClosing
            stageLabel="warmup-set"
            onChange={record => setModal({ ...modal, record: { ...record, stage: "warmup-set" } })}
          />
        </AdminModal>
      );
    }

    if (modal.type === "warmup-activity" || modal.type === "game" || modal.type === "closing") {
      const isGame = modal.type === "game";
      const isClosing = modal.type === "closing";
      const title = isClosing ? "마무리 인사 대본" : isGame ? "게임 활동 대본" : "준비운동 대본";
      return (
        <AdminModal title={title} onClose={closeModal} onSave={saveModal} saving={saving} wide>
          <label className="lsda-field">
            <span>{isClosing ? "마무리 인사" : isGame ? "게임" : "준비운동"} ID</span>
            <input className="lsda-input" value={modal.record.id} disabled={!!modal.record.id} onChange={e => setModal({ ...modal, record: { ...modal.record, id: e.target.value } })}/>
          </label>
          <label className="lsda-field">
            <span>표시 이름</span>
            <input className="lsda-input" value={modal.record.label} onChange={e => setModal({ ...modal, record: { ...modal.record, label: e.target.value } })}/>
          </label>
          <ActivityContentEditor
            value={modal.record}
            isGame={isGame}
            isClosing={isClosing}
            onChange={record => setModal({ ...modal, record })}
          />
          {!isClosing ? (
            <ActivityMetaEditor
              value={modal.record.meta}
              onChange={meta => setModal({ ...modal, record: { ...modal.record, meta } })}
            />
          ) : null}
          <VariantBlockEditor value={modal.block} onChange={block => setModal({ ...modal, block })}/>
          {!isClosing && modal.record.meta?.safetyMemo ? (
            <section className="lsda-ai-section">
              <h4>안전 멘트 (메타 저장)</h4>
              <VariantBlockEditor
                value={modal.record.meta.safetyMemo}
                onChange={safetyMemo => setModal({
                  ...modal,
                  record: { ...modal.record, meta: { ...modal.record.meta, safetyMemo } },
                })}
              />
            </section>
          ) : null}
        </AdminModal>
      );
    }

    if (modal.type === "gear-lesson") {
      return (
        <AdminModal title={`${modal.gearLabel} · ${modal.levelLabel}`} onClose={closeModal} onSave={saveModal} saving={saving} wide>
          <p className="lsda-muted">비우고 저장하면 코드 기본 대본을 사용합니다.</p>
          <ActivityMetaEditor
            value={modal.meta}
            onChange={meta => setModal({ ...modal, meta })}
          />
          <label className="lsda-field">
            <span>전체 대본 텍스트</span>
            <textarea
              className="lsda-textarea lsda-textarea--tall"
              rows={16}
              value={modal.text}
              onChange={e => setModal({ ...modal, text: e.target.value })}
            />
          </label>
        </AdminModal>
      );
    }

    return null;
  };

  const tabContent = {
    "warmup-sets": renderWarmupSets,
    "warmup-activities": renderWarmupActivities,
    "gear-lessons": renderGearLessons,
    games: renderGames,
    closings: renderClosings,
  }[activeTab]?.();

  if (!allowed) {
    return (
      <div className="lsda-page">
        <button type="button" className="lsda-back" onClick={onBack}>
          <ChevronLeft size={18}/>
          돌아가기
        </button>
        <p className="lsda-denied">접근 권한이 없습니다. 관리자만 데이터를 편집할 수 있습니다.</p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="lsda-page">
        <button type="button" className="lsda-back" onClick={onBack}>
          <ChevronLeft size={18}/>
          돌아가기
        </button>
        <p className="lsda-muted">데이터를 불러오는 중…</p>
      </div>
    );
  }

  return (
    <div className="lsda-page">
      <header className="lsda-header">
        <button type="button" className="lsda-back" onClick={onBack}>
          <ChevronLeft size={18}/>
          돌아가기
        </button>
        <div>
          <h1 className="lsda-header__title">
            <Database size={20}/>
            수업 대본 데이터 관리
          </h1>
          <p className="lsda-header__desc">
            Supabase 공유 저장 · 기본값은 `lessonScriptDataDefaults.js` · 오프라인 시 localStorage fallback
          </p>
        </div>
        <div className="lsda-header__actions">
          {hasLocalLessonScriptData() && !migrationSummary.migrated ? (
            <button type="button" className="lsda-btn lsda-btn--primary lsda-btn--sm" onClick={handleMigrate} disabled={migrating}>
              <Upload size={14}/>
              {migrating ? "이전 중…" : "localStorage → Supabase"}
            </button>
          ) : null}
          <button type="button" className="lsda-btn lsda-btn--ghost" onClick={handleResetAll} disabled={!summary.hasData}>
            <RotateCcw size={14}/>
            전체 초기화
          </button>
        </div>
      </header>

      {summary.hasData ? (
        <p className="lsda-summary">
          관리자 데이터 적용 중 ({SOURCE_LABELS[summary.source] || summary.source})
          {" · "}마지막 저장 {summary.updatedAt ? new Date(summary.updatedAt).toLocaleString("ko-KR") : "-"}
          {" · "}수정 컬렉션 {summary.collections.length}개
        </p>
      ) : (
        <p className="lsda-summary lsda-summary--muted">
          현재 번들 기본 데이터를 사용 중입니다 ({SOURCE_LABELS[summary.source] || summary.source})
        </p>
      )}

      {hasLocalLessonScriptData() && !migrationSummary.migrated ? (
        <p className="lsda-summary">
          localStorage 데이터 감지: 관리자 컬렉션 {migrationSummary.adminCollectionCount}개, 저장 대본 {migrationSummary.savedLessonCount}개
          — Supabase로 이전하면 모든 선생님에게 동일하게 반영됩니다.
        </p>
      ) : null}

      <div className="lsda-layout">
        <nav className="lsda-tabs" aria-label="관리 항목">
          {TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              className={`lsda-tab${activeTab === tab.id ? " active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="lsda-content">{tabContent}</div>
      </div>

      {renderModal()}
      {aiModal ? (
        <LessonScriptAiGenerateModal
          activityType={aiModal.activityType}
          gearContext={aiModal.gearContext}
          onClose={() => setAiModal(null)}
          onApply={handleAiApply}
        />
      ) : null}
    </div>
  );
}
