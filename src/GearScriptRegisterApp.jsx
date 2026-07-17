import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, Plus, Save, Trash2 } from "lucide-react";
import EnglishProgramLayout from "./EnglishProgramLayout.jsx";
import { useEnglishProgramNavigate } from "./useEnglishProgramNavigate.js";
import { useGearItems } from "./useGearItems.js";
import { PE_ADMIN } from "./peMedia/peMediaUtils.js";
import {
  ACTIVITY_DIALOGUE_SLOTS,
  activityFormHasContent,
  buildActivitiesContentJson,
  createGearScriptEntryId,
  emptyActivityForm,
  findGearScriptEntryByItemId,
  initGearScriptEntries,
  upsertGearScriptEntry,
} from "./gearScriptEntriesApi.js";
import { getCategoryMeta } from "./gearScriptMeta.js";

function DialogueSlotFields({ slotDef, value, onChange }) {
  const slot = value || { foundation: "", interactive: "", action: "" };
  return (
    <div className="gsr-slot">
      <div className="gsr-slot__head">
        <strong>{slotDef.label}</strong>
        <span className="lsb-muted">{slotDef.hint}</span>
      </div>
      <label className="gsr-field">
        <span>지문 · 시연 동작 (선택)</span>
        <input
          className="lsb-input"
          value={slot.action}
          onChange={e => onChange({ ...slot, action: e.target.value })}
          placeholder="예: 벽돌을 하나씩 나눠주며 질문"
        />
      </label>
      <label className="gsr-field">
        <span>Foundation</span>
        <textarea
          className="lsb-editable-textarea"
          rows={2}
          value={slot.foundation}
          onChange={e => onChange({ ...slot, foundation: e.target.value })}
        />
      </label>
      <label className="gsr-field">
        <span>Interactive</span>
        <textarea
          className="lsb-editable-textarea"
          rows={2}
          value={slot.interactive}
          onChange={e => onChange({ ...slot, interactive: e.target.value })}
        />
      </label>
    </div>
  );
}

