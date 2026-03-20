"use client";

/**
 * MLResultsView.tsx
 * Konum: cve/app/components/MLResultsView.tsx
 *
 * CVE Arama sekmesinde ML sonuçlarını filtreli gösterir.
 * DB'den /api/ml/results endpoint'inden çeker.
 *
 * Kullanım (page.tsx renderSearch() içine ekle):
 *   import MLResultsView from "./components/MLResultsView";
 *   // Sekme içinde:
 *   <MLResultsView />
 */

import { useEffect, useState, useCallback } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

type MLResultRow = {
  app_id: string;
  cve_id: string;
  cascade_score: number;
  sbert_score: number;
  tfidf_score: number;
  match_type: string;
  severity: string;
  cvss_score: number;
  vendor: string;
  product: string;
  sev_lightgbm: string;
  sev_lightgbm_conf: number;
  sev_xgboost: string;
  sev_xgboost_conf: number;
  sev_distilbert: string;
  sev_distilbert_conf: number;
};

const MATCH_TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  strong_match:   { label: "Güçlü Eşleşme",   color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  semantic_match: { label: "Anlamsal",          color: "#6366f1", bg: "rgba(99,102,241,0.12)" },
  lexical_match:  { label: "Leksikal",          color: "#0ea5e9", bg: "rgba(14,165,233,0.12)" },
  fuzzy_match:    { label: "Bulanık",           color: "#f97316", bg: "rgba(249,115,22,0.12)" },
  weak_match:     { label: "Zayıf",            color: "#94a3b8", bg: "rgba(148,163,184,0.12)" },
  sbert_fallback: { label: "SBERT Fallback",   color: "#a855f7", bg: "rgba(168,85,247,0.12)" },
  exact_cveid:    { label: "Tam CVE-ID",        color: "#eab308", bg: "rgba(234,179,8,0.12)" },
};

const SEV_COLORS: Record<string, string> = {
  CRITICAL: "#ef4444",
  HIGH:     "#f97316",
  MEDIUM:   "#eab308",
  LOW:      "#22c55e",
  UNKNOWN:  "#94a3b8",
};

