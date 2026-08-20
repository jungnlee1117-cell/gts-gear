import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ChevronLeft,
  ChevronDown,
  KeyRound,
  Mail,
  Home,
  Pencil,
  Phone,
  Search,
  User,
} from "lucide-react";
import {
  activityStatusPatch,
  canAccessTeacherHr,
  canBrowseTeacherProfiles,
  canEditTeacherActivityStatus,
  canEditTeacherProfile,
  canUploadTeacherContract,
  canRevealTeacherSettlement,
  canViewTeacherProfile,
  formatProfileDate,
  teacherActivityBadgeLabel,
  teacherActivityStatus,
  teacherRoleLabel,
  visibleMyProfileTabs,
} from "./teacherProfile.js";
import MyProfileSettlementCard from "./MyProfileSettlementCard.jsx";
import MyProfileKioskPinCard from "./MyProfileKioskPinCard.jsx";
import MyProfileContractsTab from "./MyProfileContractsTab.jsx";
import { MyProfileCareersSection, MyProfileCertificationsSection } from "./MyProfileEntries.jsx";
import {
  IdentityBadge,
  InfoCell,
  ProfileGrid,
  ProfileValue,
} from "./MyProfileFormField.jsx";
import { invokeTeacherHr } from "./teacherHr.js";

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function emptyForm() {
  return {
    name: "",
    english_name: "",
    phone: "",
    activity_status: "활동중",
    contract_type: "",
  };
}

function teacherToForm(teacher) {
  return {
    name: teacher?.name || "",
    english_name: teacher?.english_name || "",
    phone: teacher?.phone || "",
    activity_status: teacherActivityStatus(teacher),
    contract_type: teacher?.contract_type || "",
  };
}

function displayOrDash(value) {
  return value ? value : "—";
}