export default function GearScriptRegisterApp({ me, onBack, onGoMain }) {
  const navigate = useNavigate();
  const onNavigate = useEnglishProgramNavigate();
  const [searchParams] = useSearchParams();
  const itemId = searchParams.get("itemId") || "";
  const { items, loading: itemsLoading } = useGearItems();
  const item = useMemo(() => items.find(i => i.id === itemId) || null, [items, itemId]);
  const allowed = PE_ADMIN(me);

  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [matchPatternsText, setMatchPatternsText] = useState("");
  const [introFoundation, setIntroFoundation] = useState("");
  const [introInteractive, setIntroInteractive] = useState("");
  const [closingFoundation, setClosingFoundation] = useState("");
  const [closingInteractive, setClosingInteractive] = useState("");
  const [safetyText, setSafetyText] = useState("");
  const [activities, setActivities] = useState([emptyActivityForm()]);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    initGearScriptEntries().catch(() => {});
  }, []);

  useEffect(() => {
    if (!item) return;
    setLabel(item.name || "");
    setDescription(`${getCategoryMeta(item.category).label} 교구 대본`);
    const patterns = [item.name, item.alias].filter(Boolean);
    setMatchPatternsText(patterns.join(", "));
    setSafetyText(item.safety_notes || "");
    setReady(true);
  }, [item]);

  useEffect(() => {
    if (!itemId || !allowed) return;
    findGearScriptEntryByItemId(itemId)
      .then(existing => {
        if (existing?.id) {
          navigate(`/english-script?gear=${encodeURIComponent(existing.id)}`, { replace: true });
        }
      })
      .catch(() => {});
  }, [itemId, allowed, navigate]);

  const updateActivity = (idx, patch) => {
    setActivities(prev => prev.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  };

  const updateSlot = (actIdx, slotKey, slotValue) => {
    setActivities(prev => prev.map((a, i) => {
      if (i !== actIdx) return a;
      return {
        ...a,
        slots: { ...a.slots, [slotKey]: slotValue },
      };
    }));
  };

  const handleSave = async () => {
    if (!allowed) return;
    if (!label.trim()) return alert("교구 이름을 입력해 주세요.");
    const content = buildActivitiesContentJson({
      introFoundation,
      introInteractive,
      activities,
      closingFoundation,
      closingInteractive,
      safetyText,
    });
    if (!content.activities.length) {
      return alert("활동을 하나 이상 입력해 주세요. (도입 슬롯만 채워도 저장됩니다)");
    }

    const patterns = matchPatternsText
      .split(/[,，\n]/)
      .map(s => s.trim())
      .filter(Boolean);
    if (!patterns.length) patterns.push(label.trim());

    setSaving(true);
    setError("");
    try {
      const id = createGearScriptEntryId(label);
      await upsertGearScriptEntry({
        id,
        item_id: itemId || null,
        label: label.trim(),
        description: description.trim(),
        script_type: "activities",
        match_patterns: patterns,
        level_ids: ["foundation", "interactive"],
        content_json: content,
      }, me?.id);
      navigate(`/english-script?gear=${encodeURIComponent(id)}`, { replace: true });
    } catch (err) {
      setError(err?.message || "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (!allowed) {
    return (
      <EnglishProgramLayout activeId="gear-scripts" onBack={onBack} onGoMain={onGoMain} onNavigate={onNavigate} me={me}>
        <div className="eng-lib-main">
          <p className="eng-lib-empty">관리자만 교구 대본을 등록할 수 있습니다.</p>
        </div>
      </EnglishProgramLayout>
    );
  }

  return (
    <EnglishProgramLayout activeId="gear-scripts" onBack={onBack} onGoMain={onGoMain} onNavigate={onNavigate} me={me}>
      <div className="eng-lib-main gsr-page">
        <header className="gsr-header">
          <button type="button" className="lsb-btn lsb-btn--ghost lsb-btn--sm" onClick={() => navigate("/english-script")}>
            <ChevronLeft size={16}/>
            교구 대본
          </button>
          <h1 className="gsr-title">교구 대본 등록</h1>
          <p className="gsr-desc">
            활동마다 도입→Kids→안내·안전→지목→구호→반응→칭찬 + TIP 구조로 작성합니다.
            빈 슬롯은 저장되지 않습니다.
          </p>
        </header>

        {itemsLoading || !ready ? (
          <p className="lsb-muted">교구 정보를 불러오는 중…</p>
        ) : !item ? (
          <p className="eng-lib-empty">교구를 찾을 수 없습니다. 목록에서 다시 선택해 주세요.</p>
        ) : (
          <div className="gsr-form">
            <label className="gsr-field">
              <span>교구 이름</span>
              <input className="lsb-input" value={label} onChange={e => setLabel(e.target.value)}/>
            </label>
            <label className="gsr-field">
              <span>설명</span>
              <input className="lsb-input" value={description} onChange={e => setDescription(e.target.value)}/>
            </label>
            <label className="gsr-field">
              <span>매칭 키워드 (쉼표 구분)</span>
              <input className="lsb-input" value={matchPatternsText} onChange={e => setMatchPatternsText(e.target.value)}/>
              <small className="lsb-muted">재고 이름/별칭과 맞으면 「전체 교구 대본」에 표시됩니다.</small>
            </label>

            <section className="gsr-section">
              <h2>교구 소개 (선택)</h2>
              <label className="gsr-field">
                <span>Foundation</span>
                <textarea className="lsb-editable-textarea" rows={3} value={introFoundation} onChange={e => setIntroFoundation(e.target.value)}/>
              </label>
              <label className="gsr-field">
                <span>Interactive</span>
                <textarea className="lsb-editable-textarea" rows={3} value={introInteractive} onChange={e => setIntroInteractive(e.target.value)}/>
              </label>
            </section>

            <section className="gsr-section">
              <div className="gsr-section__head">
                <h2>활동 대본</h2>
                <button type="button" className="lsb-btn lsb-btn--ghost lsb-btn--sm" onClick={() => setActivities(a => [...a, emptyActivityForm()])}>
                  <Plus size={14}/>
                  활동 추가
                </button>
              </div>
              {activities.map((act, idx) => (
                <div key={idx} className="gsr-activity">
                  <div className="gsr-activity__head">
                    <strong>활동 {idx + 1}{activityFormHasContent(act) ? "" : " · 비어 있음"}</strong>
                    {activities.length > 1 ? (
                      <button
                        type="button"
                        className="lsb-btn lsb-btn--ghost lsb-btn--sm"
                        onClick={() => setActivities(a => a.filter((_, i) => i !== idx))}
                      >
                        <Trash2 size={14}/>
                        삭제
                      </button>
                    ) : null}
                  </div>

                  <div className="gsr-meta-row">
                    <label className="gsr-field">
                      <span>제목 (한글)</span>
                      <input
                        className="lsb-input"
                        value={act.title}
                        onChange={e => updateActivity(idx, { title: e.target.value })}
                        placeholder="예: 벽돌 하나씩 받고 탐색하기"
                      />
                    </label>
                    <label className="gsr-field">
                      <span>영문 소제목</span>
                      <input
                        className="lsb-input"
                        value={act.titleEn}
                        onChange={e => updateActivity(idx, { titleEn: e.target.value })}
                        placeholder="예: Explore It!"
                      />
                    </label>
                    <label className="gsr-field">
                      <span>소요 시간</span>
                      <input
                        className="lsb-input"
                        value={act.time}
                        onChange={e => updateActivity(idx, { time: e.target.value })}
                        placeholder="예: 2~3분"
                      />
                    </label>
                  </div>

                  {ACTIVITY_DIALOGUE_SLOTS.map(slotDef => (
                    <DialogueSlotFields
                      key={slotDef.key}
                      slotDef={slotDef}
                      value={act.slots?.[slotDef.key]}
                      onChange={next => updateSlot(idx, slotDef.key, next)}
                    />
                  ))}

                  <label className="gsr-field">
                    <span>TIP (교사 지도 팁)</span>
                    <textarea
                      className="lsb-editable-textarea"
                      rows={2}
                      value={act.tip}
                      onChange={e => updateActivity(idx, { tip: e.target.value })}
                      placeholder="예: 처음 만지는 시간을 충분히 줘야 이후 활동에서 안전하게 다룸"
                    />
                  </label>
                </div>
              ))}
            </section>

            <section className="gsr-section">
              <h2>마무리 (선택)</h2>
              <label className="gsr-field">
                <span>Foundation</span>
                <textarea className="lsb-editable-textarea" rows={3} value={closingFoundation} onChange={e => setClosingFoundation(e.target.value)}/>
              </label>
              <label className="gsr-field">
                <span>Interactive</span>
                <textarea className="lsb-editable-textarea" rows={3} value={closingInteractive} onChange={e => setClosingInteractive(e.target.value)}/>
              </label>
            </section>

            <section className="gsr-section">
              <h2>안전 체크리스트 (선택, 줄바꿈 구분)</h2>
              <p className="lsb-muted" style={{ margin: 0 }}>
                활동 중 안전 안내는 위 「3. Teacher 안내·안전」 슬롯에 넣는 것을 권장합니다. 여기는 별도 체크리스트용입니다.
              </p>
              <textarea className="lsb-editable-textarea" rows={4} value={safetyText} onChange={e => setSafetyText(e.target.value)}/>
            </section>

            {error ? <p className="lsda-error" role="alert">{error}</p> : null}

            <div className="gsr-actions">
              <button type="button" className="lsb-btn lsb-btn--primary" onClick={handleSave} disabled={saving}>
                <Save size={16}/>
                {saving ? "저장 중…" : "등록 저장"}
              </button>
            </div>
          </div>
        )}
      </div>
    </EnglishProgramLayout>
  );
}
