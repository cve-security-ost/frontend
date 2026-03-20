"use client";

/**
 * MLSearchPage.tsx — gerçek API bağlantılı versiyon
 * Mevcut MLSearchPage.jsx'in yerine geç.
 *
 * page.tsx'deki import'u güncelle:
 *   import MLSearchPage from "./components/MLSearchPage";  (değişmez)
 */

import { useState, useCallback } from "react";
import { mlMatch, mlPredictSeverity } from "../apiClient";
import type { MatchResult, SeverityResponse } from "../apiClient";
import SimilarityScoreBadge from "./SimilarityScoreBadge.jsx";
import SeverityPredictionCard from "./SeverityPredictionCard.jsx";

// match_type → frontend badge tipi
function matchTypeToBadge(matchType: string): string {
  if (matchType === "exact_cveid") return "cascade";
  if (matchType === "strong_match" || matchType === "semantic_match") return "sbert";
  if (matchType === "lexical_match") return "rapidfuzz";
  if (matchType === "fuzzy_match") return "rapidfuzz";
  return "cascade";
}

export default function MLSearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MatchResult[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [severity, setSeverity] = useState<SeverityResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [sevLoading, setSevLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queryTimeMs, setQueryTimeMs] = useState<number | null>(null);

  const selected = results.find((r) => r.cve_id === selectedId) ?? results[0] ?? null;

  const handleSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) return;

    setLoading(true);
    setError(null);
    setResults([]);
    setSeverity(null);
    setSelectedId(null);

    try {
      const data = await mlMatch(q, 10);
      setResults(data.results);
      setQueryTimeMs(data.query_time_ms);

      // İlk sonucu seç
      if (data.results.length > 0) {
        setSelectedId(data.results[0].cve_id);
      }
    } catch (e: any) {
      setError(e.message || "ML servisi yanıt vermedi");
    } finally {
      setLoading(false);
    }
  }, [query]);

  // Seçili CVE değişince severity tahmin et
  const handleSelect = useCallback(async (cveId: string, description: string) => {
    setSelectedId(cveId);
    setSeverity(null);

    if (!description) return;

    setSevLoading(true);
    try {
      const sev = await mlPredictSeverity(description, "lightgbm");
      setSeverity(sev);
    } catch {
      // severity prediction opsiyonel, hata sessiz geç
    } finally {
      setSevLoading(false);
    }
  }, []);

  return (
    <div>
      {/* Header */}
      <div style={{
        backgroundColor: "#ffffff",
        borderRadius: 18,
        padding: 20,
        border: "1px solid #e2e8f0",
        boxShadow: "0 26px 60px rgba(2,6,23,0.18)",
        marginBottom: 18,
      }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>
          🧠 ML ile CVE Ara
        </div>
        <div style={{ marginTop: 6, fontSize: 13, color: "#64748b" }}>
          CASCADE v2 — SBERT (0.85) + TF-IDF (0.15) hibrit eşleştirme
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Uygulama adı, CVE-ID veya açıklama girin…"
            style={{
              flex: "1 1 320px",
              minWidth: 240,
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              outline: "none",
              fontSize: 13,
            }}
          />
          <button
            type="button"
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            style={{
              padding: "12px 20px",
              borderRadius: 12,
              border: "none",
              backgroundColor: loading ? "#94a3b8" : "#0f172a",
              color: "white",
              fontSize: 13,
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Aranıyor…" : "Ara"}
          </button>
        </div>

        <div style={{ marginTop: 10, fontSize: 12, color: "#64748b" }}>
          {results.length > 0 && (
            <>
              <strong>{results.length}</strong> sonuç
              {queryTimeMs !== null && <> · <strong>{queryTimeMs.toFixed(0)}ms</strong></>}
            </>
          )}
        </div>

        {error && (
          <div style={{
            marginTop: 10,
            padding: "10px 14px",
            borderRadius: 10,
            backgroundColor: "rgba(239,68,68,0.1)",
            border: "1px solid #ef4444",
            color: "#ef4444",
            fontSize: 13,
          }}>
            ⚠️ {error}
          </div>
        )}
      </div>

      {/* İki kolon */}
      {results.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>

          {/* Sol: sonuç listesi */}
          <div style={{
            backgroundColor: "#ffffff",
            borderRadius: 18,
            border: "1px solid #e2e8f0",
            overflow: "hidden",
          }}>
            <div style={{
              padding: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid #e2e8f0",
            }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>Sonuçlar</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>Benzerliğe göre sıralı</div>
            </div>

            <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
              {results.map((r) => {
                const isSel = selected?.cve_id === r.cve_id;
                return (
                  <button
                    key={r.cve_id}
                    type="button"
                    onClick={() => handleSelect(r.cve_id, r.description)}
                    style={{
                      textAlign: "left",
                      width: "100%",
                      borderRadius: 14,
                      border: isSel ? "2px solid #0f172a" : "1px solid #e2e8f0",
                      backgroundColor: isSel ? "#f8fafc" : "#ffffff",
                      padding: 14,
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontSize: 12, color: "#64748b", fontFamily: "monospace" }}>
                      {r.cve_id}
                    </div>
                    <div style={{ marginTop: 6, fontSize: 13, color: "#334155", lineHeight: 1.4 }}>
                      {r.description.slice(0, 100)}…
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <SimilarityScoreBadge
                        score={r.score}
                        method={matchTypeToBadge(r.match_type)}
                      />
                    </div>
                    <div style={{ marginTop: 8, fontSize: 11, color: "#94a3b8" }}>
                      S:{r.sbert_score.toFixed(3)} · T:{r.tfidf_score.toFixed(3)} · F:{r.fuzzy_score.toFixed(3)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sağ: detay + severity */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {selected && (
              <div style={{
                backgroundColor: "#ffffff",
                borderRadius: 18,
                border: "1px solid #e2e8f0",
                padding: 16,
              }}>
                <div style={{ fontSize: 14, color: "#64748b", marginBottom: 6 }}>Seçili CVE</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", fontFamily: "monospace" }}>
                  {selected.cve_id}
                </div>
                <div style={{ marginTop: 10, fontSize: 13, color: "#334155", lineHeight: 1.6 }}>
                  {selected.description}
                </div>
                <div style={{ marginTop: 12 }}>
                  <SimilarityScoreBadge
                    score={selected.score}
                    method={matchTypeToBadge(selected.match_type)}
                  />
                </div>
                <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <span style={{
                    padding: "6px 10px", borderRadius: 999,
                    border: "1px solid #e2e8f0", backgroundColor: "#f8fafc",
                    fontSize: 12, color: "#0f172a",
                  }}>
                    Layer: <strong>{selected.layer}</strong>
                  </span>
                  <span style={{
                    padding: "6px 10px", borderRadius: 999,
                    border: "1px solid #e2e8f0", backgroundColor: "#f8fafc",
                    fontSize: 12, color: "#0f172a",
                  }}>
                    Match: <strong>{selected.match_type.replace("_", " ")}</strong>
                  </span>
                </div>
              </div>
            )}

            <SeverityPredictionCard
              severity={sevLoading ? undefined : severity?.predicted_severity}
              confidence={severity?.confidence}
              modelName={severity?.model_used ?? "LightGBM v2"}
              subtitle={sevLoading ? "Tahmin ediliyor…" : "Model çıktısı (v2 features)"}
            />
          </div>
        </div>
      )}

      {/* Boş durum */}
      {!loading && results.length === 0 && !error && (
        <div style={{
          textAlign: "center", padding: 60,
          color: "#94a3b8", fontSize: 14,
        }}>
          Yukarıdaki kutuya uygulama adı, CVE-ID veya açıklama girin
        </div>
      )}
    </div>
  );
}
