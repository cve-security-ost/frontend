"use client";

import {
  useEffect,
  useState,
  useCallback,
  type KeyboardEvent,
} from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import MLScanModal from "./components/MLScanModal";
import MLResultsView from "./components/MLResultsView";

/* ==========================
   Tür tanımları
========================== */

type TabId = "dashboard" | "search" | "critical" | "matching" | "ml_results";

type SeverityItem = {
  severity: string;
  count: number;
};

type StatsResponse = {
  total_cves: number;
  severity_distribution: SeverityItem[];
};

type MatchingApp = {
  app_id: string;
  app_name: string;
  exact_match_count: number;
  fuzzy_match_count: number;
  semantic_match_count: number;
  vendor_match_count: number;
  has_exact_match: boolean;
  has_fuzzy_match: boolean;
  has_semantic_match: boolean;
  has_vendor_match: boolean;
};

type MatchingFilter = "all" | "exact" | "fuzzy" | "semantic" | "vendor" | "none";

/** Arama / kritik listelerinde kullanılan ortak CVE satırı tipi */
type CveListItem = {
  cve_id: string;
  vendor: string;
  product: string;
  cvss_score: number | string | undefined;
  severity: string;
  score: number | string | undefined; // Relevance / önem skoru
};

type SearchItem = CveListItem;
type CriticalItem = CveListItem;

/* ==========================
   Sabitler
========================== */

const TABS: { id: TabId; label: string }[] = [
  { id: "dashboard", label: "📊 Dashboard" },
  { id: "search", label: "🔍 CVE Arama" },
  { id: "critical", label: "🚨 Kritik CVE'ler" },
  { id: "matching", label: "🧩 Uygulama Eşleşmeleri" },
  { id: "ml_results", label: "🤖 ML Sonuçları" },
];

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

/* ==========================
   MOCK VERİLER
========================== */

// Dashboard için mock istatistikler
const MOCK_STATS: StatsResponse = {
  total_cves: 8542,
  severity_distribution: [
    { severity: "CRITICAL", count: 320 },
    { severity: "HIGH", count: 2100 },
    { severity: "MEDIUM", count: 3800 },
    { severity: "LOW", count: 2300 },
  ],
};

// Matching için mock uygulama verisi
const MOCK_MATCHING_APPS: MatchingApp[] = [
  {
    app_id: "APP-001",
    app_name: "Microsoft Exchange Server",
    exact_match_count: 5,
    fuzzy_match_count: 1,
    semantic_match_count: 2,
    vendor_match_count: 3,
    has_exact_match: true,
    has_fuzzy_match: true,
    has_semantic_match: true,
    has_vendor_match: true,
  },
  {
    app_id: "APP-002",
    app_name: "Apache Tomcat",
    exact_match_count: 0,
    fuzzy_match_count: 2,
    semantic_match_count: 1,
    vendor_match_count: 0,
    has_exact_match: false,
    has_fuzzy_match: true,
    has_semantic_match: true,
    has_vendor_match: false,
  },
  {
    app_id: "APP-003",
    app_name: "Custom Legacy App",
    exact_match_count: 0,
    fuzzy_match_count: 0,
    semantic_match_count: 0,
    vendor_match_count: 0,
    has_exact_match: false,
    has_fuzzy_match: false,
    has_semantic_match: false,
    has_vendor_match: false,
  },
  {
    app_id: "APP-004",
    app_name: "Oracle Database",
    exact_match_count: 3,
    fuzzy_match_count: 0,
    semantic_match_count: 0,
    vendor_match_count: 2,
    has_exact_match: true,
    has_fuzzy_match: false,
    has_semantic_match: false,
    has_vendor_match: true,
  },
  {
    app_id: "APP-005",
    app_name: "NGINX Reverse Proxy",
    exact_match_count: 1,
    fuzzy_match_count: 3,
    semantic_match_count: 2,
    vendor_match_count: 1,
    has_exact_match: true,
    has_fuzzy_match: true,
    has_semantic_match: true,
    has_vendor_match: true,
  },
];

// CVE arama için mock sonuçlar
const MOCK_SEARCH_RESULTS: SearchItem[] = [
  {
    cve_id: "CVE-2023-12345",
    vendor: "Adobe",
    product: "Acrobat Reader",
    cvss_score: 9.8,
    severity: "CRITICAL",
    score: 98,
  },
  {
    cve_id: "CVE-2022-35665",
    vendor: "Adobe",
    product: "Acrobat Reader",
    cvss_score: 7.5,
    severity: "HIGH",
    score: 85,
  },
  {
    cve_id: "CVE-2021-44228",
    vendor: "Apache",
    product: "Log4j",
    cvss_score: 10.0,
    severity: "CRITICAL",
    score: 92,
  },
  {
    cve_id: "CVE-2020-1472",
    vendor: "Microsoft",
    product: "Netlogon",
    cvss_score: 10.0,
    severity: "CRITICAL",
    score: 90,
  },
  {
    cve_id: "CVE-2019-6110",
    vendor: "OpenSSH",
    product: "OpenSSH",
    cvss_score: 5.5,
    severity: "MEDIUM",
    score: 70,
  },
];

// Kritik CVE kartları için mock liste
const CRITICAL_MOCK_ITEMS: CriticalItem[] = [
  {
    cve_id: "CVE-2024-99999",
    vendor: "Cisco",
    product: "IOS XE",
    cvss_score: 10.0,
    severity: "CRITICAL",
    score: 99,
  },
  {
    cve_id: "CVE-2023-12345",
    vendor: "Adobe",
    product: "Acrobat Reader",
    cvss_score: 9.8,
    severity: "CRITICAL",
    score: 98,
  },
  {
    cve_id: "CVE-2021-44228",
    vendor: "Apache",
    product: "Log4j",
    cvss_score: 10.0,
    severity: "CRITICAL",
    score: 97,
  },
  {
    cve_id: "CVE-2020-1472",
    vendor: "Microsoft",
    product: "Netlogon",
    cvss_score: 10.0,
    severity: "CRITICAL",
    score: 96,
  },
];

/* ==========================
   Yardımcı fonksiyonlar
========================== */

function severityColor(sev: string) {
  switch (sev) {
    case "CRITICAL":
      return { dot: "#ef4444", bg: "rgba(239,68,68,0.15)", text: "#fecaca" };
    case "HIGH":
      return { dot: "#f97316", bg: "rgba(249,115,22,0.15)", text: "#fed7aa" };
    case "MEDIUM":
      return { dot: "#eab308", bg: "rgba(234,179,8,0.15)", text: "#fef9c3" };
    case "LOW":
      return { dot: "#22c55e", bg: "rgba(34,197,94,0.15)", text: "#bbf7d0" };
    default:
      return { dot: "#6b7280", bg: "rgba(107,114,128,0.15)", text: "#e5e7eb" };
  }
}

