import { useEffect, useMemo, useState } from "react";
import { fetchItemQuantityAdjustments } from "./itemQuantityAdjust.js";

function fmtWhen(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function ItemQuantityAdjustHistoryPage({ me, PageHeader, PageShell }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [missingTable, setMissingTable] = useState(false);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const result = await fetchItemQuantityAdjustments();
        if (cancelled) return;
        setMissingTable(!!result.missingTable);
        setRows(result.rows || []);
      } catch (err) {
        if (!cancelled) setError(err?.message || "이력을 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [me?.id]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) => {
      const name = row.items?.name || "";
      const code = row.items?.code || "";
      const teacher = row.teachers?.name || "";
      const note = row.note || "";
      return `${name} ${code} ${teacher} ${note}`.toLowerCase().includes(needle);
    });
  }, [rows, q]);

  return (
    <PageShell>
      <PageHeader me={me} subtitle="교구 전체 수량 변경 기록을 확인합니다." />
      <div style={{
        background: "#fff",
        border: "1px solid #e8ecee",
        borderRadius: 16,
        padding: "18px 18px 8px",
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="교구명·코드·선생님·사유 검색"
          style={{
            width: "100%",
            boxSizing: "border-box",
            border: "1px solid #e8ecee",
            background: "#f8fafc",
            borderRadius: 12,
            padding: "12px 14px",
            fontSize: 14,
            fontFamily: "inherit",
            marginBottom: 14,
          }}
        />

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px 16px", color: "#94a3b8", fontSize: 14 }}>불러오는 중...</div>
        ) : missingTable ? (
          <div style={{ padding: "28px 8px 36px", color: "#b45309", fontSize: 13, lineHeight: 1.7 }}>
            재고 변경 이력 테이블이 아직 없습니다. Supabase SQL Editor에서
            <code style={{ margin: "0 6px" }}>supabase/item_quantity_adjustments.sql</code>
            을 실행해 주세요.
          </div>
        ) : error ? (
          <div style={{ padding: "28px 8px 36px", color: "#dc2626", fontSize: 13 }}>{error}</div>
        ) : !filtered.length ? (
          <div style={{ textAlign: "center", padding: "40px 16px", color: "#94a3b8", fontSize: 14 }}>
            {q.trim() ? "검색 결과가 없습니다." : "아직 수량 변경 이력이 없습니다."}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#64748b", fontSize: 11, fontWeight: 800 }}>
                  <th style={{ padding: "8px 10px 10px", borderBottom: "1px solid #e2e8f0" }}>시각</th>
                  <th style={{ padding: "8px 10px 10px", borderBottom: "1px solid #e2e8f0" }}>교구</th>
                  <th style={{ padding: "8px 10px 10px", borderBottom: "1px solid #e2e8f0" }}>변경</th>
                  <th style={{ padding: "8px 10px 10px", borderBottom: "1px solid #e2e8f0" }}>선생님</th>
                  <th style={{ padding: "8px 10px 10px", borderBottom: "1px solid #e2e8f0" }}>사유</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const name = row.items?.name || "삭제된 교구";
                  const code = row.items?.code;
                  const up = Number(row.new_quantity) > Number(row.old_quantity);
                  return (
                    <tr key={row.id}>
                      <td style={{ padding: "12px 10px", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap", color: "#475569" }}>
                        {fmtWhen(row.created_at)}
                      </td>
                      <td style={{ padding: "12px 10px", borderBottom: "1px solid #f1f5f9" }}>
                        <div style={{ fontWeight: 800, color: "#0f172a" }}>{name}</div>
                        {code ? <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{code}</div> : null}
                      </td>
                      <td style={{ padding: "12px 10px", borderBottom: "1px solid #f1f5f9", fontWeight: 800, whiteSpace: "nowrap" }}>
                        <span style={{ color: "#64748b" }}>{row.old_quantity}</span>
                        {" → "}
                        <span style={{ color: up ? "#059669" : "#dc2626" }}>{row.new_quantity}</span>
                      </td>
                      <td style={{ padding: "12px 10px", borderBottom: "1px solid #f1f5f9", color: "#334155" }}>
                        {row.teachers?.name || "—"}
                      </td>
                      <td style={{ padding: "12px 10px", borderBottom: "1px solid #f1f5f9", color: "#64748b" }}>
                        {row.note || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageShell>
  );
}
