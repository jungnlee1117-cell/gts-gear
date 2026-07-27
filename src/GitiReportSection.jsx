import { useEffect, useState } from "react";
import { ExternalLink, FileBarChart2, Loader2, RefreshCw } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

/**
 * 슈퍼관리자 메인(허브) — 최신 지티 리포트 요약 + Drive 링크
 */
export default function GitiReportSection({ supabase: supabaseProp = null }) {
  const supabase = supabaseProp || createClient(SUPABASE_URL, SUPABASE_ANON);
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: err } = await supabase
        .from("giti_reports")
        .select("id, title, summary, period_start, period_end, google_doc_url, stats, created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (err) throw err;
      setReport(data || null);
    } catch (err) {
      setError(err?.message || "리포트를 불러오지 못했어요.");
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const generateNow = async () => {
    setGenerating(true);
    setError("");
    try {
      const { data, error: err } = await supabase.functions.invoke("giti-biweekly-report", {
        body: { force: true },
      });
      if (err) throw err;
      if (data?.error) throw new Error(data.error);
      await load();
    } catch (err) {
      setError(err?.message || "리포트 생성에 실패했어요. (서비스 롤/시크릿 확인)");
    } finally {
      setGenerating(false);
    }
  };

  const total = report?.stats?.totalQuestions;
  const topCat = Array.isArray(report?.stats?.categoryDistribution)
    ? [...report.stats.categoryDistribution].sort((a, b) => (b.count || 0) - (a.count || 0))[0]
    : null;

  return (
    <section className="hub-giti-report" aria-label="지티 리포트">
      <div className="hub-giti-report__head">
        <div className="hub-giti-report__title-wrap">
          <span className="hub-giti-report__icon" aria-hidden>
            <FileBarChart2 size={18} />
          </span>
          <div>
            <h2 className="hub-giti-report__title">지티 리포트</h2>
            <p className="hub-giti-report__sub">15일마다 자동 생성 · Google Drive 저장</p>
          </div>
        </div>
        <div className="hub-giti-report__actions">
          <button
            type="button"
            className="hub-giti-report__btn"
            onClick={() => void load()}
            disabled={loading || generating}
            aria-label="새로고침"
          >
            <RefreshCw size={16} />
          </button>
          <button
            type="button"
            className="hub-giti-report__btn hub-giti-report__btn--primary"
            onClick={() => void generateNow()}
            disabled={loading || generating}
          >
            {generating ? <Loader2 size={16} className="hub-giti-report__spin" /> : null}
            {generating ? "생성 중…" : "지금 생성"}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="hub-giti-report__muted">불러오는 중…</p>
      ) : error ? (
        <p className="hub-giti-report__error">{error}</p>
      ) : !report ? (
        <p className="hub-giti-report__muted">
          아직 생성된 리포트가 없어요. 「지금 생성」으로 첫 리포트를 만들 수 있어요.
        </p>
      ) : (
        <div className="hub-giti-report__card">
          <div className="hub-giti-report__meta">
            <strong>{report.title}</strong>
            <span>
              {report.period_start} ~ {report.period_end}
            </span>
          </div>
          <p className="hub-giti-report__summary">{report.summary || "요약 없음"}</p>
          <div className="hub-giti-report__stats">
            {typeof total === "number" ? (
              <span>총 질문 {total}건</span>
            ) : null}
            {topCat ? (
              <span>
                최다 {topCat.category} {topCat.count}건
              </span>
            ) : null}
          </div>
          {report.google_doc_url ? (
            <a
              className="hub-giti-report__link"
              href={report.google_doc_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Drive에서 보기
              <ExternalLink size={14} aria-hidden />
            </a>
          ) : (
            <p className="hub-giti-report__muted">Drive 문서 링크가 아직 없어요.</p>
          )}
        </div>
      )}
    </section>
  );
}