// cvss_score değerini güvenli biçimde yazdırmak için
function formatCvss(score: number | string | undefined | null) {
  if (typeof score === "number") return score.toFixed(1);
  if (typeof score === "string") {
    const num = Number(score);
    return Number.isFinite(num) ? num.toFixed(1) : "N/A";
  }
  return "N/A";
}

// score (önem skoru) için
function formatScore(score: number | string | undefined | null) {
  if (typeof score === "number") return score;
  if (typeof score === "string") {
    const num = Number(score);
    return Number.isFinite(num) ? num : "N/A";
  }
  return "N/A";
}

// Algorithm türüne göre renk ve etiket
function algorithmStyle(algorithm: string) {
  switch (algorithm) {
    case "exact":
      return { bg: "rgba(22,163,74,0.2)", text: "#bbf7d0", label: "Exact (90-100)" };
    case "fuzzy":
      return { bg: "rgba(245,158,11,0.2)", text: "#fed7aa", label: "Fuzzy (70-89)" };
    case "semantic":
      return { bg: "rgba(59,130,246,0.2)", text: "#bfdbfe", label: "Semantic (55-69)" };
    case "vendor":
      return { bg: "rgba(168,85,247,0.2)", text: "#e9d5ff", label: "Vendor (40-54)" };
    default:
      return { bg: "rgba(107,114,128,0.2)", text: "#e5e7eb", label: algorithm };
  }
}

/* ==========================
   Ana komponent
========================== */

const TAB_ROUTES: Record<string, TabId> = {
  "": "dashboard",
  "dashboard": "dashboard",
  "search": "search",
  "critical": "critical",
  "matching": "matching",
  "ml-results": "ml_results",
};

const ROUTE_FROM_TAB: Record<TabId, string> = {
  dashboard: "dashboard",
  search: "search",
  critical: "critical",
  matching: "matching",
  ml_results: "ml-results",
};

function getTabFromHash(): TabId {
  if (typeof window === "undefined") return "dashboard";
  const hash = window.location.hash.replace("#", "");
  return TAB_ROUTES[hash] || "dashboard";
}

