import React from "react";

/**
 * MatchTypeIndicator
 * type: 'exact' | 'semantic' | 'fuzzy' | 'tfidf' | 'vendor' | 'hybrid'
 */
const MatchTypeIndicator = ({ type = "exact", className = "" }) => {
  const config = {
    exact:   { label: "Tam Eşleşme", icon: "🎯", bg: "bg-blue-600" },
    semantic:{ label: "Anlamsal",    icon: "🧠", bg: "bg-purple-600" },
    fuzzy:   { label: "Bulanık",     icon: "🔎", bg: "bg-orange-600" },
    tfidf:   { label: "TF-IDF",      icon: "📊", bg: "bg-teal-600" },
    vendor:  { label: "Vendor",      icon: "🏢", bg: "bg-gray-600" },
    hybrid:  { label: "Hibrit",      icon: "⚡", bg: "bg-indigo-600" },
  };

  const c = config[type] || config.exact;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-white text-xs font-medium ${c.bg} ${className}`}
      title={`Match Type: ${type}`}
    >
      <span aria-hidden="true">{c.icon}</span>
      <span>{c.label}</span>
    </span>
  );
};

export default MatchTypeIndicator;