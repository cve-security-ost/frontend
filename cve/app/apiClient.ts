/**
 * apiClient.ts
 * Repodaki cve/app/ klasörüne koy, import ederek kullan.
 *
 * Kullanım:
 *   import { mlMatch, mlPredictSeverity, fetchStats } from "./apiClient";
 *
 *   const results = await mlMatch("Apache Log4j", 10);
 *   const severity = await mlPredictSeverity("Buffer overflow allows RCE");
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

// ══════════════════════════════════════════════════════════════
//  Types
// ══════════════════════════════════════════════════════════════

export type MatchResult = {
  cve_id: string;
  description: string;
  score: number;          // 0-1 arası cascade_score
  match_type:             // CASCADE katmanı
    | "exact_cveid"
    | "strong_match"
    | "semantic_match"
    | "lexical_match"
    | "fuzzy_match"
    | "weak_match"
    | "sbert_fallback";
  layer: number;
  sbert_score: number;
  tfidf_score: number;
  fuzzy_score: number;
};

export type MatchResponse = {
  query: string;
  total: number;
  query_time_ms: number;
  results: MatchResult[];
  error?: string;
};

export type SeverityResponse = {
  predicted_severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "UNKNOWN";
  confidence: number;     // 0-1
  probabilities: {
    LOW: number;
    MEDIUM: number;
    HIGH: number;
    CRITICAL: number;
  };
  model_used: string;
  prediction_time_ms: number;
};

// ══════════════════════════════════════════════════════════════
//  ML Endpoints
// ══════════════════════════════════════════════════════════════

/**
 * CASCADE hybrid matching — ML ile CVE ara
 * Go backend /api/ml/match → FastAPI /ml/match
 */
export async function mlMatch(
  query: string,
  topK = 10
): Promise<MatchResponse> {
  const res = await fetch(`${API_BASE}/ml/match`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, top_k: topK }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ML match failed (${res.status}): ${err}`);
  }

  return res.json();
}

/**
 * Severity tahmini — CVE description'ından severity tahmin et
 * Go backend /api/ml/predict-severity → FastAPI /ml/predict-severity
 */
export async function mlPredictSeverity(
  description: string,
  modelType?: "lightgbm" | "xgboost" | "distilbert" | "ensemble"
): Promise<SeverityResponse> {
  const res = await fetch(`${API_BASE}/ml/predict-severity`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description, model_type: modelType }),
  });

  if (!res.ok) {
    throw new Error(`Severity prediction failed (${res.status})`);
  }

  return res.json();
}

// ══════════════════════════════════════════════════════════════
//  Mevcut Go Backend Endpoints
// ══════════════════════════════════════════════════════════════

export async function fetchStats() {
  const res = await fetch(`${API_BASE}/stats`);
  if (!res.ok) throw new Error("Stats fetch failed");
  return res.json();
}

export async function fetchCVEs(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  severity?: string;
}) {
  const q = new URLSearchParams();
  if (params.page) q.set("page", String(params.page));
  if (params.pageSize) q.set("page_size", String(params.pageSize));
  if (params.search) q.set("search", params.search);
  if (params.severity) q.set("severity", params.severity);

  const res = await fetch(`${API_BASE}/cves?${q}`);
  if (!res.ok) throw new Error("CVE fetch failed");
  return res.json();
}

export async function fetchMatchingApps(params: {
  page?: number;
  pageSize?: number;
  filter?: string;
}) {
  const q = new URLSearchParams();
  if (params.page) q.set("page", String(params.page));
  if (params.pageSize) q.set("page_size", String(params.pageSize));
  if (params.filter) q.set("filter", params.filter);

  const res = await fetch(`${API_BASE}/matching/apps?${q}`);
  if (!res.ok) throw new Error("Matching apps fetch failed");
  return res.json();
}

export async function fetchAppDetail(appId: string) {
  const res = await fetch(`${API_BASE}/matching/apps/${appId}`);
  if (!res.ok) throw new Error(`App detail fetch failed for ${appId}`);
  return res.json();
}
