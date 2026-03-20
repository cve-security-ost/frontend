import React from "react";

type Props = {
  type?: "exact" | "semantic" | "fuzzy" | "tfidf" | "vendor" | "hybrid" | string;
};

export default function MatchTypeIndicator({ type = "exact" }: Props) {
  const config: Record<string, { color: string; icon: string; label: string }> = {
    exact: { color: "bg-blue-500", icon: "🎯", label: "Tam Eşleşme" },
    semantic: { color: "bg-purple-500", icon: "🧠", label: "Anlamsal" },
    fuzzy: { color: "bg-orange-500", icon: "🔍", label: "Bulanık" },
    tfidf: { color: "bg-teal-500", icon: "📊", label: "TF-IDF" },
    vendor: { color: "bg-gray-500", icon: "🏢", label: "Vendor" },
    hybrid: { color: "bg-indigo-500", icon: "⚡", label: "Hibrit" },
  };

  const c = config[type] || config.exact;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-white text-xs ${c.color}`}>
      {c.icon} {c.label}
    </span>
  );
}
