"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

type ScanApp = { name: string; version: string };
type Step = "input" | "progress" | "results";

type CVEResult = {
  cve_id: string;
  description: string;
  severity: string;
  cvss_score: number;
  predicted_severity_lgbm: string;
  predicted_severity_distilbert: string;
  predicted_severity_xgb: string;
};

type AppResult = {
  app_name: string;
  version: string;
  cves_found: number;
  max_severity: string;
  cves: CVEResult[];
};

type StatusResponse = {
  job_id: string;
  status: string;
  progress: number;
  app_count: number;
  results?: AppResult[];
};

function severityColor(sev: string) {
  switch (sev) {
    case "CRITICAL":
      return { bg: "rgba(239,68,68,0.15)", text: "#fecaca", border: "#ef4444" };
    case "HIGH":
      return { bg: "rgba(249,115,22,0.15)", text: "#fed7aa", border: "#f97316" };
    case "MEDIUM":
      return { bg: "rgba(234,179,8,0.15)", text: "#fef9c3", border: "#eab308" };
    case "LOW":
      return { bg: "rgba(34,197,94,0.15)", text: "#bbf7d0", border: "#22c55e" };
    case "NONE":
      return { bg: "rgba(107,114,128,0.15)", text: "#e5e7eb", border: "#6b7280" };
    default:
      return { bg: "rgba(107,114,128,0.15)", text: "#e5e7eb", border: "#6b7280" };
  }
}