export default function MLResultsView() {
  const [results, setResults]       = useState<MLResultRow[]>([]);
  const [loading, setLoading]       = useState(false);
  const [minScore, setMinScore]     = useState(0.3);
  const [matchType, setMatchType]   = useState("");
  const [appIdFilter, setAppIdFilter] = useState("");
  const [sevFilter, setSevFilter]   = useState("");

  const fetchResults = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (appIdFilter) q.set("app_id", appIdFilter);
      if (minScore > 0) q.set("min_score", String(minScore));
      if (matchType) q.set("match_type", matchType);

      const res = await fetch(`${API_BASE}/ml/results?${q}`);
      const data = await res.json();
      setResults(data.results ?? []);
    } catch (e) {
      console.error("ML results fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [appIdFilter, minScore, matchType]);

  useEffect(() => { fetchResults(); }, [fetchResults]);

  // Severity filtresi frontend'de
  const filtered = sevFilter
    ? results.filter(r => r.severity === sevFilter)
    : results;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Filtre bar */}
      <div style={{
        padding: "14px 16px",
        borderRadius: 14,
        border: "1px solid #1e293b",
        backgroundColor: "#0f172a",
        display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center",
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", marginRight: 4 }}>
          🔗 ML Sonuçları
        </div>

        {/* Uygulama ID filtre */}
        <input
          value={appIdFilter}
          onChange={e => setAppIdFilter(e.target.value)}
          placeholder="App ID (örn: APP-001)"
          style={{
            padding: "7px 12px", borderRadius: 8,
            border: "1px solid #1e293b", backgroundColor: "#020617",
            color: "#e2e8f0", fontSize: 12, width: 160,
          }}
        />

        {/* Match type filtre */}
        <select
          value={matchType}
          onChange={e => setMatchType(e.target.value)}
          style={{
            padding: "7px 12px", borderRadius: 8,
            border: "1px solid #1e293b", backgroundColor: "#020617",
            color: "#e2e8f0", fontSize: 12,
          }}
        >
          <option value="">Tüm Match Tipleri</option>
          <option value="strong_match">Güçlü Eşleşme</option>
          <option value="semantic_match">Anlamsal</option>
          <option value="lexical_match">Leksikal</option>
          <option value="fuzzy_match">Bulanık</option>
          <option value="weak_match">Zayıf</option>
        </select>

        {/* Severity filtre */}
        <select
          value={sevFilter}
          onChange={e => setSevFilter(e.target.value)}
          style={{
            padding: "7px 12px", borderRadius: 8,
            border: "1px solid #1e293b", backgroundColor: "#020617",
            color: "#e2e8f0", fontSize: 12,
          }}
        >
          <option value="">Tüm Severity</option>
          <option value="CRITICAL">CRITICAL</option>
          <option value="HIGH">HIGH</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="LOW">LOW</option>
        </select>

        {/* Min score slider */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "#64748b" }}>Min skor:</span>
          <input
            type="range" min={0} max={1} step={0.05}
            value={minScore}
            onChange={e => setMinScore(Number(e.target.value))}
            style={{ width: 80 }}
          />
          <span style={{ fontSize: 12, color: "#f1f5f9", fontFamily: "monospace", width: 32 }}>
            {minScore.toFixed(2)}
          </span>
        </div>

        <button
          onClick={fetchResults}
          style={{
            padding: "7px 14px", borderRadius: 8,
            border: "none", backgroundColor: "#6366f1",
            color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer",
          }}
        >
          Uygula
        </button>

        <span style={{ fontSize: 12, color: "#64748b", marginLeft: "auto" }}>
          {loading ? "Yükleniyor…" : `${filtered.length} sonuç`}
        </span>
      </div>

      {/* Tablo */}
      {filtered.length > 0 ? (
        <div style={{
          borderRadius: 14,
          border: "1px solid #1e293b",
          overflow: "hidden",
          backgroundColor: "#0f172a",
        }}>
          {/* Tablo başlığı */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1.6fr 0.7fr 0.7fr 1fr 1fr 1fr",
            padding: "10px 14px",
            borderBottom: "1px solid #1e293b",
            fontSize: 11, fontWeight: 700, color: "#64748b",
            textTransform: "uppercase", letterSpacing: "0.05em",
          }}>
            <span>CVE-ID</span>
            <span style={{ textAlign: "right" }}>CASCADE</span>
            <span style={{ textAlign: "right" }}>SBERT</span>
            <span style={{ textAlign: "center" }}>LightGBM</span>
            <span style={{ textAlign: "center" }}>DistilBERT</span>
            <span style={{ textAlign: "center" }}>XGBoost</span>
          </div>

          {/* Satırlar */}
          {filtered.map((r, idx) => {
            const sevBadge = (sev: string, conf: number) => {
              const c = SEV_COLORS[sev] ?? SEV_COLORS.UNKNOWN;
              if (!sev || sev === "UNKNOWN") return <span style={{ color: "#475569", fontSize: 10 }}>—</span>;
              return (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 3,
                  padding: "2px 6px", borderRadius: 999,
                  backgroundColor: `${c}20`, color: c,
                  fontSize: 10, fontWeight: 700,
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: c, display: "inline-block" }} />
                  {sev}
                  <span style={{ opacity: 0.7, fontSize: 9 }}>{(conf * 100).toFixed(0)}%</span>
                </span>
              );
            };
            return (
              <div
                key={`${r.app_id}-${r.cve_id}-${idx}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.6fr 0.7fr 0.7fr 1fr 1fr 1fr",
                  padding: "10px 14px",
                  borderBottom: idx < filtered.length - 1 ? "1px solid #0f172a" : "none",
                  alignItems: "center",
                  fontSize: 12,
                }}
              >
                <a
                  href={`https://nvd.nist.gov/vuln/detail/${r.cve_id}`}
                  target="_blank" rel="noreferrer"
                  style={{ color: "#60a5fa", textDecoration: "none", fontFamily: "monospace", fontSize: 11 }}
                >
                  {r.cve_id}
                </a>

                <span style={{ textAlign: "right", fontFamily: "monospace", color: "#f1f5f9", fontWeight: 700 }}>
                  {(r.cascade_score * 100).toFixed(0)}%
                </span>

                <span style={{ textAlign: "right", fontFamily: "monospace", color: "#94a3b8", fontSize: 11 }}>
                  {r.sbert_score.toFixed(3)}
                </span>

                <span style={{ textAlign: "center" }}>
                  {sevBadge(r.sev_lightgbm, r.sev_lightgbm_conf)}
                </span>

                <span style={{ textAlign: "center" }}>
                  {sevBadge(r.sev_distilbert, r.sev_distilbert_conf)}
                </span>

                <span style={{ textAlign: "center" }}>
                  {sevBadge(r.sev_xgboost, r.sev_xgboost_conf)}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        !loading && (
          <div style={{
            textAlign: "center", padding: 40,
            color: "#475569", fontSize: 13,
          }}>
            Henüz ML taraması yapılmamış. Uygulama Eşleşmeleri sekmesinden bir uygulama tarayın.
          </div>
        )
      )}
    </div>
  );
}
