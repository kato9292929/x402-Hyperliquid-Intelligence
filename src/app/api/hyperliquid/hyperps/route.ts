import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "x402-next";
import Anthropic from "@anthropic-ai/sdk";

const payTo = process.env.WALLET_ADDRESS as `0x${string}`;

async function handler(_req: NextRequest): Promise<NextResponse<unknown>> {
  try {
    // Fetch all Hyperliquid markets to find pre-launch (HIP-3) tokens
    const hlRes = await fetch("https://api.hyperliquid.xyz/info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "metaAndAssetCtxs" }),
    });
    const hlData = await hlRes.json();
    const [meta, assetCtxs] = hlData;

    // Find tokens with significant OI but low market cap (HIP-3 candidates)
    interface UniverseToken {
      name: string;
      szDecimals: number;
      maxLeverage: number;
      onlyIsolated?: boolean;
    }

    const allTokens = meta.universe.map(
      (u: UniverseToken, i: number) => ({
        token: u.name,
        openInterest:
          parseFloat(assetCtxs[i]?.openInterest || "0") *
          parseFloat(assetCtxs[i]?.markPx || "0"),
        fundingRate: parseFloat(assetCtxs[i]?.funding || "0") * 100,
        markPrice: parseFloat(assetCtxs[i]?.markPx || "0"),
        onlyIsolated: u.onlyIsolated || false,
      })
    );

    // HIP-3 tokens are typically newer, lower-cap tokens with unique characteristics
    // Filter for tokens with notable activity but potentially pre-main-listing
    const hyperpsTokens = allTokens
      .filter(
        (t: { token: string; openInterest: number; fundingRate: number; markPrice: number; onlyIsolated: boolean }) =>
          t.openInterest > 100000 &&
          !["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "AVAX", "MATIC"].includes(
            t.token
          )
      )
      .sort((a: { openInterest: number }, b: { openInterest: number }) => b.openInterest - a.openInterest)
      .slice(0, 20);

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const dataStr = hyperpsTokens
      .map(
        (t: { token: string; openInterest: number; fundingRate: number; markPrice: number; onlyIsolated: boolean }) =>
          `${t.token}: OI=$${(t.openInterest / 1e6).toFixed(2)}M, funding=${t.fundingRate.toFixed(4)}%/hr, price=$${t.markPrice.toFixed(4)}, isolatedOnly=${t.onlyIsolated}`
      )
      .join("\n");

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system:
        "あなたはHyperliquidのHIP-3（Hyperperps）専門アナリストです。上場前トークンのポジション動向を分析してください。",
      messages: [
        {
          role: "user",
          content: `以下のHyperliquid HIP-3候補トークンのデータを分析してください:

${dataStr}

JSON形式のみで返してください:
{
  "hyperpsTokens": [
    {
      "token": "TOKEN",
      "status": "PRE_LISTING" or "ACTIVE" or "HIGH_ACTIVITY",
      "smartMoneySignal": "ACCUMULATING" or "DISTRIBUTING" or "NEUTRAL",
      "fundingSignal": "OVERHEATED" or "NORMAL" or "NEGATIVE",
      "openInterest": 0.0,
      "fundingRate": 0.0,
      "alert": "日本語の短い分析",
      "riskLevel": "HIGH" or "MEDIUM" or "LOW"
    }
  ],
  "summary_ja": "HIP-3市場全体の200字以内の日本語サマリー",
  "topOpportunity": "最も注目すべきトークン名",
  "marketSentiment": "BULLISH" or "BEARISH" or "NEUTRAL"
}`,
        },
      ],
    });

    const textContent = message.content.find((c) => c.type === "text");
    let analysis: Record<string, unknown> = {};
    if (textContent && textContent.type === "text") {
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      }
    }

    return NextResponse.json({
      analyzedAt: new Date().toISOString(),
      type: "HIP-3 Hyperperps Analysis",
      rawTokens: hyperpsTokens,
      analysis,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Hyperps analysis failed", details: String(error) },
      { status: 500 }
    );
  }
}

export const GET = withX402(handler, payTo, {
  price: "$0.50",
  network: "base",
  config: {
    description: "HIP-3 Hyperperps Smart Money Position Analysis",
  },
});
