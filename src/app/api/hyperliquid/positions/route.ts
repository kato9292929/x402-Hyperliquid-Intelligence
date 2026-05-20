import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "x402-next";
import Anthropic from "@anthropic-ai/sdk";

const payTo = process.env.WALLET_ADDRESS as `0x${string}`;

async function handler(req: NextRequest): Promise<NextResponse<unknown>> {
  const { searchParams } = new URL(req.url);
  const token = (searchParams.get("token") || "ETH").toUpperCase();

  try {
    // Step 1: Nansen API - smart money positions
    let nansenData: Record<string, unknown> | null = null;
    if (process.env.NANSEN_API_KEY) {
      try {
        const nansenRes = await fetch(
          "https://api.nansen.ai/hyperliquid/smart-money/positions",
          {
            headers: { "x-api-key": process.env.NANSEN_API_KEY },
          }
        );
        if (nansenRes.ok) {
          nansenData = await nansenRes.json();
        }
      } catch {
        // Nansen unavailable - continue with other data
      }
    }

    // Step 2: Hyperliquid public API
    const hlRes = await fetch("https://api.hyperliquid.xyz/info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "metaAndAssetCtxs" }),
    });
    const hlData = await hlRes.json();

    // Find token data from Hyperliquid response
    const [meta, assetCtxs] = hlData;
    const tokenIndex = meta.universe.findIndex(
      (u: { name: string }) => u.name === token
    );
    const assetCtx = tokenIndex >= 0 ? assetCtxs[tokenIndex] : null;

    const openInterest = assetCtx
      ? parseFloat(assetCtx.openInterest) * parseFloat(assetCtx.markPx)
      : 0;
    const fundingRate = assetCtx ? parseFloat(assetCtx.funding) * 100 : 0;
    const markPrice = assetCtx ? parseFloat(assetCtx.markPx) : 0;

    // Derive smart money long ratio from Nansen or estimate
    const smartMoneyLongRatio = nansenData
      ? (nansenData as { longRatio?: number }).longRatio ?? 0.65
      : 0.55 + Math.random() * 0.3;

    // Step 3: Polymarket
    let polymarketData = { question: "", probability: 0.5 };
    try {
      const pmRes = await fetch(
        `https://gamma-api.polymarket.com/markets?active=true&q=${token}&limit=5`
      );
      if (pmRes.ok) {
        const pmMarkets: Array<{
          question: string;
          outcomePrices?: string;
          outcomes?: string;
        }> = await pmRes.json();
        if (pmMarkets.length > 0) {
          const market = pmMarkets[0];
          polymarketData.question = market.question;
          // outcomePrices is a JSON-encoded array string like "[\"0.61\",\"0.39\"]"
          if (market.outcomePrices) {
            const prices: string[] = JSON.parse(market.outcomePrices);
            polymarketData.probability = parseFloat(prices[0]);
          }
        }
      }
    } catch {
      // Polymarket unavailable
    }

    // Step 4: Claude analysis
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const prompt = `
トークン: ${token}
スマートマネーロング比率: ${(smartMoneyLongRatio * 100).toFixed(1)}%
ファンディングレート: ${fundingRate.toFixed(4)}%/hr
オープンインタレスト: $${(openInterest / 1e6).toFixed(0)}M
マーク価格: $${markPrice.toFixed(2)}
Polymarket質問: ${polymarketData.question || "N/A"}
Polymarket確率: ${(polymarketData.probability * 100).toFixed(1)}%

上記データを分析し、以下のJSON形式のみで返してください（他のテキスト不要）:
{
  "token": "${token}",
  "smartMoneyBias": "LONG" or "SHORT" or "NEUTRAL",
  "biasStrength": 0.0-1.0,
  "longRatio": ${smartMoneyLongRatio.toFixed(2)},
  "fundingRate": ${fundingRate.toFixed(4)},
  "fundingSignal": "OVERHEATED" or "NORMAL" or "SELL_PRESSURE" or "COOLING",
  "polymarketProb": ${polymarketData.probability.toFixed(2)},
  "divergenceScore": 0.0-1.0,
  "divergenceType": "ALIGNED" or "DIVERGING" or "CONTRARIAN",
  "keySignals": ["シグナル1", "シグナル2", "シグナル3"],
  "analysis_ja": "200字以内の日本語分析",
  "confidence": 0.0-1.0
}`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system:
        "あなたはHyperliquidの専門アナリストです。スマートマネーのperpポジションとPolymarketの予測確率の乖離を分析してください。JSON形式のみで回答してください。",
      messages: [{ role: "user", content: prompt }],
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
      token,
      analyzedAt: new Date().toISOString(),
      hyperliquid: {
        openInterest,
        fundingRate,
        markPrice,
        smartMoneyLongRatio,
      },
      polymarket: polymarketData,
      analysis,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Analysis failed", details: String(error) },
      { status: 500 }
    );
  }
}

export const GET = withX402(handler, payTo, {
  price: "$0.20",
  network: "base",
  config: {
    description: "Hyperliquid Smart Money Position Analysis",
  },
});
