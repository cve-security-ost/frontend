import React from "react";

type Props = {
  score?: number;
  type?: "sbert" | "tfidf" | "fuzzy" | "hybrid" | string;
  method?: string;
};

export default function SimilarityScoreBadge({ score = 0, type, method }: Props) {
  const resolvedType = type || method || "hybrid";
  const getColor = (s: number) => {
    if (s >= 0.7) return "bg-green-500";
    if (s >= 0.5) return "bg-yellow-500";
    if (s >= 0.3) return "bg-orange-500";
    return "bg-red-500";
  };

  const getLabel = (s: number) => {
    if (s >= 0.7) return "Yüksek Eşleşme";
    if (s >= 0.5) return "Orta Eşleşme";
    if (s >= 0.3) return "Düşük Eşleşme";
    return "Zayıf Eşleşme";
  };

  const typeLabels: Record<string, string> = {
    sbert: "SBERT",
    tfidf: "TF-IDF",
    fuzzy: "RapidFuzz",
    hybrid: "Hibrit",
  };

  return (
    <div className="inline-flex items-center gap-2">
      <span className={`px-2 py-1 rounded text-white text-xs font-medium ${getColor(score)}`}>
        {(score * 100).toFixed(0)}%
      </span>
      <span className="text-gray-400 text-xs">{getLabel(score)}</span>
      <span className="text-gray-600 text-xs bg-gray-100 px-1 rounded">
        {typeLabels[resolvedType] || resolvedType}
      </span>
    </div>
  );
}
