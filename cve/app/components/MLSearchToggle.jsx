"use client";

export default function MLSearchToggle({ enabled, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      aria-pressed={enabled}
      style={{
        width: 56,
        height: 32,
        borderRadius: 999,
        border: "1px solid #1e293b",
        backgroundColor: enabled ? "rgba(79,70,229,0.9)" : "#0b1220",
        position: "relative",
        cursor: "pointer",
        transition: "background-color 150ms ease",
      }}
      title={enabled ? "AI Arama Açık" : "AI Arama Kapalı"}
    >
      <span
        style={{
          position: "absolute",
          top: 4,
          left: enabled ? 28 : 4,
          width: 24,
          height: 24,
          borderRadius: 999,
          backgroundColor: "#ffffff",
          transition: "left 150ms ease",
          boxShadow: "0 8px 20px rgba(0,0,0,0.35)",
        }}
      />
    </button>
  );
}