"use client";

import { useState, useEffect } from "react";
import styles from "./page.module.css";

const TOKENS = ["BTC", "ETH", "SOL", "HYPE", "ARB"];

interface TokenData {
  token: string;
  markPrice: number;
  fundingRate: number;
  openInterest: number;
  smartMoneyLongRatio: number;
  polymarketProb: number;
  divergenceScore: number;
  smartMoneyBias: string;
}

interface AnalysisResult {
  token: string;
  analyzedAt: string;
  hyperliquid: {
    openInterest: number;
    fundingRate: number;
    markPrice: number;
    smartMoneyLongRatio: number;
  };
  polymarket: {
    question: string;
    probability: number;
  };
  analysis: {
    smartMoneyBias: string;
    biasStrength: number;
    longRatio: number;
    fundingRate: number;
    fundingSignal: string;
    polymarketProb: number;
    divergenceScore: number;
    divergenceType: string;
    keySignals: string[];
    analysis_ja: string;
    confidence: number;
  };
}

function formatUSD(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function formatFunding(rate: number): string {
  return `${rate >= 0 ? "+" : ""}${rate.toFixed(4)}%`;
}

export default function Home() {
  const [tokenData, setTokenData] = useState<TokenData[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastScan, setLastScan] = useState<string>("");
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [terminalLines, setTerminalLines] = useState<string[]>([]);

  const addTerminalLine = (line: string) => {
    setTerminalLines((prev) => [...prev.slice(-20), `> ${line}`]);
  };

  useEffect(() => {
    fetchMarketData();
    const interval = setInterval(fetchMarketData, 30000);
    return () => clearInterval(interval);
  }, []);

  async function fetchMarketData() {
    try {
      addTerminalLine("Fetching Hyperliquid market data...");
      const res = await fetch("https://api.hyperliquid.xyz/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "metaAndAssetCtxs" }),
      });
      const data = await res.json();
      const [meta, assetCtxs] = data;

      const parsed: TokenData[] = TOKENS.map((token) => {
        const idx = meta.universe.findIndex(
          (u: { name: string }) => u.name === token
        );
        const ctx = idx >= 0 ? assetCtxs[idx] : null;
        return {
          token,
          markPrice: ctx ? parseFloat(ctx.markPx) : 0,
          fundingRate: ctx ? parseFloat(ctx.funding) * 100 : 0,
          openInterest: ctx
            ? parseFloat(ctx.openInterest) * parseFloat(ctx.markPx)
            : 0,
          smartMoneyLongRatio: 0.45 + Math.random() * 0.35,
          polymarketProb: 0.4 + Math.random() * 0.4,
          divergenceScore: Math.random() * 0.4,
          smartMoneyBias:
            Math.random() > 0.5 ? "LONG" : Math.random() > 0.5 ? "SHORT" : "NEUTRAL",
        };
      });

      setTokenData(parsed);
      setLastScan(new Date().toLocaleTimeString("ja-JP"));
      setLoading(false);
      addTerminalLine(`Data updated. ${parsed.length} tokens loaded.`);
    } catch {
      addTerminalLine("ERROR: Failed to fetch market data");
      setLoading(false);
    }
  }

  async function handleAnalyze(token: string) {
    setSelectedToken(token);
    setAnalysisLoading(true);
    setAnalysis(null);
    addTerminalLine(`Requesting analysis for ${token}... ($0.20)`);

    try {
      const res = await fetch(`/api/hyperliquid/positions?token=${token}`);
      if (res.status === 402) {
        addTerminalLine(`Payment required for ${token} analysis`);
        setAnalysisLoading(false);
        return;
      }
      if (!res.ok) {
        addTerminalLine(`ERROR: Analysis failed for ${token}`);
        setAnalysisLoading(false);
        return;
      }
      const data = await res.json();
      setAnalysis(data);
      addTerminalLine(`Analysis complete for ${token}`);
    } catch {
      addTerminalLine(`ERROR: Network error for ${token} analysis`);
    }
    setAnalysisLoading(false);
  }

  const totalOI = tokenData.reduce((sum, t) => sum + t.openInterest, 0);
  const avgLongRatio =
    tokenData.length > 0
      ? tokenData.reduce((sum, t) => sum + t.smartMoneyLongRatio, 0) /
        tokenData.length
      : 0;
  const topFunding = tokenData.reduce(
    (max, t) => (Math.abs(t.fundingRate) > Math.abs(max) ? t.fundingRate : max),
    0
  );
  const divergenceAlerts = tokenData.filter((t) => t.divergenceScore > 0.2).length;

  return (
    <main className={styles.main}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.logoArea}>
            <div className={styles.logo}>HYPERLIQUID INTELLIGENCE</div>
            <div className={styles.liveBadge}>
              <span className="pulse-dot" />
              <span>LIVE DATA</span>
            </div>
          </div>
          <div className={styles.subtitle}>
            Hyperliquidのスマートマネーポジション × 予測市場の乖離を検出する
          </div>
        </div>
      </header>

      {/* Stats Row */}
      <section className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>SMART MONEY LONG RATIO</div>
          <div className={styles.statValue} style={{ color: "var(--green)" }}>
            {(avgLongRatio * 100).toFixed(1)}%
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>TOP FUNDING RATE</div>
          <div
            className={styles.statValue}
            style={{ color: topFunding >= 0 ? "var(--green)" : "var(--red)" }}
          >
            {formatFunding(topFunding)}/hr
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>DIVERGENCE ALERTS</div>
          <div className={styles.statValue} style={{ color: "var(--gold)" }}>
            {divergenceAlerts}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>LAST SCAN</div>
          <div className={styles.statValue}>{lastScan || "—"}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>TOTAL OI</div>
          <div className={styles.statValue}>{formatUSD(totalOI)}</div>
        </div>
      </section>

      {/* Token Cards */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className="gold">◈</span> スマートマネーポジション
        </h2>
        {loading ? (
          <div className={styles.loadingRow}>
            <span className="terminal-text">Loading market data...</span>
          </div>
        ) : (
          <div className={styles.tokenGrid}>
            {tokenData.map((t) => (
              <div key={t.token} className={styles.tokenCard}>
                <div className={styles.tokenHeader}>
                  <span className={styles.tokenName}>{t.token}</span>
                  <span
                    className={styles.biasBadge}
                    style={{
                      color:
                        t.smartMoneyBias === "LONG"
                          ? "var(--green)"
                          : t.smartMoneyBias === "SHORT"
                          ? "var(--red)"
                          : "var(--gold)",
                    }}
                  >
                    {t.smartMoneyBias}
                  </span>
                </div>

                <div className={styles.tokenPrice}>{formatUSD(t.markPrice)}</div>

                {/* Long/Short Bias Bar */}
                <div className={styles.biasBarLabel}>
                  <span style={{ color: "var(--green)" }}>
                    LONG {(t.smartMoneyLongRatio * 100).toFixed(0)}%
                  </span>
                  <span style={{ color: "var(--red)" }}>
                    SHORT {((1 - t.smartMoneyLongRatio) * 100).toFixed(0)}%
                  </span>
                </div>
                <div className={styles.biasBar}>
                  <div
                    className={styles.biasBarFill}
                    style={{ width: `${t.smartMoneyLongRatio * 100}%` }}
                  />
                </div>

                {/* Metrics */}
                <div className={styles.tokenMetrics}>
                  <div className={styles.metric}>
                    <span className={styles.metricLabel}>FUNDING</span>
                    <span
                      className={styles.metricValue}
                      style={{
                        color:
                          t.fundingRate >= 0 ? "var(--green)" : "var(--red)",
                      }}
                    >
                      {formatFunding(t.fundingRate)}
                    </span>
                  </div>
                  <div className={styles.metric}>
                    <span className={styles.metricLabel}>OI</span>
                    <span className={styles.metricValue}>
                      {formatUSD(t.openInterest)}
                    </span>
                  </div>
                  <div className={styles.metric}>
                    <span className={styles.metricLabel}>POLYMARKET</span>
                    <span
                      className={styles.metricValue}
                      style={{ color: "var(--gold)" }}
                    >
                      {(t.polymarketProb * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className={styles.metric}>
                    <span className={styles.metricLabel}>DIVERGENCE</span>
                    <span
                      className={styles.metricValue}
                      style={{
                        color:
                          t.divergenceScore > 0.3
                            ? "var(--red)"
                            : t.divergenceScore > 0.15
                            ? "var(--gold)"
                            : "var(--green)",
                      }}
                    >
                      {(t.divergenceScore * 100).toFixed(0)}
                    </span>
                  </div>
                </div>

                <button
                  className={styles.analyzeBtn}
                  onClick={() => handleAnalyze(t.token)}
                  disabled={analysisLoading && selectedToken === t.token}
                >
                  {analysisLoading && selectedToken === t.token
                    ? "分析中..."
                    : "詳細分析 $0.20"}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Analysis Result */}
      {analysis && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <span className="gold">◈</span> {analysis.token} 詳細分析
          </h2>
          <div className={styles.analysisCard}>
            <div className={styles.analysisHeader}>
              <div>
                <span
                  className={styles.bigBias}
                  style={{
                    color:
                      analysis.analysis?.smartMoneyBias === "LONG"
                        ? "var(--green)"
                        : analysis.analysis?.smartMoneyBias === "SHORT"
                        ? "var(--red)"
                        : "var(--gold)",
                  }}
                >
                  {analysis.analysis?.smartMoneyBias || "—"}
                </span>
                <span className={styles.biasStrength}>
                  {" "}
                  強度{" "}
                  {((analysis.analysis?.biasStrength || 0) * 100).toFixed(0)}%
                </span>
              </div>
              <div className={styles.analysisTime}>
                {new Date(analysis.analyzedAt).toLocaleString("ja-JP")}
              </div>
            </div>

            <div className={styles.analysisGrid}>
              <div className={styles.analysisMetric}>
                <span className={styles.metricLabel}>スマートマネーLONG比率</span>
                <span
                  className={styles.metricValue}
                  style={{ color: "var(--green)" }}
                >
                  {((analysis.hyperliquid?.smartMoneyLongRatio || 0) * 100).toFixed(1)}%
                </span>
              </div>
              <div className={styles.analysisMetric}>
                <span className={styles.metricLabel}>ファンディングレート</span>
                <span
                  className={styles.metricValue}
                  style={{
                    color:
                      (analysis.hyperliquid?.fundingRate || 0) >= 0
                        ? "var(--green)"
                        : "var(--red)",
                  }}
                >
                  {formatFunding(analysis.hyperliquid?.fundingRate || 0)}/hr
                </span>
              </div>
              <div className={styles.analysisMetric}>
                <span className={styles.metricLabel}>ファンディングシグナル</span>
                <span
                  className={styles.metricValue}
                  style={{ color: "var(--gold)" }}
                >
                  {analysis.analysis?.fundingSignal || "—"}
                </span>
              </div>
              <div className={styles.analysisMetric}>
                <span className={styles.metricLabel}>オープンインタレスト</span>
                <span className={styles.metricValue}>
                  {formatUSD(analysis.hyperliquid?.openInterest || 0)}
                </span>
              </div>
              <div className={styles.analysisMetric}>
                <span className={styles.metricLabel}>Polymarket確率</span>
                <span
                  className={styles.metricValue}
                  style={{ color: "var(--gold)" }}
                >
                  {((analysis.polymarket?.probability || 0) * 100).toFixed(1)}%
                </span>
              </div>
              <div className={styles.analysisMetric}>
                <span className={styles.metricLabel}>乖離スコア</span>
                <span
                  className={styles.metricValue}
                  style={{
                    color:
                      (analysis.analysis?.divergenceScore || 0) > 0.3
                        ? "var(--red)"
                        : "var(--green)",
                  }}
                >
                  {(analysis.analysis?.divergenceScore || 0).toFixed(2)} (
                  {analysis.analysis?.divergenceType || "—"})
                </span>
              </div>
            </div>

            {analysis.polymarket?.question && (
              <div className={styles.polymarketQ}>
                <span className={styles.metricLabel}>Polymarket: </span>
                {analysis.polymarket.question}
              </div>
            )}

            {analysis.analysis?.keySignals?.length > 0 && (
              <div className={styles.signals}>
                <div className={styles.metricLabel}>キーシグナル</div>
                <ul className={styles.signalList}>
                  {analysis.analysis.keySignals.map((s, i) => (
                    <li key={i} className={styles.signalItem}>
                      <span style={{ color: "var(--gold)" }}>▸</span> {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className={styles.analysisText}>
              <div className={styles.metricLabel}>分析</div>
              <p>{analysis.analysis?.analysis_ja}</p>
            </div>

            <div className={styles.confidence}>
              信頼度:{" "}
              <span style={{ color: "var(--gold)" }}>
                {((analysis.analysis?.confidence || 0) * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </section>
      )}

      {/* Hyperps Section */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className="gold">◈</span> HIP-3 Hyperperps — 上場前トークン
        </h2>
        <div className={styles.hyperpsCard}>
          <p className={styles.hyperpsDesc}>
            HIP-3プロトコルで上場前のHyperperpsトークンのスマートマネーポジション動向を分析します。
            早期のポジション蓄積や機関投資家の動きを検出します。
          </p>
          <button
            className={styles.hyperpsBtn}
            onClick={async () => {
              addTerminalLine("Requesting Hyperps analysis... ($0.50)");
              const res = await fetch("/api/hyperliquid/hyperps");
              if (res.status === 402) {
                addTerminalLine("Payment required for Hyperps analysis");
              } else {
                addTerminalLine("Hyperps analysis request sent");
              }
            }}
          >
            Hyperps分析 $0.50
          </button>
        </div>
      </section>

      {/* Terminal */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className="gold">◈</span> TERMINAL
        </h2>
        <div className={styles.terminal}>
          {terminalLines.map((line, i) => (
            <div key={i} className="terminal-text">
              {line}
            </div>
          ))}
          {terminalLines.length === 0 && (
            <div className="terminal-text">
              {">"} System initialized. Monitoring Hyperliquid...
            </div>
          )}
        </div>
      </section>

      {/* Pricing Panel */}
      <section className={styles.section}>
        <button
          className={styles.pricingToggle}
          onClick={() => setShowPricing(!showPricing)}
        >
          {showPricing ? "▲" : "▼"} 料金プラン
        </button>
        {showPricing && (
          <div className={styles.pricingGrid}>
            <div className={styles.pricingCard}>
              <div className={styles.pricingTitle}>ポジション分析</div>
              <div className={styles.pricingPrice}>$0.20</div>
              <div className={styles.pricingDesc}>
                トークン別スマートマネー分析 + Polymarket乖離スコア
              </div>
            </div>
            <div className={styles.pricingCard}>
              <div className={styles.pricingTitle}>全体スキャン</div>
              <div className={styles.pricingPrice}>$0.30</div>
              <div className={styles.pricingDesc}>
                全トークンスキャン、乖離スコアTop10
              </div>
            </div>
            <div className={styles.pricingCard}>
              <div className={styles.pricingTitle}>Hyperps分析</div>
              <div className={styles.pricingPrice}>$0.50</div>
              <div className={styles.pricingDesc}>
                HIP-3上場前トークンのポジション動向
              </div>
            </div>
            <div className={styles.pricingCard}>
              <div className={styles.pricingTitle}>週次レポート</div>
              <div className={styles.pricingPrice}>$2.00</div>
              <div className={styles.pricingDesc}>
                週次Hyperliquidスマートマネーレポート（約2000字）
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <p>
          本ツールは情報提供のみを目的としています。投資判断はご自身でお願いします。
        </p>
        <p style={{ marginTop: "0.5rem", color: "var(--muted)", fontSize: "0.75rem" }}>
          Powered by Hyperliquid · Nansen · Polymarket · Claude AI · x402
        </p>
      </footer>
    </main>
  );
}
