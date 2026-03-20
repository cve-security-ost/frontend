import React from "react";

type Props = {
  severity?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | string;
  confidence?: number;
};

export default function SeverityBadge({ severity = "UNKNOWN", confidence }: Props) {
  const colors: Record<string, string> = {
    CRITICAL: "bg-red-600",
    HIGH: "bg-orange-500",
    MEDIUM: "bg-yellow-500",
    LOW: "bg-green-500",
  };

  const conf = typeof confidence === "number" ? Math.max(0, Math.min(1, confidence)) : undefined;

  return (
    <div className="inline-flex items-center gap-2">
      <span className={`px-3 py-1 rounded text-white font-bold text-sm ${colors[severity] || "bg-gray-500"}`}>
        {severity}
      </span>

      {typeof conf === "number" && (
        <div className="flex items-center gap-1">
          <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-2 bg-blue-500 rounded-full" style={{ width: `${conf * 100}%` }} />
          </div>
          <span className="text-gray-500 text-xs">{(conf * 100).toFixed(0)}%</span>
        </div>
      )}
    </div>
  );
}
