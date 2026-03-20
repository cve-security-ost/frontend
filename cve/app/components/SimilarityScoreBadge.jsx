"use client";

const METHOD_MAP = {
  sbert: { icon: "🧠", label: "SBERT" },
  rapidfuzz: { icon: "⚡", label: "RapidFuzz" },
  cascade: { icon: "🔗", label: "CASCADE" },
};

function scoreLabel(scorePct) {
  if (scorePct >= 90) return "Yüksek Eşleşme";
  if (scorePct >= 70) return "Orta Eşleşme";
  if (scorePct >= 55) return "Düşük Eşleşme";
  return "Zayıf";
}

export default function SimilarityScoreBadge({ score, method }) {
  // score 0-1 gelirse %'ye çevir, score 0-100 gelirse olduğu gibi kullan
  const pct =
    typeof score === "number"
      ? Math.max(0, Math.min(100, score <= 1 ? Math.round(score * 100) : Math.round(score)))
      : 0;

  const key = String(method || "").toLowerCase().trim();
  const meta = METHOD_MAP[key] || { icon: "🔎", label: String(method || "Match") };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span
        style={{
          padding: "4px 8px",
          borderRadius: 8,
          backgroundColor: "#16a34a",
          color: "white",
          fontSize: 12,
          fontWeight: 700,
          minWidth: 44,
          textAlign: "center",
        }}
      >
        {pct}%
      </span>

      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
        <span style={{ fontSize: 12, color: "#64748b" }}>{scoreLabel(pct)}</span>
      </div>

      <span
        style={{
          marginLeft: 8,
          padding: "3px 8px",
          borderRadius: 999,
          border: "1px solid #e2e8f0",
          backgroundColor: "#f8fafc",
          fontSize: 12,
          color: "#0f172a",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          whiteSpace: "nowrap",
        }}
        title={meta.label}
      >
        <span>{meta.icon}</span>
        <span style={{ fontWeight: 600 }}>{meta.label}</span>
      </span>
    </div>
  );
}