function PasswordChangeCard({ email, supabase, onClose }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  const handlePasswordChange = async (event) => {
    event.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (!email?.trim()) {
      setPasswordError("로그인 정보를 확인할 수 없습니다. 다시 로그인해 주세요.");
      return;
    }
    if (!currentPassword) {
      setPasswordError("현재 비밀번호를 입력해 주세요.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("새 비밀번호는 6자 이상이어야 합니다.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("새 비밀번호가 일치하지 않습니다.");
      return;
    }
    if (currentPassword === newPassword) {
      setPasswordError("새 비밀번호는 현재 비밀번호와 다르게 입력해 주세요.");
      return;
    }

    setPasswordSaving(true);
    try {
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: currentPassword,
      });
      if (verifyError) {
        throw new Error("현재 비밀번호가 올바르지 않습니다.");
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccess("비밀번호가 변경되었습니다.");
    } catch (error) {
      setPasswordError(error?.message || "비밀번호 변경에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="my-profile-password-card">
      <div className="my-profile-password-head">
        <div>
          <h3>비밀번호 변경</h3>
          <p>현재 비밀번호를 확인한 후 새 비밀번호로 변경합니다.</p>
        </div>
        <button type="button" className="my-profile-btn-ghost my-profile-btn-ghost--sm" onClick={onClose} disabled={passwordSaving}>
          닫기
        </button>
      </div>
      <form onSubmit={handlePasswordChange}>
        <ProfileGrid cols={3}>
          <label className="my-profile-field">
            <span className="my-profile-label">현재 비밀번호</span>
            <input
              type="password"
              className="my-profile-input"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <label className="my-profile-field">
            <span className="my-profile-label">새 비밀번호</span>
            <input
              type="password"
              className="my-profile-input"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              minLength={6}
              required
            />
          </label>
          <label className="my-profile-field">
            <span className="my-profile-label">새 비밀번호 확인</span>
            <input
              type="password"
              className="my-profile-input"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              minLength={6}
              required
            />
          </label>
        </ProfileGrid>
        {passwordError ? <p className="my-profile-password-message my-profile-password-message--error">{passwordError}</p> : null}
        {passwordSuccess ? <p className="my-profile-password-message my-profile-password-message--success">{passwordSuccess}</p> : null}
        <div className="my-profile-actions">
          <button type="submit" className="my-profile-save" disabled={passwordSaving}>
            {passwordSaving ? "변경 중..." : "비밀번호 저장"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function MyProfilePage({ me, session, supabase, onBack, onMeUpdated }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedId = searchParams.get("teacherId") || me?.id;
  const [tab, setTab] = useState("basic");
  const [teachers, setTeachers] = useState([]);
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingBasic, setEditingBasic] = useState(false);
  const [hrTick, setHrTick] = useState(0);
  const [hasPendingContract, setHasPendingContract] = useState(false);
  const [affiliation, setAffiliation] = useState("");
  const [settlementEditing, setSettlementEditing] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const docsCount = 0;
  const refreshHrBadges = useCallback(() => setHrTick((n) => n + 1), []);

  const canBrowse = canBrowseTeacherProfiles(me);
  const canEdit = canEditTeacherProfile(me, requestedId);
  const canEditStatus = canEditTeacherActivityStatus(me);
  const canView = canViewTeacherProfile(me, requestedId);
  const canHr = canAccessTeacherHr(me, requestedId);
  const canRevealSettlement = canRevealTeacherSettlement(me, requestedId);
  const canUploadContract = canUploadTeacherContract(me);
  const canSignContract = Boolean(me?.id && me.id === requestedId);
  const displayEmail = requestedId === me?.id
    ? (session?.user?.email || profile?.email || "")
    : (profile?.email || "");

  const loadProfile = useCallback((silent = false) => {
    if (!requestedId || !canView) {
      setProfile(null);
      if (!silent) setLoading(false);
      return Promise.resolve();
    }
    if (!silent) setLoading(true);
    return supabase
      .from("teachers")
      .select("*")
      .eq("id", requestedId)
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.error(error);
          setProfile(null);
        } else {
          const row = {
            ...data,
            email: data.email || (data.id === me?.id ? session?.user?.email : "") || "",
          };
          setProfile(row);
          setForm(teacherToForm(row));
          setEditingBasic(false);
        }
        if (!silent) setLoading(false);
      });
  }, [requestedId, canView, me?.id, session?.user?.email, supabase]);

  useEffect(() => {
    if (!canBrowse) return undefined;
    let cancelled = false;
    supabase
      .from("teachers")
      .select("id, name, role, active, resigned_at, hire_date")
      .order("name")
      .then(({ data, error }) => {
        if (cancelled || error) return;
        setTeachers(data || []);
      });
    return () => { cancelled = true; };
  }, [canBrowse, supabase]);

  useEffect(() => {
    if (!requestedId || !canView) {
      setProfile(null);
      setLoading(false);
      return undefined;
    }
    loadProfile();
    return undefined;
  }, [requestedId, canView, loadProfile]);

  useEffect(() => {
    if (!requestedId || !canView) {
      setHasPendingContract(false);
      return undefined;
    }
    let cancelled = false;
    supabase
      .from("teacher_contracts")
      .select("id")
      .eq("teacher_id", requestedId)
      .eq("status", "서명대기")
      .limit(1)
      .then(({ data, error }) => {
        if (cancelled || error) return;
        setHasPendingContract(Boolean(data?.length));
      });
    return () => { cancelled = true; };
  }, [requestedId, canView, hrTick, supabase]);

  useEffect(() => {
    if (!requestedId || !canView) {
      setAffiliation("");
      return undefined;
    }
    let cancelled = false;
    const loadAffiliation = async () => {
      const names = [];
      const { data: assigned } = await supabase
        .from("institution_teacher_assignments")
        .select("institutions(name)")
        .eq("teacher_id", requestedId)
        .eq("is_active", true);
      for (const row of assigned || []) {
        const name = row?.institutions?.name;
        if (name) names.push(name);
      }
      if (!names.length) {
        const { data: managed } = await supabase
          .from("institutions")
          .select("name")
          .eq("manager_id", requestedId);
        for (const row of managed || []) {
          if (row?.name) names.push(row.name);
        }
      }
      if (!cancelled) {
        setAffiliation([...new Set(names)].join(", "));
      }
    };
    loadAffiliation().catch(() => {
      if (!cancelled) setAffiliation("");
    });
    return () => { cancelled = true; };
  }, [requestedId, canView, supabase]);

  const visibleTabs = useMemo(
    () => visibleMyProfileTabs(me, { teacherId: requestedId, hasPendingContract }),
    [me, requestedId, hasPendingContract],
  );

  useEffect(() => {
    if (!visibleTabs.some((item) => item.id === tab)) setTab("basic");
  }, [tab, visibleTabs]);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async (e) => {
    e.preventDefault();
    if (!canEdit || !profile) return;
    setSaving(true);
    try {
      const patch = {
        english_name: form.english_name.trim() || null,
        phone: form.phone.trim() || null,
        contract_type: form.contract_type || null,
      };
      if (canEditStatus) {
        Object.assign(patch, activityStatusPatch(form.activity_status, profile, todayYmd()));
      }
      const { data, error } = await supabase
        .from("teachers")
        .update(patch)
        .eq("id", profile.id)
        .select("*")
        .single();
      if (error) throw error;
      const next = { ...data, email: displayEmail };
      setProfile(next);
      setForm(teacherToForm(next));
      setEditingBasic(false);
      if (next.id === me?.id) onMeUpdated?.(next);
      await loadProfile(true);
    } catch (err) {
      alert("저장 실패: " + (err.message || "알 수 없는 오류"));
    } finally {
      setSaving(false);
    }
  };

  const teacherOptions = useMemo(
    () => [...teachers].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ko")),
    [teachers],
  );

  if (!canView) {
    return (
      <div className="my-profile-page">
        <header className="my-profile-topbar">
          <button type="button" className="my-profile-back" onClick={() => navigate(-1)}>
            <ChevronLeft size={18}/> 뒤로가기
          </button>
          <button type="button" className="my-profile-home" onClick={onBack}>
            <Home size={16}/> 메인으로
          </button>
        </header>
        <p className="my-profile-muted">이 정보를 볼 권한이 없습니다.</p>
      </div>
    );
  }

  const updatedLabel = formatProfileDate(profile?.updated_at || profile?.created_at);
  const roleLabel = teacherRoleLabel(profile?.role);
  const activityBadge = teacherActivityBadgeLabel(profile);
  const identityName = profile?.name || "선생님";

  return (
    <div className="my-profile-page">
      <header className="my-profile-topbar">
        <button type="button" className="my-profile-back" onClick={() => navigate(-1)}>
          <ChevronLeft size={18}/> 뒤로가기
        </button>
        <button type="button" className="my-profile-home" onClick={onBack}>
          <Home size={16}/> 메인으로
        </button>
      </header>

      <div className="my-profile-shell">
        <section className="my-profile-card my-profile-identity-card">
          <div className="my-profile-identity">
            <div className="my-profile-identity-main">
              {canBrowse ? (
                <label className="my-profile-identity-select-wrap">
                  <span className="my-profile-identity-select-label">선생님 정보 보기</span>
                  <span className="my-profile-identity-select-control">
                    <User size={18} aria-hidden />
                    <select
                      className="my-profile-identity-select"
                      value={requestedId || ""}
                      aria-label="확인할 선생님 선택"
                      onChange={(e) => {
                        const id = e.target.value;
                        setSettlementEditing(false);
                        setPasswordOpen(false);
                        setSearchParams(id && id !== me?.id ? { teacherId: id } : {});
                      }}
                    >
                      {teacherOptions.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}{t.id === me?.id ? " (나)" : ""}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={18} aria-hidden />
                  </span>
                </label>
              ) : (
                <h1 className="my-profile-identity-name">{identityName}</h1>
              )}
              <div className="my-profile-identity-badges">
                <IdentityBadge>{roleLabel}</IdentityBadge>
                <IdentityBadge tone={activityBadge === "활동중" ? "ok" : "neutral"}>
                  {activityBadge}
                </IdentityBadge>
                <IdentityBadge>{affiliation || "소속 미지정"}</IdentityBadge>
              </div>
            </div>
          </div>
        </section>

        {visibleTabs.length > 1 ? (
          <div className="my-profile-tabs" role="tablist" aria-label="선생님 정보 탭">
            {visibleTabs.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                aria-controls={`my-profile-panel-${item.id}`}
                id={`my-profile-tab-${item.id}`}
                className={`my-profile-tab${tab === item.id ? " active" : ""}`}
                onClick={() => setTab(item.id)}
              >
                {item.label}
                {item.id === "docs" ? (
                  <span className="my-profile-tab-count" aria-label={`서류 ${docsCount}건`}>{docsCount}</span>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}

        {loading ? (
          <p className="my-profile-empty">불러오는 중...</p>
        ) : tab === "basic" ? (
          <div
            className="my-profile-basic-layout"
            role="tabpanel"
            id="my-profile-panel-basic"
            aria-labelledby="my-profile-tab-basic"
          >
            {hasPendingContract && requestedId === me?.id && !canUploadContract ? (
              <button type="button" className="my-profile-pending-banner" onClick={() => setTab("contract")}>
                서명 대기 중인 계약서가 있습니다. 눌러서 확인하고 서명하세요.
              </button>
            ) : null}
            <div className={`my-profile-basic-grid${passwordOpen && requestedId === me?.id ? " my-profile-basic-grid--password-open" : ""}`}>
                <form className="my-profile-card my-profile-basic-info-card" onSubmit={handleSave}>
                  <div className="my-profile-section-head">
                    <h2 className="my-profile-card-title">기본정보</h2>
                    <div className="my-profile-section-actions">
                      {requestedId === me?.id ? (
                        <button
                          type="button"
                          className="my-profile-password-trigger"
                          onClick={() => setPasswordOpen((open) => !open)}
                          aria-expanded={passwordOpen}
                        >
                          <KeyRound size={14} strokeWidth={2.2} />
                          비밀번호 변경
                        </button>
                      ) : null}
                      {canEdit && !editingBasic ? (
                        <button
                          type="button"
                          className="my-profile-btn-mint"
                          onClick={() => {
                            setForm(teacherToForm(profile));
                            setEditingBasic(true);
                          }}
                          aria-label="기본정보 수정하기"
                        >
                          <Pencil size={14} strokeWidth={2.2} />
                          수정하기
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <ProfileGrid cols={2} className="my-profile-basic-read-grid">
                    <InfoCell icon={User} label="이름">
                      <ProfileValue>{displayOrDash(form.name)}</ProfileValue>
                    </InfoCell>
                    <InfoCell icon={Search} label="영문명">
                      {editingBasic ? (
                        <input
                          className="my-profile-input"
                          value={form.english_name}
                          onChange={(e) => setField("english_name", e.target.value)}
                          placeholder="예: Hyungsin Jung"
                          aria-label="영문명"
                        />
                      ) : (
                        <ProfileValue>{form.english_name}</ProfileValue>
                      )}
                    </InfoCell>
                    <InfoCell icon={Phone} label="연락처">
                      {editingBasic ? (
                        <input
                          className="my-profile-input"
                          value={form.phone}
                          onChange={(e) => setField("phone", e.target.value)}
                          placeholder="010-0000-0000"
                          aria-label="연락처"
                        />
                      ) : (
                        <ProfileValue>{form.phone}</ProfileValue>
                      )}
                    </InfoCell>
                    <InfoCell icon={Mail} label="이메일">
                      <ProfileValue>{displayEmail}</ProfileValue>
                    </InfoCell>
                  </ProfileGrid>
                  {editingBasic ? (
                    <div className="my-profile-actions">
                      <button
                        type="button"
                        className="my-profile-btn-ghost"
                        onClick={() => {
                          setForm(teacherToForm(profile));
                          setEditingBasic(false);
                        }}
                        disabled={saving}
                      >
                        취소
                      </button>
                      <button type="submit" className="my-profile-save" disabled={saving}>
                        {saving ? "저장 중..." : "저장"}
                      </button>
                    </div>
                  ) : null}
                  {updatedLabel ? (
                    <p className="my-profile-updated">최근 수정 {updatedLabel}</p>
                  ) : null}
                </form>

                {passwordOpen && requestedId === me?.id ? (
                  <div className="my-profile-password-slot">
                    <PasswordChangeCard
                      email={session?.user?.email || displayEmail}
                      supabase={supabase}
                      onClose={() => setPasswordOpen(false)}
                    />
                  </div>
                ) : null}

                <div className="my-profile-certifications-slot">
                  <MyProfileCertificationsSection
                    supabase={supabase}
                    teacherId={requestedId}
                    canEdit={canEdit}
                  />
                </div>
                <div className="my-profile-careers-slot">
                  <MyProfileCareersSection
                    supabase={supabase}
                    teacherId={requestedId}
                    canEdit={canEdit}
                  />
                </div>

                {canHr ? (
                  <div className="my-profile-settlement-slot">
                    <MyProfileSettlementCard
                      supabase={supabase}
                      teacherId={requestedId}
                      canEdit={canHr}
                      canReveal={canRevealSettlement}
                      onSaved={refreshHrBadges}
                      editing={settlementEditing}
                      onEditingChange={setSettlementEditing}
                    />
                  </div>
                ) : null}

                {canEdit ? (
                  <div className="my-profile-kiosk-pin-slot">
                    <MyProfileKioskPinCard
                      supabase={supabase}
                      teacherId={requestedId}
                      canEdit={canEdit}
                    />
                  </div>
                ) : null}
            </div>
          </div>
        ) : tab === "contract" ? (
          <div role="tabpanel" id="my-profile-panel-contract" aria-labelledby="my-profile-tab-contract">
            {canHr ? (
              <MyProfileContractsTab
                supabase={supabase}
                me={me}
                teacherId={requestedId}
                teacherName={profile?.name}
                teacherPhone={profile?.phone}
                teacherContractType={profile?.contract_type}
                canUpload={canUploadContract}
                canSign={canSignContract}
                onChanged={refreshHrBadges}
              />
            ) : (
              <p className="my-profile-empty">계약서는 본인과 슈퍼관리자만 볼 수 있습니다.</p>
            )}
          </div>
        ) : (
          <div
            className="my-profile-placeholder"
            role="tabpanel"
            id={`my-profile-panel-${tab}`}
            aria-labelledby={`my-profile-tab-${tab}`}
          >
            준비 중입니다
          </div>
        )}
      </div>
    </div>
  );
}
