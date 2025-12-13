"use client";

import {
  useEffect,
  useState,
  type KeyboardEvent,
} from "react";

/* ==========================
   Tür tanımları
========================== */

type TabId = "dashboard" | "search" | "critical" | "matching";

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
  has_exact_match: boolean;
  has_fuzzy_match: boolean;
};

type MatchingFilter = "all" | "exact" | "fuzzy" | "none";

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
    has_exact_match: true,
    has_fuzzy_match: true,
  },
  {
    app_id: "APP-002",
    app_name: "Apache Tomcat",
    exact_match_count: 0,
    fuzzy_match_count: 2,
    has_exact_match: false,
    has_fuzzy_match: true,
  },
  {
    app_id: "APP-003",
    app_name: "Custom Legacy App",
    exact_match_count: 0,
    fuzzy_match_count: 0,
    has_exact_match: false,
    has_fuzzy_match: false,
  },
  {
    app_id: "APP-004",
    app_name: "Oracle Database",
    exact_match_count: 3,
    fuzzy_match_count: 0,
    has_exact_match: true,
    has_fuzzy_match: false,
  },
  {
    app_id: "APP-005",
    app_name: "NGINX Reverse Proxy",
    exact_match_count: 1,
    fuzzy_match_count: 3,
    has_exact_match: true,
    has_fuzzy_match: true,
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

/* ==========================
   Ana komponent
========================== */

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");

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
  const [appDetail, setAppDetail] = useState<any>(null);
  const [appDetailLoading, setAppDetailLoading] = useState(false);

  // SEARCH state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchInfo, setSearchInfo] = useState<string | null>(
    "Bir vendor, ürün veya CVE ID yazarak arama yapabilirsin."
  );
  const [hasSearched, setHasSearched] = useState(false);

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
    if (app.has_exact_match && app.has_fuzzy_match) {
      return {
        label: "Exact + Fuzzy",
        bg: "rgba(59,130,246,0.15)",
        text: "#bfdbfe",
        emoji: "🟦",
      };
    }
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
        label: "Fuzzy (benzer) eşleşme",
        bg: "rgba(245,158,11,0.18)",
        text: "#fed7aa",
        emoji: "🟠",
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
      if (
        matchingFilter === "none" &&
        (app.has_exact_match || app.has_fuzzy_match)
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
    const noneCount = matchingApps.filter(
      (a) => !a.has_exact_match && !a.has_fuzzy_match
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
              gridTemplateColumns: "1.2fr 2.2fr 1fr 1fr 1.2fr",
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
            <div style={{ textAlign: "right" }}>Exact Sayısı</div>
            <div style={{ textAlign: "right" }}>Fuzzy Sayısı</div>
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
                    gridTemplateColumns: "1.2fr 2.2fr 1fr 1fr 1.2fr",
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
                  <div style={{ textAlign: "right", color: "#e5e7eb" }}>
                    {app.exact_match_count}
                  </div>
                  <div style={{ textAlign: "right", color: "#e5e7eb" }}>
                    {app.fuzzy_match_count}
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

              <button
                onClick={() => setSelectedApp(null)}
                style={{
                  padding: "4px 10px",
                  borderRadius: 999,
                  border: "1px solid #1e293b",
                  backgroundColor: "#020617",
                  color: "#e5e7eb",
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                Kapat
              </button>
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
                            backgroundColor: match.algorithm === "exact" ? "rgba(22,163,74,0.18)" : "rgba(245,158,11,0.18)",
                            color: match.algorithm === "exact" ? "#bbf7d0" : "#fed7aa",
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
    </main>
  );
}
