import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import { ChevronLeft, Download, FileSpreadsheet } from "lucide-react";
import { isSuperAdmin } from "./authRoles.js";
import { runDataExport } from "./export/runExport.js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

const DS = {
  primary: "#16a34a",
  primaryLight: "#f0fdf4",
  textPrimary: "#111827",
  textSecondary: "#64748b",
  textMuted: "#94a3b8",
};

function yearMonthKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

const EXPORT_ITEMS = [
  {
    id: "equipment-status",
    title: "교구 현황",
    description: "교구명, 카테고리, 전체/대여가능/대여중 수량",
  },
  {
    id: "rental-history",
    title: "대여 내역",
    description: "선생님명, 교구명, 대여일, 반납예정일, 반납일, 상태",
  },
  {
    id: "teacher-settlement",
    title: "선생님 급여/정산",
    description: "선생님명, 기관, 수업료, 추가수당, 총액, 정산월",
  },
];

function ExportCard({ item, allPeriod, month, disabled }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleDownload = async () => {
    setError("");
    setLoading(true);
    try {
      await runDataExport(supabase, item.id, { allPeriod, month });
    } catch (err) {
      setError(err?.message || "다운로드에 실패했습니다");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 18,
        border: "1px solid #e8ecee",
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        padding: "22px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        minHeight: 180,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: DS.primaryLight,
            color: DS.primary,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <FileSpreadsheet size={22} strokeWidth={2.2} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: DS.textPrimary, marginBottom: 6 }}>
            {item.title}
          </div>
          <div style={{ fontSize: 13, color: DS.textSecondary, lineHeight: 1.55 }}>
            {item.description}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={handleDownload}
        disabled={disabled || loading}
        style={{
          marginTop: "auto",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          width: "100%",
          padding: "12px 16px",
          borderRadius: 12,
          border: "none",
          background: disabled ? "#e2e8f0" : DS.primary,
          color: disabled ? "#94a3b8" : "#fff",
          fontSize: 14,
          fontWeight: 700,
          cursor: disabled || loading ? "not-allowed" : "pointer",
          fontFamily: "inherit",
        }}
      >
        <Download size={16} />
        {loading ? "생성 중…" : "Excel 다운로드"}
      </button>

      {error ? (
        <div style={{ fontSize: 12, color: "#dc2626", fontWeight: 600 }}>{error}</div>
      ) : null}
    </div>
  );
}

export default function DataExportPage({ me, onBack }) {
  const navigate = useNavigate();
  const [yearMonth, setYearMonth] = useState(yearMonthKey());
  const [allPeriod, setAllPeriod] = useState(false);
  const allowed = isSuperAdmin(me);

  const goBack = onBack || (() => navigate("/gear?page=settings"));

  if (!allowed) {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 20px", textAlign: "center" }}>
        <div style={{ fontWeight: 800, fontSize: 18, color: "#dc2626", marginBottom: 12 }}>
          접근 권한이 없습니다
        </div>
        <p style={{ color: DS.textSecondary, marginBottom: 20 }}>
          슈퍼관리자만 데이터 내보내기 기능을 사용할 수 있습니다.
        </p>
        <button
          type="button"
          onClick={() => navigate("/gear")}
          style={{
            padding: "10px 18px",
            borderRadius: 10,
            border: "none",
            background: DS.primary,
            color: "#fff",
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          대시보드로 이동
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 20px 48px" }}>
      <button
        type="button"
        onClick={goBack}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 18,
          padding: "8px 12px",
          borderRadius: 10,
          border: "1px solid #e2e8f0",
          background: "#fff",
          color: DS.textSecondary,
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        <ChevronLeft size={16} />
        돌아가기
      </button>

      <h1 style={{ fontSize: 26, fontWeight: 800, color: DS.textPrimary, margin: "0 0 8px" }}>
        교구, 급여 데이터 내보내기
      </h1>
      <p style={{ fontSize: 14, color: DS.textSecondary, margin: "0 0 24px", lineHeight: 1.6 }}>
        필요한 데이터를 Excel 파일로 다운로드할 수 있습니다.
      </p>

      <div
        style={{
          background: "#fff",
          borderRadius: 18,
          border: "1px solid #e8ecee",
          padding: "18px 20px",
          marginBottom: 22,
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          alignItems: "center",
        }}
      >
        <div style={{ flex: "1 1 180px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: DS.textMuted, marginBottom: 8 }}>
            조회 월
          </div>
          <input
            type="month"
            value={yearMonth}
            disabled={allPeriod}
            onChange={e => setYearMonth(e.target.value)}
            style={{
              width: "100%",
              maxWidth: 220,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              fontSize: 14,
              fontFamily: "inherit",
              background: allPeriod ? "#f8fafc" : "#fff",
            }}
          />
        </div>

        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: 14,
            fontWeight: 600,
            color: DS.textPrimary,
            cursor: "pointer",
            userSelect: "none",
            marginTop: 22,
          }}
        >
          <input
            type="checkbox"
            checked={allPeriod}
            onChange={e => setAllPeriod(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: DS.primary }}
          />
          전체 기간
        </label>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
          gap: 16,
        }}
      >
        {EXPORT_ITEMS.map(item => (
          <ExportCard
            key={item.id}
            item={item}
            allPeriod={allPeriod}
            month={yearMonth}
            disabled={!allPeriod && !yearMonth}
          />
        ))}
      </div>
    </div>
  );
}
