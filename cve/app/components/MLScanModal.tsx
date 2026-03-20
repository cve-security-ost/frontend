"use client";

/**
 * MLScanModal.tsx
 * Konum: cve/app/components/MLScanModal.tsx
 *
 * Kullanım (page.tsx'de):
 *   import MLScanModal from "./components/MLScanModal";
 *
 *   const [scanApp, setScanApp] = useState<{id: string; name: string} | null>(null);
 *
 *   // Uygulama kartındaki "CVE Tarama Başlat" butonuna:
 *   onClick={() => setScanApp({ id: app.app_id, name: app.app_name })}
 *
 *   // JSX'e ekle:
 *   {scanApp && (
 *     <MLScanModal
 *       appId={scanApp.id}
 *       appName={scanApp.name}
 *       onClose={() => setScanApp(null)}
 *       onDone={() => { setScanApp(null); refetchResults(); }}
 *     />
 *   )}
 */

import { useEffect, useRef, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

// ── Tipler ────────────────────────────────────────────────────

type StageId = "sbert" | "tfidf" | "rerank" | "severity" | "save" | "done" | "error";
type StageStatus = "waiting" | "running" | "done" | "error";

type StageState = {
  status: StageStatus;
  count: number;
  message: string;
};

const STAGE_CONFIG: { id: StageId; label: string; icon: string; desc: string }[] = [
  { id: "sbert",  label: "SBERT",         icon: "🧠", desc: "Semantik benzerlik — all-MiniLM-L6-v2" },
  { id: "tfidf",  label: "TF-IDF",         icon: "📊", desc: "Leksikal eşleştirme" },
  { id: "rerank", label: "CASCADE Rerank", icon: "🔗", desc: "0.85×SBERT + 0.15×TF-IDF hibrit skor" },
  { id: "severity", label: "Severity Tahmin", icon: "⚡", desc: "LightGBM ile severity prediction" },
  { id: "save",   label: "DB Kayıt",       icon: "💾", desc: "Sonuçlar veritabanına yazılıyor" },
];

const initialStages = (): Record<StageId, StageState> => ({
  sbert:  { status: "waiting", count: 0, message: "" },
  tfidf:  { status: "waiting", count: 0, message: "" },
  rerank:   { status: "waiting", count: 0, message: "" },
  severity: { status: "waiting", count: 0, message: "" },
  save:     { status: "waiting", count: 0, message: "" },
  done:   { status: "waiting", count: 0, message: "" },
  error:  { status: "waiting", count: 0, message: "" },
});

// ── Yardımcılar ───────────────────────────────────────────────

function statusColor(s: StageStatus) {
  if (s === "done")    return "#22c55e";
  if (s === "running") return "#6366f1";
  if (s === "error")   return "#ef4444";
  return "#475569";
}

function statusBg(s: StageStatus) {
  if (s === "done")    return "rgba(34,197,94,0.1)";
  if (s === "running") return "rgba(99,102,241,0.15)";
  if (s === "error")   return "rgba(239,68,68,0.1)";
  return "rgba(71,85,105,0.08)";
}

function StatusIcon({ status }: { status: StageStatus }) {
  if (status === "done")    return <span style={{ color: "#22c55e" }}>✓</span>;
  if (status === "error")   return <span style={{ color: "#ef4444" }}>✗</span>;
  if (status === "running") return <Spinner />;
  return <span style={{ color: "#475569" }}>○</span>;
}

function Spinner() {
  return (
    <span style={{
      display: "inline-block",
      width: 14, height: 14,
      border: "2px solid #6366f1",
      borderTopColor: "transparent",
      borderRadius: "50%",
      animation: "spin 0.7s linear infinite",
    }} />
  );
}

// ── Ana Bileşen ───────────────────────────────────────────────

export default function MLScanModal({
  appId,
  appName,
  onClose,
  onDone,
}: {
  appId: string;
  appName: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [stages, setStages]     = useState<Record<StageId, StageState>>(initialStages);
  const [scanning, setScanning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [finalCount, setFinalCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(true);
  const logEndRef = useRef<HTMLDivElement | null>(null);
  const esRef = useRef<EventSource | null>(null);

  // Temizle
  useEffect(() => () => { esRef.current?.close(); }, []);

  // Log auto-scroll
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs]);

  function startScan() {
    setStages(initialStages());
    setFinished(false);
    setErrorMsg(null);
    setLogs([]);
    setScanning(true);

    // SSE bağlantısı — POST isteği açar, backend SSE akışı döner
    // Not: EventSource GET olduğu için fetch + ReadableStream kullanıyoruz
    const ctrl = new AbortController();

    fetch(`${API_BASE}/ml/scan/${appId}`, {
      method: "POST",
      signal: ctrl.signal,
    }).then(async (res) => {
      if (!res.ok) {
        setErrorMsg(`Sunucu hatası: ${res.status}`);
        setScanning(false);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const chunk of lines) {
          const dataLine = chunk.split("\n").find(l => l.startsWith("data: "));
          if (!dataLine) continue;

          try {
            const evt = JSON.parse(dataLine.slice(6));
            const { stage, status, count, message } = evt;

            if (stage === "log") {
              setLogs(prev => [...prev, message]);
            } else if (stage === "done") {
              setFinalCount(count);
              setFinished(true);
              setScanning(false);
            } else if (stage === "error") {
              setErrorMsg(message);
              setScanning(false);
              setStages(prev => ({
                ...prev,
                error: { status: "error", count: 0, message },
              }));
            } else {
              setStages(prev => ({
                ...prev,
                [stage]: { status, count, message },
              }));
            }
          } catch {
            // JSON parse hatası — yoksay
          }
        }
      }
    }).catch(e => {
      if (e.name !== "AbortError") {
        setErrorMsg(e.message);
        setScanning(false);
      }
    });

    esRef.current = { close: () => ctrl.abort() } as any;
  }

  return (
    <>
      {/* Spin keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          backgroundColor: "rgba(2,6,23,0.7)",
          backdropFilter: "blur(4px)",
          zIndex: 100,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {/* Modal */}
        <div
          onClick={e => e.stopPropagation()}
          style={{
            width: "min(520px, 95vw)",
            backgroundColor: "#0f172a",
            borderRadius: 20,
            border: "1px solid #1e293b",
            boxShadow: "0 40px 80px rgba(0,0,0,0.6)",
            overflow: "hidden",
          }}
        >
          {/* Başlık */}
          <div style={{
            padding: "18px 20px",
            borderBottom: "1px solid #1e293b",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#f1f5f9" }}>
                🔍 ML CVE Taraması
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                {appName} · <span style={{ fontFamily: "monospace" }}>{appId}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={scanning}
              style={{
                padding: "4px 10px", borderRadius: 8,
                border: "1px solid #1e293b",
                backgroundColor: "transparent",
                color: "#94a3b8", cursor: scanning ? "not-allowed" : "pointer",
                fontSize: 12,
              }}
            >
              ✕
            </button>
          </div>

          {/* Stage'ler */}
          <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
            {STAGE_CONFIG.map(({ id, label, icon, desc }) => {
              const s = stages[id];
              return (
                <div
                  key={id}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: `1px solid ${s.status !== "waiting" ? statusColor(s.status) + "40" : "#1e293b"}`,
                    backgroundColor: statusBg(s.status),
                    display: "flex", alignItems: "center", gap: 14,
                    transition: "all 0.25s ease",
                  }}
                >
                  <div style={{ fontSize: 22, width: 32, textAlign: "center" }}>{icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 700,
                      color: s.status === "waiting" ? "#475569" : "#f1f5f9",
                    }}>
                      {label}
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                      {s.message || desc}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {s.status === "done" && s.count > 0 && (
                      <span style={{
                        padding: "2px 8px", borderRadius: 999,
                        backgroundColor: "rgba(34,197,94,0.15)",
                        color: "#22c55e", fontSize: 11, fontWeight: 700,
                      }}>
                        {s.count} sonuç
                      </span>
                    )}
                    <div style={{ width: 20, display: "flex", justifyContent: "center" }}>
                      <StatusIcon status={s.status} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Log Paneli */}
          {logs.length > 0 && (
            <div style={{ margin: "0 20px 12px" }}>
              <button
                onClick={() => setShowLogs(prev => !prev)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "6px 0", border: "none", backgroundColor: "transparent",
                  color: "#64748b", fontSize: 11, cursor: "pointer", fontWeight: 600,
                }}
              >
                <span style={{ transform: showLogs ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s", display: "inline-block" }}>▶</span>
                Terminal Çıktısı ({logs.length} satır)
              </button>
              {showLogs && (
                <div style={{
                  maxHeight: 180, overflowY: "auto",
                  padding: "10px 12px",
                  borderRadius: 10,
                  backgroundColor: "#020617",
                  border: "1px solid #1e293b",
                  fontFamily: "'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace",
                  fontSize: 11, lineHeight: 1.7,
                  color: "#94a3b8",
                }}>
                  {logs.map((line, i) => (
                    <div key={i} style={{
                      color: line.includes("HATA") ? "#ef4444"
                        : line.includes("tamamlandı") || line.includes("başarılı") ? "#22c55e"
                        : line.includes("→") || line.includes("#") ? "#6366f1"
                        : "#94a3b8",
                    }}>
                      {line}
                    </div>
                  ))}
                  <div ref={logEndRef} />
                </div>
              )}
            </div>
          )}

          {/* Hata */}
          {errorMsg && (
            <div style={{
              margin: "0 20px 12px",
              padding: "10px 14px",
              borderRadius: 10,
              backgroundColor: "rgba(239,68,68,0.1)",
              border: "1px solid #ef4444",
              color: "#ef4444", fontSize: 12,
            }}>
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Tamamlandı bandı */}
          {finished && (
            <div style={{
              margin: "0 20px 12px",
              padding: "12px 14px",
              borderRadius: 12,
              backgroundColor: "rgba(34,197,94,0.1)",
              border: "1px solid #22c55e",
              color: "#22c55e",
              fontSize: 13, fontWeight: 700,
              textAlign: "center",
            }}>
              ✓ Tarama tamamlandı — {finalCount} CVE eşleşmesi bulundu ve kaydedildi
            </div>
          )}

          {/* Butonlar */}
          <div style={{
            padding: "14px 20px",
            borderTop: "1px solid #1e293b",
            display: "flex", gap: 10, justifyContent: "flex-end",
          }}>
            {!scanning && !finished && (
              <button
                onClick={startScan}
                style={{
                  padding: "10px 20px", borderRadius: 10,
                  border: "none",
                  backgroundColor: "#6366f1",
                  color: "white", fontWeight: 700, fontSize: 13,
                  cursor: "pointer",
                }}
              >
                🚀 Taramayı Başlat
              </button>
            )}
            {finished && (
              <button
                onClick={onDone}
                style={{
                  padding: "10px 20px", borderRadius: 10,
                  border: "none",
                  backgroundColor: "#22c55e",
                  color: "white", fontWeight: 700, fontSize: 13,
                  cursor: "pointer",
                }}
              >
                ✓ Sonuçları Gör
              </button>
            )}
            <button
              onClick={onClose}
              disabled={scanning}
              style={{
                padding: "10px 16px", borderRadius: 10,
                border: "1px solid #1e293b",
                backgroundColor: "transparent",
                color: "#94a3b8",
                cursor: scanning ? "not-allowed" : "pointer",
                fontSize: 13,
              }}
            >
              Kapat
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
