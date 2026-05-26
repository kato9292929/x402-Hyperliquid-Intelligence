import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { x402Server } from "@/lib/x402";
import Anthropic from "@anthropic-ai/sdk";

const payTo = (process.env.WALLET_ADDRESS ||
  "0xC67d94504696960bA0f2e7C3FeE703950734c00A") as `0x${string}`;

const REPORT_TOKENS = ["BTC", "ETH", "SOL", "HYPE", "ARB", "AVAX", "INJ", "TIA"];

async function handler(_req: NextRequest): Promise<NextResponse<unknown>> {
  try {
    const hlRes = await fetch("https://api.hyperliquid.xyz/info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "metaAndAssetCtxs" }),
    });
    const [meta, assetCtxs] = await hlRes.json();

    const fundingHistories: Record<string, unknown[]> = {};
    for (const token of ["BTC", "ETH", "SOL"]) {
      try {
        const fRes = await fetch("https://api.hyperliquid.xyz/info", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "fundingHistory",
            coin: token,
            startTime: Date.now() - 7 * 24 * 60 * 60 * 1000,
          }),
        });
        if (fRes.ok) fundingHistories[token] = await fRes.json();
      } catch {
        // Continue without funding history
      }
    }

    const tokenData = REPORT_TOKENS.map((token) => {
      const idx = meta.universe.findIndex(
        (u: { name: string }) => u.name === token
      );
      const ctx = idx >= 0 ? assetCtxs[idx] : null;
      return {
        token,
        openInterest: ctx
          ? parseFloat(ctx.openInterest) * parseFloat(ctx.markPx)
          : 0,
        fundingRate: ctx ? parseFloat(ctx.funding) * 100 : 0,
        markPrice: ctx ? parseFloat(ctx.markPx) : 0,
        dayNtlVlm: ctx ? parseFloat(ctx.dayNtlVlm || "0") : 0,
      };
    });

    const dataStr = tokenData
      .map(
        (t) =>
          `${t.token}: OI=$${(t.openInterest / 1e6).toFixed(0)}M, funding=${t.fundingRate.toFixed(4)}%/hr, price=$${t.markPrice.toFixed(2)}, 24h vol=$${(t.dayNtlVlm / 1e6).toFixed(0)}M`
      )
      .join("\n");

    const fundingSummary = Object.entries(fundingHistories)
      .map(([token, history]) => {
        if (!Array.isArray(history) || history.length === 0) return "";
        const rates = history
          .slice(-24)
          .map((h) =>
            parseFloat((h as { fundingRate: string }).fundingRate || "0")
          );
        const avgRate = rates.reduce((a, b) => a + b, 0) / rates.length;
        return `${token} 7日間平均ファンディング: ${(avgRate * 100).toFixed(4)}%/hr`;
      })
      .filter(Boolean)
      .join("\n");

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system:
        "あなたはHyperliquidの週次レポートを作成する専門アナリストです。スマートマネーのperp取引動向を詳細に分析し、約2000字の日本語レポートを作成してください。",
      messages: [
        {
          role: "user",
          content: `以下のHyperliquidデータから週次スマートマネーレポートを作成してください:

【現在のマーケットデータ】
${dataStr}

【7日間ファンディングレート推移】
${fundingSummary || "データなし"}

以下の構成で約2000字の日本語レポートを作成し、JSONで返してください（他のテキスト不要）:
{
  "reportDate": "${new Date().toISOString()}",
  "title": "Hyperliquid週次スマートマネーレポート",
  "sections": {
    "marketOverview": "市場概況（300-400字）",
    "smartMoneyActivity": "スマートマネー活動分析（400-500字）",
    "fundingRateAnalysis": "ファンディングレート詳細分析（300-400字）",
    "topOpportunities": "注目トークンと機会（300-400字）",
    "riskFactors": "リスク要因（200-300字）",
    "outlook": "来週の展望（200-300字）"
  },
  "keyMetrics": {
    "totalOI": "全体OI概算",
    "dominantBias": "LONG or SHORT or NEUTRAL",
    "marketTemperature": "HOT or WARM or COOL",
    "topToken": "最注目トークン"
  },
  "tokenSummaries": [
    {"token": "BTC", "bias": "LONG", "fundingSignal": "NORMAL", "note": "短評"}
  ]
}`,
        },
      ],
    });

    const textContent = message.content.find((c) => c.type === "text");
    let report: Record<string, unknown> = {};
    if (textContent && textContent.type === "text") {
      const m = textContent.text.match(/\{[\s\S]*\}/);
      if (m) report = JSON.parse(m[0]);
    }

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      type: "weekly_report",
      marketData: tokenData,
      report,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Weekly report generation failed", details: String(error) },
      { status: 500 }
    );
  }
}

export const GET = withX402(
  handler,
  {
    accepts: [
      {
        scheme: "exact",
        price: "$2.00",
        network: "eip155:8453",
        payTo,
      },
    ],
    description: "Hyperliquid Weekly Smart Money Intelligence Report",
    mimeType: "application/json",
  },
  x402Server
);