export default function ScannerPage() {
  const [step, setStep] = useState<Step>("input");
  const [apps, setApps] = useState<ScanApp[]>([{ name: "", version: "" }]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [results, setResults] = useState<AppResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [expandedApps, setExpandedApps] = useState<Set<number>>(new Set());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const addApp = () => {
    if (apps.length >= 20) return;
    setApps([...apps, { name: "", version: "" }]);
  };

  const removeApp = (index: number) => {
    if (apps.length <= 1) return;
    setApps(apps.filter((_, i) => i !== index));
  };

  const updateApp = (index: number, field: "name" | "version", value: string) => {
    const updated = [...apps];
    updated[index] = { ...updated[index], [field]: value };
    setApps(updated);
  };

  const toggleExpand = (index: number) => {
    const next = new Set(expandedApps);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setExpandedApps(next);
  };

  const pollStatus = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/scan/status/${id}`);
      if (!res.ok) throw new Error("Status fetch failed");
      const data = (await res.json()) as StatusResponse;
      setProgress(data.progress);
      setStatus(data.status);

      if (data.status === "completed") {
        if (pollRef.current) clearInterval(pollRef.current);
        // Fetch full results
        const resResults = await fetch(`${API_BASE_URL}/scan/results/${id}`);
        if (resResults.ok) {
          const resultData = await resResults.json();
          setResults(resultData.apps || []);
        } else if (data.results) {
          setResults(data.results);
        }
        setStep("results");
      } else if (data.status === "failed") {
        if (pollRef.current) clearInterval(pollRef.current);
        setError("Tarama başarısız oldu. Lütfen tekrar deneyin.");
        setStep("input");
      }
    } catch {
      // Keep polling on transient errors
    }
  }, []);

  const handleSubmit = async () => {
    const validApps = apps.filter((a) => a.name.trim() !== "");
    if (validApps.length === 0) {
      setError("En az bir uygulama adı girin.");
      return;
    }

    setError(null);
    setSubmitLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/scan/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apps: validApps }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Submit failed");
      }

      const data = await res.json();
      setJobId(data.job_id);
      setProgress(0);
      setStatus("queued");
      setStep("progress");

      // Start polling every 2 seconds
      pollRef.current = setInterval(() => pollStatus(data.job_id), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Bağlantı hatası");
    } finally {
      setSubmitLoading(false);
    }
  };

  const resetScan = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setStep("input");
    setApps([{ name: "", version: "" }]);
    setJobId(null);
    setProgress(0);
    setResults([]);
    setError(null);
    setExpandedApps(new Set());
  };

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // ---- RENDER: INPUT STEP ----
  const renderInput = () => (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
        Sistem Güvenlik Tarayıcısı
      </h1>
      <p style={{ color: "#94a3b8", marginBottom: 24 }}>
        Uygulamalarınızı girin, CVE veritabanında tarama yapalım ve ML modelleriyle severity tahminleyelim.
      </p>

      {error && (
        <div style={{ background: "rgba(239,68,68,0.15)", border: "1px solid #ef4444", borderRadius: 8, padding: "10px 16px", marginBottom: 16, color: "#fecaca" }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
        {apps.map((app, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ color: "#64748b", fontSize: 14, minWidth: 24 }}>{i + 1}.</span>
            <input
              type="text"
              placeholder="Uygulama adı (örn. Google Chrome)"
              value={app.name}
              onChange={(e) => updateApp(i, "name", e.target.value)}
              style={{
                flex: 2,
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #334155",
                backgroundColor: "#0f172a",
                color: "white",
                fontSize: 14,
                outline: "none",
              }}
            />
            <input
              type="text"
              placeholder="Versiyon (örn. 120.0)"
              value={app.version}
              onChange={(e) => updateApp(i, "version", e.target.value)}
              style={{
                flex: 1,
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #334155",
                backgroundColor: "#0f172a",
                color: "white",
                fontSize: 14,
                outline: "none",
              }}
            />
            {apps.length > 1 && (
              <button
                onClick={() => removeApp(i)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #7f1d1d",
                  backgroundColor: "rgba(239,68,68,0.1)",
                  color: "#fca5a5",
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                Sil
              </button>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 32 }}>
        {apps.length < 20 && (
          <button
            onClick={addApp}
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              border: "1px solid #334155",
              backgroundColor: "transparent",
              color: "#e2e8f0",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            + Uygulama Ekle
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={submitLoading}
          style={{
            padding: "10px 28px",
            borderRadius: 8,
            border: "none",
            backgroundColor: submitLoading ? "#4338ca" : "#4f46e5",
            color: "white",
            cursor: submitLoading ? "not-allowed" : "pointer",
            fontSize: 14,
            fontWeight: 600,
            opacity: submitLoading ? 0.7 : 1,
          }}
        >
          {submitLoading ? "Gönderiliyor..." : "Taramayı Başlat"}
        </button>
      </div>
    </div>
  );

  // ---- RENDER: PROGRESS STEP ----
  const renderProgress = () => (
    <div style={{ textAlign: "center", paddingTop: 60 }}>
      <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>
        Tarama Devam Ediyor...
      </h2>
      <p style={{ color: "#94a3b8", marginBottom: 8 }}>
        Job ID: <span style={{ fontFamily: "monospace", color: "#e2e8f0" }}>{jobId}</span>
      </p>
      <p style={{ color: "#94a3b8", marginBottom: 32 }}>
        Durum: <span style={{ color: status === "processing" ? "#4ade80" : "#facc15" }}>
          {status === "queued" ? "Kuyrukta" : status === "processing" ? "İşleniyor" : status}
        </span>
      </p>

      {/* Progress bar */}
      <div style={{
        maxWidth: 500,
        margin: "0 auto",
        backgroundColor: "#1e293b",
        borderRadius: 999,
        height: 24,
        overflow: "hidden",
        marginBottom: 12,
      }}>
        <div style={{
          height: "100%",
          width: `${progress}%`,
          backgroundColor: "#4f46e5",
          borderRadius: 999,
          transition: "width 0.5s ease",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          fontWeight: 600,
          color: "white",
          minWidth: progress > 5 ? undefined : 0,
        }}>
          {progress > 5 && `${progress}%`}
        </div>
      </div>
      <p style={{ color: "#64748b", fontSize: 13 }}>
        Her 2 saniyede durum kontrol ediliyor...
      </p>
    </div>
  );

  // ---- RENDER: RESULTS STEP ----
  const renderResults = () => (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 4 }}>
            Tarama Sonuçları
          </h2>
          <p style={{ color: "#94a3b8", fontSize: 14 }}>
            {results.length} uygulama tarandı &mdash; {results.reduce((s, r) => s + r.cves_found, 0)} CVE bulundu
          </p>
        </div>
        <button
          onClick={resetScan}
          style={{
            padding: "10px 20px",
            borderRadius: 8,
            border: "none",
            backgroundColor: "#4f46e5",
            color: "white",
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Yeni Tarama
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {results.map((app, appIdx) => {
          const sevColor = severityColor(app.max_severity);
          const isExpanded = expandedApps.has(appIdx);

          return (
            <div
              key={appIdx}
              style={{
                border: `1px solid ${sevColor.border}33`,
                borderRadius: 12,
                backgroundColor: "#0f172a",
                overflow: "hidden",
              }}
            >
              {/* App header */}
              <div
                onClick={() => app.cves_found > 0 && toggleExpand(appIdx)}
                style={{
                  padding: "16px 20px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  cursor: app.cves_found > 0 ? "pointer" : "default",
                  borderBottom: isExpanded ? "1px solid #1e293b" : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>
                      {app.app_name}
                      {app.version && (
                        <span style={{ color: "#64748b", fontWeight: 400, marginLeft: 8, fontSize: 13 }}>
                          v{app.version}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 2 }}>
                      {app.cves_found} CVE bulundu
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {/* Severity badge */}
                  <span style={{
                    padding: "4px 12px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 600,
                    backgroundColor: sevColor.bg,
                    color: sevColor.text,
                    border: `1px solid ${sevColor.border}66`,
                  }}>
                    {app.max_severity}
                  </span>
                  {app.cves_found > 0 && (
                    <span style={{ color: "#64748b", fontSize: 18 }}>
                      {isExpanded ? "\u25B2" : "\u25BC"}
                    </span>
                  )}
                </div>
              </div>

              {/* Expanded CVE list */}
              {isExpanded && app.cves && (
                <div style={{ padding: "0 20px 16px" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #1e293b", color: "#64748b" }}>
                        <th style={{ textAlign: "left", padding: "10px 8px" }}>CVE ID</th>
                        <th style={{ textAlign: "left", padding: "10px 8px" }}>Açıklama</th>
                        <th style={{ textAlign: "center", padding: "10px 8px" }}>CVSS</th>
                        <th style={{ textAlign: "center", padding: "10px 8px" }}>Severity</th>
                        <th style={{ textAlign: "center", padding: "10px 8px" }}>LightGBM</th>
                        <th style={{ textAlign: "center", padding: "10px 8px" }}>DistilBERT</th>
                        <th style={{ textAlign: "center", padding: "10px 8px" }}>XGBoost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {app.cves.map((cve, cveIdx) => {
                        const cveSev = severityColor(cve.severity || "UNKNOWN");
                        return (
                          <tr key={cveIdx} style={{ borderBottom: "1px solid #1e293b22" }}>
                            <td style={{ padding: "8px", whiteSpace: "nowrap" }}>
                              <a
                                href={`https://nvd.nist.gov/vuln/detail/${cve.cve_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: "#60a5fa", textDecoration: "none" }}
                              >
                                {cve.cve_id}
                              </a>
                            </td>
                            <td style={{ padding: "8px", color: "#cbd5e1", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {cve.description ? cve.description.slice(0, 120) + (cve.description.length > 120 ? "..." : "") : "N/A"}
                            </td>
                            <td style={{ padding: "8px", textAlign: "center", fontWeight: 600 }}>
                              {cve.cvss_score ? cve.cvss_score.toFixed(1) : "N/A"}
                            </td>
                            <td style={{ textAlign: "center", padding: "8px" }}>
                              <span style={{
                                padding: "2px 8px",
                                borderRadius: 999,
                                fontSize: 11,
                                backgroundColor: cveSev.bg,
                                color: cveSev.text,
                              }}>
                                {cve.severity || "UNKNOWN"}
                              </span>
                            </td>
                            <td style={{ textAlign: "center", padding: "8px" }}>
                              <MLBadge severity={cve.predicted_severity_lgbm} />
                            </td>
                            <td style={{ textAlign: "center", padding: "8px" }}>
                              <MLBadge severity={cve.predicted_severity_distilbert} />
                            </td>
                            <td style={{ textAlign: "center", padding: "8px" }}>
                              <MLBadge severity={cve.predicted_severity_xgb} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#020617",
        color: "white",
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      {/* Header */}
      <header
        style={{
          borderBottom: "1px solid #1e293b",
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          backdropFilter: "blur(8px)",
          backgroundColor: "rgba(15,23,42,0.9)",
          zIndex: 10,
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>
            🛡️ Sistem Güvenlik Tarayıcısı
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>
            Uygulama CVE Tarama &amp; ML Şiddet Tahmini
          </div>
        </div>
        <Link
          href="/"
          style={{
            padding: "6px 16px",
            borderRadius: 999,
            border: "1px solid #334155",
            color: "#e2e8f0",
            textDecoration: "none",
            fontSize: 13,
          }}
        >
          ← Ana Sayfa
        </Link>
      </header>

      {/* Content */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px 48px" }}>
        {step === "input" && renderInput()}
        {step === "progress" && renderProgress()}
        {step === "results" && renderResults()}
      </section>
    </main>
  );
}

// ML severity badge component
function MLBadge({ severity }: { severity: string }) {
  if (!severity || severity === "UNKNOWN") {
    return <span style={{ color: "#64748b", fontSize: 11 }}>-</span>;
  }
  const c = severityColor(severity);
  return (
    <span style={{
      padding: "2px 8px",
      borderRadius: 999,
      fontSize: 11,
      backgroundColor: c.bg,
      color: c.text,
    }}>
      {severity}
    </span>
  );
}