export default function Home() {
  const [activeTab, setActiveTabState] = useState<TabId>("dashboard");

  // URL hash'inden tab oku
  useEffect(() => {
    setActiveTabState(getTabFromHash());
    const onHashChange = () => setActiveTabState(getTabFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // Tab değişince URL hash'ini güncelle
  const setActiveTab = useCallback((tab: TabId) => {
    setActiveTabState(tab);
    const route = ROUTE_FROM_TAB[tab];
    window.history.replaceState(null, "", route ? `#${route}` : "/");
  }, []);

  // DASHBOARD state
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  // MATCHING state
  const [matchingApps, setMatchingApps] = useState<MatchingApp[]>([]);
  const [matchingLoading, setMatchingLoading] = useState(false);
  const [matchingError, setMatchingError] = useState<string | null>(null);
  const [matchingFilter, setMatchingFilter] = useState<MatchingFilter>("all");
  const [matchingSearch, setMatchingSearch] = useState("");
  const [selectedApp, setSelectedApp] = useState<MatchingApp | null>(null);
  const [scanApp, setScanApp] = useState<{ id: string; name: string } | null>(null);
  const [appDetail, setAppDetail] = useState<any>(null);
  const [appDetailLoading, setAppDetailLoading] = useState(false);

  // NEW APPLICATION state
  const [showAddAppForm, setShowAddAppForm] = useState(false);
  const [newAppName, setNewAppName] = useState("");
  const [newAppVendor, setNewAppVendor] = useState("");
  const [newAppVersion, setNewAppVersion] = useState("");
  const [newAppCategory, setNewAppCategory] = useState("");
  const [addAppLoading, setAddAppLoading] = useState(false);
  const [addAppError, setAddAppError] = useState<string | null>(null);
  const [addAppResult, setAddAppResult] = useState<any>(null);

  // SEARCH state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchInfo, setSearchInfo] = useState<string | null>(
    "Bir vendor, ürün veya CVE ID yazarak arama yapabilirsin."
  );
  const [hasSearched, setHasSearched] = useState(false);

  // REAL-TIME MATCHING state
  const [matchAppName, setMatchAppName] = useState("");
  const [matchVendor, setMatchVendor] = useState("");
  const [matchResults, setMatchResults] = useState<any[]>([]);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [showMatchPanel, setShowMatchPanel] = useState(false);

  // CRITICAL state
  const [criticalItems, setCriticalItems] = useState<CriticalItem[]>([]);
  const [criticalLoading, setCriticalLoading] = useState(false);
  const [criticalError, setCriticalError] = useState<string | null>(null);

  /* ==========================
     DASHBOARD: /api/stats
  ========================== */

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setStatsLoading(true);
        setStatsError(null);

        const res = await fetch(`${API_BASE_URL}/stats`);
        if (!res.ok) throw new Error(`API error ${res.status}`);

        const data = (await res.json()) as StatsResponse;
        setStats(data);
      } catch (err: unknown) {
        console.error("Stats API error:", err);
        // Backend kapalıysa mock istatistikleri kullan
        setStats(MOCK_STATS);
        setStatsError("Backend kapalı, mock istatistik gösteriliyor.");
      } finally {
        setStatsLoading(false);
      }
    };

    fetchStats();
  }, []);

  const getSeverityCount = (severity: string): number => {
    if (!stats) return 0;
    const found = stats.severity_distribution.find(
      (item) => item.severity === severity
    );
    return found?.count ?? 0;
  };

  /* ==========================
     DASHBOARD RENDER
  ========================== */

  const renderDashboard = () => {
    if (statsLoading && !stats) {
      return (
        <p style={{ fontSize: 14, color: "#cbd5f5" }}>
          İstatistikler yükleniyor…
        </p>
      );
    }

    const totalCves = stats?.total_cves ?? 0;
    const criticalCount = getSeverityCount("CRITICAL");
    const highCount = getSeverityCount("HIGH");
    const mediumCount = getSeverityCount("MEDIUM");
    const lowCount = getSeverityCount("LOW");

    return (
      <>
        <h2
          style={{
            fontSize: 28,
            fontWeight: 600,
            marginBottom: 4,
          }}
        >
          Genel Bakış
        </h2>
        <p
          style={{
            fontSize: 14,
            color: "#94a3b8",
            marginBottom: 24,
          }}
        >
          Burada sistemdeki toplam CVE sayısını ve seviyelere göre dağılımını
          gösteriyoruz. Backend kapalı olduğunda mock istatistikler
          kullanılıyor.
        </p>

        {/* Kartlar */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            marginBottom: 24,
          }}
        >
          {/* Toplam CVE */}
          <div
            style={{
              flex: "1 1 240px",
              minWidth: 220,
              background:
                "radial-gradient(circle at top left, #4f46e5 0, #020617 55%)",
              borderRadius: 16,
              padding: 20,
              border: "1px solid #1e293b",
              boxShadow: "0 18px 45px rgba(15,23,42,0.9)",
            }}
          >
            <div
              style={{
                fontSize: 13,
                color: "#e5e7eb",
                marginBottom: 8,
                opacity: 0.9,
              }}
            >
              Toplam CVE
            </div>
            <div
              style={{
                fontSize: 36,
                fontWeight: 700,
                marginBottom: 4,
              }}
            >
              {totalCves.toLocaleString("tr-TR")}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "#cbd5f5",
              }}
            >
              Değer <code>/api/stats</code> endpoint&apos;inden (veya backend
              kapalıysa mock veriden) geliyor.
            </div>
          </div>

          {/* CRITICAL */}
          <div
            style={{
              flex: "1 1 180px",
              minWidth: 180,
              backgroundColor: "#0f172a",
              borderRadius: 16,
              padding: 16,
              border: "1px solid #1e293b",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
                fontSize: 13,
                color: "#fca5a5",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  backgroundColor: "#dc2626",
                }}
              />
              CRITICAL
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 600,
              }}
            >
              {criticalCount.toLocaleString("tr-TR")}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "#64748b",
                marginTop: 6,
              }}
            >
              Kritik seviyedeki zafiyet sayısı.
            </div>
          </div>

          {/* HIGH */}
          <div
            style={{
              flex: "1 1 180px",
              minWidth: 180,
              backgroundColor: "#0f172a",
              borderRadius: 16,
              padding: 16,
              border: "1px solid #1e293b",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
                fontSize: 13,
                color: "#fed7aa",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  backgroundColor: "#ea580c",
                }}
              />
              HIGH
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 600,
              }}
            >
              {highCount.toLocaleString("tr-TR")}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "#64748b",
                marginTop: 6,
              }}
            >
              Yüksek seviyedeki zafiyet sayısı.
            </div>
          </div>

          {/* MEDIUM */}
          <div
            style={{
              flex: "1 1 180px",
              minWidth: 180,
              backgroundColor: "#0f172a",
              borderRadius: 16,
              padding: 16,
              border: "1px solid #1e293b",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
                fontSize: 13,
                color: "#facc15",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  backgroundColor: "#ca8a04",
                }}
              />
              MEDIUM
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 600,
              }}
            >
              {mediumCount.toLocaleString("tr-TR")}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "#64748b",
                marginTop: 6,
              }}
            >
              Orta seviyedeki zafiyet sayısı.
            </div>
          </div>

          {/* LOW */}
          <div
            style={{
              flex: "1 1 180px",
              minWidth: 180,
              backgroundColor: "#0f172a",
              borderRadius: 16,
              padding: 16,
              border: "1px solid #1e293b",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
                fontSize: 13,
                color: "#bbf7d0",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  backgroundColor: "#16a34a",
                }}
              />
              LOW
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 600,
              }}
            >
              {lowCount.toLocaleString("tr-TR")}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "#64748b",
                marginTop: 6,
              }}
            >
              Düşük seviyedeki zafiyet sayısı.
            </div>
          </div>
        </div>

        {statsError && (
          <p style={{ fontSize: 12, color: "#fca5a5" }}>{statsError}</p>
        )}
      </>
    );
  };

  /* ==========================
     CVE ARAMA: /api/search
  ========================== */

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchError("Arama yapmak için en az bir kelime yazmalısın.");
      setSearchInfo(null);
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    try {
      setSearchLoading(true);
      setSearchError(null);
      setSearchInfo(null);
      setHasSearched(true);

      const params = new URLSearchParams({
        search: searchQuery.trim(),
        page_size: "20",
      });

      const res = await fetch(`${API_BASE_URL}/cves?${params.toString()}`);
      if (!res.ok) throw new Error(`API error ${res.status}`);

      const data = await res.json();
      const items = (data.items || []).map((item: Record<string, unknown>) => ({
        cve_id: item.cve_id,
        vendor: item.vendor || "N/A",
        product: item.product || "N/A",
        cvss_score: item.cvss_score,
        severity: item.severity || "UNKNOWN",
        score: item.cvss_score,
      })) as SearchItem[];
      setSearchResults(items);
      setSearchInfo(`${data.total} sonuç bulundu`);
    } catch (err: unknown) {
      console.error("Search API error:", err);
      setSearchResults(MOCK_SEARCH_RESULTS);
      setSearchError("Backend kapalı, mock arama sonuçları gösteriliyor.");
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleSearch();
    }
  };

  // Real-time matching function
  const handleRealTimeMatch = async () => {
    if (!matchAppName.trim()) {
      setMatchError("Uygulama adı gerekli");
      return;
    }

    try {
      setMatchLoading(true);
      setMatchError(null);

      const res = await fetch(`${API_BASE_URL}/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app_name: matchAppName.trim(),
          vendor: matchVendor.trim(),
        }),
      });

      if (!res.ok) throw new Error(`API error ${res.status}`);

      const data = await res.json();
      setMatchResults(data.matches || []);
    } catch (err) {
      console.error("Match API error:", err);
      setMatchError("Eşleştirme yapılamadı. Backend kapalı olabilir.");
      setMatchResults([]);
    } finally {
      setMatchLoading(false);
    }
  };

  const renderSearch = () => {
    return (
      <>
        <h2
          style={{
            fontSize: 28,
            fontWeight: 600,
            marginBottom: 4,
          }}
        >
          CVE Arama
        </h2>
        <p
          style={{
            fontSize: 14,
            color: "#94a3b8",
            marginBottom: 20,
          }}
        >
          Vendor, ürün adı veya CVE ID yazarak veritabanında arama yap. CVE
          kimlikleri NVD üzerinde açılacak şekilde linklenmiştir.
        </p>

        {/* Arama barı */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div style={{ flex: "1 1 260px", minWidth: 240 }}>
            <input
              placeholder="Örnek: adobe reader, microsoft exchange, CVE-2023-12345…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKey}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 999,
                border: "1px solid #1e293b",
                backgroundColor: "#020617",
                color: "#e5e7eb",
                fontSize: 13,
                outline: "none",
              }}
            />
          </div>
          <button
            onClick={() => void handleSearch()}
            disabled={searchLoading}
            style={{
              padding: "10px 18px",
              borderRadius: 999,
              border: "none",
              backgroundColor: searchLoading ? "#4b5563" : "#4f46e5",
              color: "white",
              fontSize: 13,
              fontWeight: 500,
              cursor: searchLoading ? "default" : "pointer",
            }}
          >
            {searchLoading ? "Aranıyor…" : "Ara"}
          </button>
        </div>

        {/* Info / Error */}
        {searchInfo && (
          <p style={{ fontSize: 12, color: "#9ca3af", marginBottom: 12 }}>
            {searchInfo}
          </p>
        )}
        {searchError && (
          <p style={{ fontSize: 12, color: "#fca5a5", marginBottom: 8 }}>
            {searchError}
          </p>
        )}

        {/* Uygulama Eşleştir Toggle */}
        <div style={{ marginBottom: 16 }}>
          <button
            onClick={() => setShowMatchPanel(!showMatchPanel)}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid #4f46e5",
              backgroundColor: showMatchPanel ? "#4f46e5" : "transparent",
              color: showMatchPanel ? "white" : "#4f46e5",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            {showMatchPanel ? "Paneli Kapat" : "Uygulama Eşleşmelerini Bul"}
          </button>
        </div>

        {/* Uygulama Eşleştir Panel */}
        {showMatchPanel && (
          <div
            style={{
              marginBottom: 20,
              padding: 16,
              borderRadius: 12,
              backgroundColor: "#0f172a",
              border: "1px solid #1e293b",
            }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: "#e5e7eb" }}>
              Uygulama CVE Eşleştirmesi
            </h3>
            <p style={{ fontSize: 12, color: "#9ca3af", marginBottom: 12 }}>
              Uygulama adı ve vendor girerek ilgili CVE&apos;leri otomatik bul.
            </p>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <input
                placeholder="Uygulama Adı (örnek: Apache Tomcat)"
                value={matchAppName}
                onChange={(e) => setMatchAppName(e.target.value)}
                style={{
                  flex: "1 1 200px",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #1e293b",
                  backgroundColor: "#020617",
                  color: "#e5e7eb",
                  fontSize: 13,
                }}
              />
              <input
                placeholder="Vendor (örnek: apache)"
                value={matchVendor}
                onChange={(e) => setMatchVendor(e.target.value)}
                style={{
                  flex: "1 1 150px",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #1e293b",
                  backgroundColor: "#020617",
                  color: "#e5e7eb",
                  fontSize: 13,
                }}
              />
              <button
                onClick={() => void handleRealTimeMatch()}
                disabled={matchLoading}
                style={{
                  padding: "10px 20px",
                  borderRadius: 8,
                  border: "none",
                  backgroundColor: matchLoading ? "#4b5563" : "#10b981",
                  color: "white",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: matchLoading ? "default" : "pointer",
                }}
              >
                {matchLoading ? "Eşleştiriliyor..." : "Eşleşmeleri Bul"}
              </button>
            </div>

            {matchError && (
              <p style={{ fontSize: 12, color: "#fca5a5", marginBottom: 8 }}>{matchError}</p>
            )}

            {/* Eşleşme Sonuçları */}
            {matchResults.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <p style={{ fontSize: 13, color: "#10b981", marginBottom: 8 }}>
                  {matchResults.length} CVE eşleşmesi bulundu
                </p>
                <div
                  style={{
                    maxHeight: 300,
                    overflowY: "auto",
                    borderRadius: 8,
                    border: "1px solid #1e293b",
                  }}
                >
                  {matchResults.map((m, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1.2fr 0.8fr 0.7fr 0.6fr 0.6fr",
                        padding: "10px 12px",
                        fontSize: 12,
                        borderBottom: "1px solid #1e293b",
                        backgroundColor: idx % 2 === 0 ? "#020617" : "#0f172a",
                      }}
                    >
                      <a
                        href={`https://nvd.nist.gov/vuln/detail/${m.cve_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "#60a5fa", textDecoration: "none" }}
                      >
                        {m.cve_id}
                      </a>
                      <div style={{ color: "#9ca3af" }}>{m.vendor || "N/A"}</div>
                      <div style={{ color: "#9ca3af" }}>{m.product || "N/A"}</div>
                      <div>
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: 4,
                            fontSize: 10,
                            fontWeight: 600,
                            backgroundColor:
                              m.severity === "CRITICAL" ? "#dc2626" :
                              m.severity === "HIGH" ? "#ea580c" :
                              m.severity === "MEDIUM" ? "#ca8a04" : "#4b5563",
                            color: "white",
                          }}
                        >
                          {m.severity || "N/A"}
                        </span>
                      </div>
                      <div style={{ color: "#9ca3af" }}>
                        Skor: {m.score}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sonuç tablosu */}
        <div
          style={{
            marginTop: 12,
            borderRadius: 16,
            border: "1px solid #1e293b",
            overflow: "hidden",
            backgroundColor: "#020617",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.3fr 1.1fr 1.4fr 0.8fr 0.9fr 0.7fr",
              padding: "10px 14px",
              fontSize: 12,
              fontWeight: 500,
              color: "#94a3b8",
              borderBottom: "1px solid #1e293b",
            }}
          >
            <div>CVE ID</div>
            <div>Vendor</div>
            <div>Ürün</div>
            <div style={{ textAlign: "right" }}>CVSS</div>
            <div style={{ textAlign: "right" }}>Severity</div>
            <div style={{ textAlign: "right" }}>Skor</div>
          </div>

          {searchResults.length === 0 && hasSearched && !searchLoading && (
            <div
              style={{
                padding: 16,
                fontSize: 13,
                color: "#9ca3af",
              }}
            >
              Sonuç bulunamadı.
            </div>
          )}

          {searchResults.map((item) => {
            const sev = severityColor(item.severity);

            return (
              <div
                key={item.cve_id + item.product}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.3fr 1.1fr 1.4fr 0.8fr 0.9fr 0.7fr",
                  padding: "10px 14px",
                  fontSize: 13,
                  borderTop: "1px solid #0f172a",
                  alignItems: "center",
                }}
              >
                {/* CVE ID link */}
                <div style={{ fontFamily: "monospace" }}>
                  <a
                    href={`https://nvd.nist.gov/vuln/detail/${item.cve_id}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      color: "#60a5fa",
                      textDecoration: "none",
                    }}
                  >
                    {item.cve_id}
                  </a>
                </div>

                <div style={{ color: "#e5e7eb" }}>{item.vendor}</div>
                <div style={{ color: "#e5e7eb" }}>{item.product}</div>

                <div
                  style={{
                    textAlign: "right",
                    color: "#e5e7eb",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {formatCvss(item.cvss_score)}
                </div>

                <div style={{ textAlign: "right" }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "flex-end",
                      gap: 6,
                      padding: "3px 10px",
                      borderRadius: 999,
                      backgroundColor: sev.bg,
                      color: sev.text,
                      fontSize: 11,
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        backgroundColor: sev.dot,
                      }}
                    />
                    <span>{item.severity}</span>
                  </span>
                </div>

                <div
                  style={{
                    textAlign: "right",
                    color: "#e5e7eb",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {formatScore(item.score)}
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  };

  /* ==========================
     KRİTİK CVE'LER: /api/cves?severity=CRITICAL
  ========================== */

  useEffect(() => {
    const fetchCritical = async () => {
      try {
        setCriticalLoading(true);
        setCriticalError(null);

        const res = await fetch(
          `${API_BASE_URL}/cves?severity=CRITICAL&page_size=20`
        );
        if (!res.ok) {
          throw new Error(`API error ${res.status}`);
        }

        const data = (await res.json()) as any;

        let items: CriticalItem[] = [];
        if (Array.isArray(data)) {
          items = data as CriticalItem[];
        } else if (Array.isArray(data.items)) {
          items = data.items as CriticalItem[];
        } else {
          console.warn("Unexpected critical API response:", data);
        }

        if (!items || items.length === 0) {
          // veri yoksa mock'a düş
          setCriticalItems(CRITICAL_MOCK_ITEMS);
          setCriticalError(
            "Gerçek kritik CVE verisi bulunamadı, mock veriler gösteriliyor."
          );
        } else {
          setCriticalItems(items);
        }
      } catch (err: unknown) {
        console.error("Critical API error:", err);
        setCriticalItems(CRITICAL_MOCK_ITEMS);
        setCriticalError(
          "Backend kapalı, mock kritik CVE'ler gösteriliyor."
        );
      } finally {
        setCriticalLoading(false);
      }
    };

    fetchCritical();
  }, []);

  /* ==========================
     MATCHING: /api/matching/apps
  ========================== */

  useEffect(() => {
    const fetchMatchingApps = async () => {
      try {
        setMatchingLoading(true);
        setMatchingError(null);

        const res = await fetch(`${API_BASE_URL}/matching/apps?page_size=100`);
        if (!res.ok) throw new Error(`API error ${res.status}`);

        const data = await res.json();
        const items = data.items || [];
        setMatchingApps(items);
      } catch (err: unknown) {
        console.error("Matching API error:", err);
        setMatchingApps(MOCK_MATCHING_APPS);
        setMatchingError("Backend kapalı, mock veriler gösteriliyor.");
      } finally {
        setMatchingLoading(false);
      }
    };

    fetchMatchingApps();
  }, []);

  // Uygulama detayı çek
  const fetchAppDetail = async (appId: string) => {
    try {
      setAppDetailLoading(true);
      const res = await fetch(`${API_BASE_URL}/matching/apps/${appId}`);
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      setAppDetail(data);
    } catch (err) {
      console.error("App detail error:", err);
      setAppDetail(null);
    } finally {
      setAppDetailLoading(false);
    }
  };

  // Yeni uygulama ekle ve otomatik matching yap
  const handleAddApplication = async () => {
    if (!newAppName.trim() || !newAppVendor.trim()) {
      setAddAppError("Uygulama adı ve vendor zorunludur.");
      return;
    }

    try {
      setAddAppLoading(true);
      setAddAppError(null);
      setAddAppResult(null);

      const res = await fetch(`${API_BASE_URL}/applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app_name: newAppName.trim(),
          vendor: newAppVendor.trim(),
          version: newAppVersion.trim() || null,
          category: newAppCategory.trim() || null,
        }),
      });

      if (!res.ok) throw new Error(`API error ${res.status}`);

      const data = await res.json();
      setAddAppResult(data);

      // Listeyi güncelle - yeni uygulamayı ekle
      const newApp: MatchingApp = {
        app_id: data.application.app_id,
        app_name: data.application.app_name,
        exact_match_count: data.matches?.filter((m: any) => m.algorithm === "exact").length || 0,
        fuzzy_match_count: data.matches?.filter((m: any) => m.algorithm === "fuzzy").length || 0,
        semantic_match_count: data.matches?.filter((m: any) => m.algorithm === "semantic").length || 0,
        vendor_match_count: data.matches?.filter((m: any) => m.algorithm === "vendor").length || 0,
        has_exact_match: data.matches?.some((m: any) => m.algorithm === "exact") || false,
        has_fuzzy_match: data.matches?.some((m: any) => m.algorithm === "fuzzy") || false,
        has_semantic_match: data.matches?.some((m: any) => m.algorithm === "semantic") || false,
        has_vendor_match: data.matches?.some((m: any) => m.algorithm === "vendor") || false,
      };
      setMatchingApps((prev) => [...prev, newApp]);

      // Formu temizle
      setNewAppName("");
      setNewAppVendor("");
      setNewAppVersion("");
      setNewAppCategory("");
    } catch (err) {
      console.error("Add application error:", err);
      setAddAppError("Uygulama eklenemedi. Backend kapalı olabilir.");
    } finally {
      setAddAppLoading(false);
    }
  };

  // Formu kapat ve temizle
  const closeAddAppForm = () => {
    setShowAddAppForm(false);
    setAddAppResult(null);
    setAddAppError(null);
  };

  const renderCritical = () => {
    return (
      <>
        <h2
          style={{
            fontSize: 28,
            fontWeight: 600,
            marginBottom: 4,
          }}
        >
          Kritik CVE&apos;ler
        </h2>
        <p
          style={{
            fontSize: 14,
            color: "#94a3b8",
            marginBottom: 20,
          }}
        >
          Burada sistemde en kritik kabul edilen CVE&apos;leri görüyorsun. Liste{" "}
          <code>/api/cves?severity=CRITICAL</code> endpoint&apos;inden geliyor;
          backend kapalıysa mock veri kullanılıyor.
        </p>

        {criticalError && (
          <p style={{ fontSize: 12, color: "#fca5a5", marginBottom: 12 }}>
            {criticalError}
          </p>
        )}

        {criticalLoading && criticalItems.length === 0 ? (
          <p style={{ fontSize: 14, color: "#cbd5f5" }}>
            Kritik CVE&apos;ler yükleniyor…
          </p>
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 16,
          }}
        >
          {criticalItems.map((item) => {
            const sev = severityColor(item.severity);
            const scoreValue =
              typeof item.score === "number"
                ? item.score
                : Number(item.score) || 0;

            return (
              <div
                key={item.cve_id}
                style={{
                  borderRadius: 16,
                  border: "1px solid #1e293b",
                  backgroundColor: "#020617",
                  padding: 16,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 8,
                  }}
                >
                  <a
                    href={`https://nvd.nist.gov/vuln/detail/${item.cve_id}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      fontFamily: "monospace",
                      fontSize: 13,
                      color: "#60a5fa",
                      textDecoration: "none",
                    }}
                  >
                    {item.cve_id}
                  </a>

                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "3px 10px",
                      borderRadius: 999,
                      backgroundColor: sev.bg,
                      color: sev.text,
                      fontSize: 11,
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        backgroundColor: sev.dot,
                      }}
                    />
                    {item.severity}
                  </span>
                </div>

                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: "#e5e7eb",
                    marginBottom: 4,
                  }}
                >
                  {item.vendor ?? "Bilinmeyen Vendor"} —{" "}
                  {item.product ?? "Bilinmeyen Ürün"}
                </div>

                <div
                  style={{
                    fontSize: 12,
                    color: "#9ca3af",
                    marginBottom: 10,
                  }}
                >
                  CVSS skoru:{" "}
                  <strong>{formatCvss(item.cvss_score)}</strong> • Önem skoru:{" "}
                  <strong>{formatScore(item.score)}</strong>
                </div>

                <div
                  style={{
                    height: 4,
                    borderRadius: 999,
                    backgroundColor: "#0f172a",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min(scoreValue, 100)}%`,
                      height: "100%",
                      background:
                        "linear-gradient(to right, #f97316, #ef4444)",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  };

  /* ==========================
     MATCHING RENDER
  ========================== */

  const getMatchBadge = (app: MatchingApp) => {
    // CASCADE mantığı: Sadece bir türde eşleşme olabilir
    if (app.has_exact_match) {
      return {
        label: "Exact eşleşme",
        bg: "rgba(22,163,74,0.18)",
        text: "#bbf7d0",
        emoji: "✅",
      };
    }
    if (app.has_fuzzy_match) {
      return {
        label: "Fuzzy eşleşme",
        bg: "rgba(245,158,11,0.18)",
        text: "#fed7aa",
        emoji: "🟠",
      };
    }
    if (app.has_semantic_match) {
      return {
        label: "Semantic eşleşme",
        bg: "rgba(59,130,246,0.18)",
        text: "#bfdbfe",
        emoji: "🔵",
      };
    }
    if (app.has_vendor_match) {
      return {
        label: "Vendor eşleşme",
        bg: "rgba(168,85,247,0.18)",
        text: "#e9d5ff",
        emoji: "🟣",
      };
    }
    return {
      label: "Eşleşme yok",
      bg: "rgba(148,163,184,0.12)",
      text: "#cbd5f5",
      emoji: "⚪",
    };
  };

  const renderMatching = () => {
    const q = matchingSearch.trim().toLowerCase();

    const filtered = matchingApps.filter((app) => {
      if (matchingFilter === "exact" && !app.has_exact_match) return false;
      if (matchingFilter === "fuzzy" && !app.has_fuzzy_match) return false;
      if (matchingFilter === "semantic" && !app.has_semantic_match) return false;
      if (matchingFilter === "vendor" && !app.has_vendor_match) return false;
      if (
        matchingFilter === "none" &&
        (app.has_exact_match || app.has_fuzzy_match || app.has_semantic_match || app.has_vendor_match)
      ) {
        return false;
      }

      if (!q) return true;
      return (
        app.app_id.toLowerCase().includes(q) ||
        app.app_name.toLowerCase().includes(q)
      );
    });

    const total = matchingApps.length;
    const exactCount = matchingApps.filter(
      (a) => a.has_exact_match
    ).length;
    const fuzzyCount = matchingApps.filter(
      (a) => a.has_fuzzy_match
    ).length;
    const semanticCount = matchingApps.filter(
      (a) => a.has_semantic_match
    ).length;
    const vendorCount = matchingApps.filter(
      (a) => a.has_vendor_match
    ).length;
    const noneCount = matchingApps.filter(
      (a) => !a.has_exact_match && !a.has_fuzzy_match && !a.has_semantic_match && !a.has_vendor_match
    ).length;

    return (
      <>
        <h2
          style={{
            fontSize: 28,
            fontWeight: 600,
            marginBottom: 4,
          }}
        >
          Uygulama Eşleşmeleri
        </h2>
        <p
          style={{
            fontSize: 14,
            color: "#94a3b8",
            marginBottom: 20,
          }}
        >
          Bu ekranda kurum içi uygulamaların CVE veritabanı ile eşleşme
          durumunu görüyorsun. Veriler <code>/api/matching/apps</code>{" "}
          endpoint&apos;inden geliyor.
        </p>

        {matchingLoading && (
          <p style={{ fontSize: 13, color: "#cbd5f5", marginBottom: 12 }}>
            Yükleniyor...
          </p>
        )}

        {matchingError && (
          <p style={{ fontSize: 12, color: "#fca5a5", marginBottom: 12 }}>
            {matchingError}
          </p>
        )}

        {/* Yeni Uygulama Ekle Butonu */}
        <div style={{ marginBottom: 16 }}>
          <button
            onClick={() => setShowAddAppForm(!showAddAppForm)}
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              border: "none",
              backgroundColor: showAddAppForm ? "#dc2626" : "#10b981",
              color: "white",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            {showAddAppForm ? "Formu Kapat" : "+ Yeni Uygulama Ekle"}
          </button>
        </div>

        {/* Yeni Uygulama Formu */}
        {showAddAppForm && (
          <div
            style={{
              marginBottom: 20,
              padding: 20,
              borderRadius: 12,
              backgroundColor: "#0f172a",
              border: "1px solid #1e293b",
            }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: "#e5e7eb" }}>
              Yeni Uygulama Ekle
            </h3>
            <p style={{ fontSize: 12, color: "#9ca3af", marginBottom: 16 }}>
              Uygulama eklendiğinde otomatik olarak CVE eşleştirmesi yapılacak ve sonuçlar kaydedilecek.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4, display: "block" }}>
                  Uygulama Adı *
                </label>
                <input
                  placeholder="Örnek: Apache Tomcat"
                  value={newAppName}
                  onChange={(e) => setNewAppName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid #1e293b",
                    backgroundColor: "#020617",
                    color: "#e5e7eb",
                    fontSize: 13,
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4, display: "block" }}>
                  Vendor *
                </label>
                <input
                  placeholder="Örnek: apache"
                  value={newAppVendor}
                  onChange={(e) => setNewAppVendor(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid #1e293b",
                    backgroundColor: "#020617",
                    color: "#e5e7eb",
                    fontSize: 13,
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4, display: "block" }}>
                  Versiyon
                </label>
                <input
                  placeholder="Örnek: 10.1.17"
                  value={newAppVersion}
                  onChange={(e) => setNewAppVersion(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid #1e293b",
                    backgroundColor: "#020617",
                    color: "#e5e7eb",
                    fontSize: 13,
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4, display: "block" }}>
                  Kategori
                </label>
                <input
                  placeholder="Örnek: web_server, database"
                  value={newAppCategory}
                  onChange={(e) => setNewAppCategory(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid #1e293b",
                    backgroundColor: "#020617",
                    color: "#e5e7eb",
                    fontSize: 13,
                  }}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <button
                onClick={() => void handleAddApplication()}
                disabled={addAppLoading}
                style={{
                  padding: "10px 24px",
                  borderRadius: 8,
                  border: "none",
                  backgroundColor: addAppLoading ? "#4b5563" : "#4f46e5",
                  color: "white",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: addAppLoading ? "default" : "pointer",
                }}
              >
                {addAppLoading ? "Ekleniyor..." : "Ekle ve Eşleştir"}
              </button>
              <button
                onClick={closeAddAppForm}
                style={{
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: "1px solid #1e293b",
                  backgroundColor: "transparent",
                  color: "#9ca3af",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                İptal
              </button>
            </div>

            {addAppError && (
              <p style={{ fontSize: 12, color: "#fca5a5", marginTop: 12 }}>{addAppError}</p>
            )}

            {/* Eşleştirme Sonuçları */}
            {addAppResult && (
              <div
                style={{
                  marginTop: 16,
                  padding: 16,
                  borderRadius: 8,
                  backgroundColor: "#020617",
                  border: "1px solid #22c55e",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 20 }}>✅</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#22c55e" }}>
                    Uygulama Başarıyla Eklendi!
                  </span>
                </div>
                <div style={{ fontSize: 13, color: "#e5e7eb", marginBottom: 8 }}>
                  <strong>{addAppResult.application?.app_name}</strong> ({addAppResult.application?.app_id})
                </div>
                <div style={{ fontSize: 13, color: "#10b981", marginBottom: 12 }}>
                  {addAppResult.matching_count} CVE eşleşmesi bulundu ve kaydedildi.
                </div>

                {addAppResult.matches && addAppResult.matches.length > 0 && (
                  <div
                    style={{
                      maxHeight: 200,
                      overflowY: "auto",
                      borderRadius: 8,
                      border: "1px solid #1e293b",
                    }}
                  >
                    {addAppResult.matches.slice(0, 10).map((m: any, idx: number) => (
                      <div
                        key={idx}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1.5fr 0.7fr 0.6fr 0.8fr",
                          padding: "8px 12px",
                          fontSize: 11,
                          borderBottom: "1px solid #1e293b",
                          alignItems: "center",
                        }}
                      >
                        <a
                          href={`https://nvd.nist.gov/vuln/detail/${m.cve_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "#60a5fa", textDecoration: "none" }}
                        >
                          {m.cve_id}
                        </a>
                        <span
                          style={{
                            padding: "2px 6px",
                            borderRadius: 4,
                            fontSize: 10,
                            backgroundColor: algorithmStyle(m.algorithm).bg,
                            color: algorithmStyle(m.algorithm).text,
                          }}
                        >
                          {m.algorithm}
                        </span>
                        <span style={{ color: "#9ca3af" }}>{m.score}%</span>
                        <span
                          style={{
                            padding: "2px 6px",
                            borderRadius: 4,
                            fontSize: 10,
                            backgroundColor:
                              m.severity === "CRITICAL" ? "#dc2626" :
                              m.severity === "HIGH" ? "#ea580c" :
                              m.severity === "MEDIUM" ? "#ca8a04" : "#4b5563",
                            color: "white",
                          }}
                        >
                          {m.severity || "N/A"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Özet chip'ler */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 16,
            fontSize: 12,
          }}
        >
          <div
            style={{
              padding: "8px 12px",
              borderRadius: 999,
              border: "1px solid #1e293b",
              backgroundColor: "#0f172a",
            }}
          >
            Toplam uygulama: <strong>{total}</strong>
          </div>
          <div
            style={{
              padding: "8px 12px",
              borderRadius: 999,
              border: "1px solid rgba(22,163,74,0.5)",
              backgroundColor: "rgba(22,163,74,0.12)",
            }}
          >
            Exact eşleşmesi olan: <strong>{exactCount}</strong>
          </div>
          <div
            style={{
              padding: "8px 12px",
              borderRadius: 999,
              border: "1px solid rgba(245,158,11,0.5)",
              backgroundColor: "rgba(245,158,11,0.12)",
            }}
          >
            Fuzzy eşleşmesi olan: <strong>{fuzzyCount}</strong>
          </div>
          <div
            style={{
              padding: "8px 12px",
              borderRadius: 999,
              border: "1px solid rgba(59,130,246,0.5)",
              backgroundColor: "rgba(59,130,246,0.12)",
            }}
          >
            Semantic eşleşmesi olan: <strong>{semanticCount}</strong>
          </div>
          <div
            style={{
              padding: "8px 12px",
              borderRadius: 999,
              border: "1px solid rgba(168,85,247,0.5)",
              backgroundColor: "rgba(168,85,247,0.12)",
            }}
          >
            Vendor eşleşmesi olan: <strong>{vendorCount}</strong>
          </div>
          <div
            style={{
              padding: "8px 12px",
              borderRadius: 999,
              border: "1px solid rgba(148,163,184,0.5)",
              backgroundColor: "rgba(148,163,184,0.12)",
            }}
          >
            Hiç eşleşmesi olmayan: <strong>{noneCount}</strong>
          </div>
        </div>

        {/* Filtre + Arama */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(
              [
                ["all", "Tümü"],
                ["exact", "Sadece Exact"],
                ["fuzzy", "Sadece Fuzzy"],
                ["semantic", "Sadece Semantic"],
                ["vendor", "Sadece Vendor"],
                ["none", "Sadece Eşleşmeyen"],
              ] as [MatchingFilter, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setMatchingFilter(value)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 999,
                  border: "1px solid",
                  borderColor:
                    matchingFilter === value ? "#4f46e5" : "#1f2937",
                  backgroundColor:
                    matchingFilter === value ? "#4f46e5" : "transparent",
                  color:
                    matchingFilter === value
                      ? "#ffffff"
                      : "rgba(226,232,240,0.9)",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div style={{ minWidth: 220, flex: "0 1 260px" }}>
            <input
              placeholder="Uygulama adı veya APP ID ara…"
              value={matchingSearch}
              onChange={(e) => setMatchingSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 999,
                border: "1px solid #1e293b",
                backgroundColor: "#020617",
                color: "#e5e7eb",
                fontSize: 12,
                outline: "none",
              }}
            />
          </div>
        </div>

        {/* Liste / tablo */}
        <div
          style={{
            borderRadius: 16,
            border: "1px solid #1e293b",
            overflow: "hidden",
            backgroundColor: "#020617",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 2fr 0.8fr 0.8fr 0.8fr 0.8fr 1.2fr",
              gap: 8,
              padding: "10px 14px",
              fontSize: 12,
              fontWeight: 500,
              color: "#94a3b8",
              borderBottom: "1px solid #1e293b",
              backgroundColor: "#020617",
            }}
          >
            <div>APP ID</div>
            <div>Uygulama Adı</div>
            <div style={{ textAlign: "right", color: "#bbf7d0" }}>Exact</div>
            <div style={{ textAlign: "right", color: "#fed7aa" }}>Fuzzy</div>
            <div style={{ textAlign: "right", color: "#bfdbfe" }}>Semantic</div>
            <div style={{ textAlign: "right", color: "#e9d5ff" }}>Vendor</div>
            <div style={{ textAlign: "right" }}>Durum</div>
          </div>

          {filtered.length === 0 && (
            <div
              style={{
                padding: 16,
                fontSize: 13,
                color: "#9ca3af",
              }}
            >
              Filtrelere uyan uygulama bulunamadı.
            </div>
          )}

          {filtered.map((app) => {
            const badge = getMatchBadge(app);
            const isSelected = selectedApp?.app_id === app.app_id;

            return (
              <button
                key={app.app_id}
                onClick={() => {
                  if (isSelected) {
                    setSelectedApp(null);
                    setAppDetail(null);
                  } else {
                    setSelectedApp(app);
                    fetchAppDetail(app.app_id);
                  }
                }}
                style={{
                  width: "100%",
                  border: "none",
                  backgroundColor: "#020617",
                  padding: 0,
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 2fr 0.8fr 0.8fr 0.8fr 0.8fr 1.2fr",
                    gap: 8,
                    padding: "10px 14px",
                    fontSize: 13,
                    borderTop: "1px solid #0f172a",
                    backgroundColor: isSelected ? "#020617" : "#020617",
                  }}
                >
                  <div style={{ color: "#e5e7eb", fontFamily: "monospace" }}>
                    {app.app_id}
                  </div>
                  <div style={{ color: "#e5e7eb" }}>{app.app_name}</div>
                  <div style={{ textAlign: "right", color: app.exact_match_count > 0 ? "#bbf7d0" : "#6b7280" }}>
                    {app.exact_match_count}
                  </div>
                  <div style={{ textAlign: "right", color: app.fuzzy_match_count > 0 ? "#fed7aa" : "#6b7280" }}>
                    {app.fuzzy_match_count}
                  </div>
                  <div style={{ textAlign: "right", color: app.semantic_match_count > 0 ? "#bfdbfe" : "#6b7280" }}>
                    {app.semantic_match_count}
                  </div>
                  <div style={{ textAlign: "right", color: app.vendor_match_count > 0 ? "#e9d5ff" : "#6b7280" }}>
                    {app.vendor_match_count}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "4px 10px",
                        borderRadius: 999,
                        backgroundColor: badge.bg,
                        color: badge.text,
                        fontSize: 11,
                      }}
                    >
                      <span>{badge.emoji}</span>
                      <span>{badge.label}</span>
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Detay paneli */}
        {selectedApp && (
          <div
            style={{
              marginTop: 20,
              padding: 16,
              borderRadius: 16,
              border: "1px solid #1e293b",
              backgroundColor: "#020617",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <div>
                <div
                  style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}
                >
                  {selectedApp.app_name}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "#9ca3af",
                    fontFamily: "monospace",
                  }}
                >
                  {selectedApp.app_id}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  onClick={() => setScanApp({ id: selectedApp.app_id, name: selectedApp.app_name })}
                  style={{ padding: "6px 14px", borderRadius: 999, border: "none",
                    backgroundColor: "#6366f1", color: "white", fontSize: 11,
                    fontWeight: 700, cursor: "pointer" }}
                >
                  ML Taraması Başlat
                </button>
                <button
                  onClick={() => setSelectedApp(null)}
                  style={{ padding: "4px 10px", borderRadius: 999,
                    border: "1px solid #1e293b", backgroundColor: "#020617",
                    color: "#e5e7eb", fontSize: 11, cursor: "pointer" }}
                >
                  Kapat
                </button>
              </div>
            </div>

            {appDetailLoading && (
              <p style={{ fontSize: 13, color: "#cbd5f5" }}>
                CVE eşleşmeleri yükleniyor...
              </p>
            )}

            {appDetail && appDetail.matches && appDetail.matches.length > 0 ? (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8 }}>
                  Toplam {appDetail.matches.length} CVE eşleşmesi bulundu:
                </div>
                <div
                  style={{
                    maxHeight: 300,
                    overflowY: "auto",
                    borderRadius: 8,
                    border: "1px solid #1e293b",
                  }}
                >
                  {appDetail.matches.map((match: any, idx: number) => {
                    const sev = severityColor(match.severity || "UNKNOWN");
                    return (
                      <div
                        key={idx}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1.5fr 0.8fr 0.8fr 1fr",
                          gap: 8,
                          padding: "8px 12px",
                          fontSize: 12,
                          borderBottom: idx < appDetail.matches.length - 1 ? "1px solid #0f172a" : "none",
                          alignItems: "center",
                        }}
                      >
                        <a
                          href={`https://nvd.nist.gov/vuln/detail/${match.cve_id}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            color: "#60a5fa",
                            textDecoration: "none",
                            fontFamily: "monospace",
                          }}
                        >
                          {match.cve_id}
                        </a>
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: 999,
                            backgroundColor: algorithmStyle(match.algorithm).bg,
                            color: algorithmStyle(match.algorithm).text,
                            fontSize: 10,
                            textAlign: "center",
                          }}
                        >
                          {match.algorithm}
                        </span>
                        <span style={{ color: "#e5e7eb", textAlign: "right" }}>
                          {match.score?.toFixed(0)}%
                        </span>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "flex-end",
                            gap: 4,
                            padding: "2px 8px",
                            borderRadius: 999,
                            backgroundColor: sev.bg,
                            color: sev.text,
                            fontSize: 10,
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: 999,
                              backgroundColor: sev.dot,
                            }}
                          />
                          {match.severity || "N/A"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              !appDetailLoading && (
                <p style={{ fontSize: 12, color: "#9ca3af" }}>
                  Bu uygulama için CVE eşleşmesi bulunamadı.
                </p>
              )
            )}
          </div>
        )}
      </>
    );
  };

  /* ==========================
     İÇERİK SEÇİMİ
  ========================== */

  const renderMLResults = () => (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>
        ML Model Sonuçları
      </h2>
      <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 20 }}>
        CASCADE hybrid matching (SBERT + TF-IDF) ile bulunan CVE eşleşmeleri.
        Uygulama Eşleşmeleri sekmesinden ML taraması başlatarak sonuç üretebilirsiniz.
      </p>
      <MLResultsView />
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return renderDashboard();
      case "search":
        return renderSearch();
      case "critical":
        return renderCritical();
      case "matching":
        return renderMatching();
      case "ml_results":
        return renderMLResults();
      default:
        return null;
    }
  };

  /* ==========================
     ANA LAYOUT
  ========================== */

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#020617",
        color: "white",
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      {/* Üst bar */}
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
            🔒 CVE Vulnerability Matcher
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>
            Sibergüvenlik Zafiyet Analiz Sistemi
          </div>
        </div>

        <nav style={{ display: "flex", gap: 8 }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                borderRadius: 999,
                border: "1px solid",
                borderColor:
                  activeTab === tab.id ? "#4f46e5" : "rgba(51,65,85,1)",
                padding: "6px 12px",
                fontSize: 12,
                backgroundColor:
                  activeTab === tab.id ? "#4f46e5" : "transparent",
                color: activeTab === tab.id ? "white" : "#e2e8f0",
                cursor: "pointer",
              }}
            >
              {tab.label}
            </button>
          ))}
          <Link
            href="/scanner"
            style={{
              borderRadius: 999,
              border: "1px solid #065f46",
              padding: "6px 12px",
              fontSize: 12,
              backgroundColor: "rgba(16,185,129,0.15)",
              color: "#6ee7b7",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
            }}
          >
            🛡️ Tarayıcı
          </Link>
        </nav>
      </header>

      {/* İçerik alanı */}
      <section
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "24px 16px 48px",
        }}
      >
        {renderContent()}
      </section>
      {scanApp && (
        <MLScanModal
          appId={scanApp.id}
          appName={scanApp.name}
          onClose={() => setScanApp(null)}
          onDone={() => { setScanApp(null); setActiveTab("ml_results"); }}
        />
      )}
    </main>
  );
}
