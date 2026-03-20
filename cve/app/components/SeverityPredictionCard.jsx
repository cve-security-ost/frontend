"use client";

function sevStyle(sev) {
  const s = (sev || "").toUpperCase();
  if (s === "CRITICAL") return { bg: "rgba(239,68,68,0.12)", border: "#ef4444", text: "#ef4444" };
  if (s === "HIGH") return { bg: "rgba(249,115,22,0.12)", border: "#f97316", text: "#f97316" };
  if (s === "MEDIUM") return { bg: "rgba(234,179,8,0.12)", border: "#eab308", text: "#eab308" };
  if (s === "LOW") return { bg: "rgba(34,197,94,0.12)", border: "#22c55e", text: "#22c55e" };
  return { bg: "rgba(148,163,184,0.12)", border: "#94a3b8", text: "#94a3b8" };
}

export default function SeverityPredictionCard({
  severity,
  confidence, // 0..1
  modelName = "LightGBM Severity v2 (tuned)",
  subtitle = "Model output (v2 features aligned)",
}) {
  const conf = typeof confidence === "number" ? Math.max(0, Math.min(1, confidence)) : 0;
  const pct = Math.round(conf * 100);
  const st = sevStyle(severity);

  return (
    <div
      style={{
        borderRadius: 16,
        border: "1px solid #e2e8f0",
        backgroundColor: "#ffffff",
        boxShadow: "0 20px 45px rgba(2,6,23,0.12)",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: 16, display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16 }}>🧪</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
              Tahmin Edilen Severity
            </span>
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>{subtitle}</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>
            Model: <span style={{ fontWeight: 600 }}>{modelName}</span>
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "6px 12px",
              borderRadius: 999,
              border: `1px solid ${st.border}`,
              backgroundColor: st.bg,
              color: st.text,
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            {String(severity || "UNKNOWN").toUpperCase()}
          </span>
          <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>{pct}% güven</div>
        </div>
      </div>

      <div style={{ padding: "0 16px 16px" }}>
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>Confidence</div>
        <div
          style={{
            height: 10,
            borderRadius: 999,
            backgroundColor: "#e2e8f0",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              backgroundColor: st.border,
            }}
          />
        </div>
      </div>
    </div>
  );
}