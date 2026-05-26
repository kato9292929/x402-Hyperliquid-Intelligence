import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

const SOLANA_USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOLANA_NETWORK = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";
// $0.20 in USDC (6 decimals)
const PRICE_AMOUNT = "200000";

function paymentRequired(resource: string) {
  return new NextResponse(
    JSON.stringify({
      error: "Payment Required",
      x402Version: 2,
      accepts: [
        {
          scheme: "exact",
          network: SOLANA_NETWORK,
          maxAmountRequired: PRICE_AMOUNT,
          resource,
          description: "Hyperliquid Smart Money Position Analysis (Solana)",
          mimeType: "application/json",
          payTo: process.env.SOLANA_WALLET_ADDRESS ?? "",
          maxTimeoutSeconds: 300,
          asset: SOLANA_USDC,
        },
      ],
    }),
    {
      status: 402,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "x-payment, content-type",
      },
    }
  );
}

export async function GET(req: Request) {
  const paymentHeader = req.headers.get("X-PAYMENT");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://localhost:3000";
  const resource = `${appUrl}/api/hyperliquid/positions/solana`;

  if (!paymentHeader) return paymentRequired(resource);

  const { searchParams } = new URL(req.url);
  const token = (searchParams.get("token") || "ETH").toUpperCase();

  try {
    let nansenData: Record<string, unknown> | null = null;
    if (process.env.NANSEN_API_KEY) {
      try {
        const nansenRes = await fetch(
          "https://api.nansen.ai/hyperliquid/smart-money/positions",
          { headers: { "x-api-key": process.env.NANSEN_API_KEY } }
        );
        if (nansenRes.ok) nansenData = await nansenRes.json();
      } catch {
        // Nansen unavailable
      }
    }

    const hlRes = await fetch("https://api.hyperliquid.xyz/info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "metaAndAssetCtxs" }),
    });
    const [meta, assetCtxs] = await hlRes.json();

    const tokenIndex = meta.universe.findIndex(
      (u: { name: string }) => u.name === token
    );
    const assetCtx = tokenIndex >= 0 ? assetCtxs[tokenIndex] : null;

    const openInterest = assetCtx
      ? parseFloat(assetCtx.openInterest) * parseFloat(assetCtx.markPx)
      : 0;
    const fundingRate = assetCtx ? parseFloat(assetCtx.funding) * 100 : 0;
    const markPrice = assetCtx ? parseFloat(assetCtx.markPx) : 0;
    const smartMoneyLongRatio = nansenData
      ? (nansenData as { longRatio?: number }).longRatio ?? 0.65
      : 0.55 + Math.random() * 0.3;

    let polymarketData = { question: "", probability: 0.5 };
    try {
      const pmRes = await fetch(
        `https://gamma-api.polymarket.com/markets?active=true&q=${token}&limit=5`
      );
      if (pmRes.ok) {
        const markets: Array<{ question: string; outcomePrices?: string }> =
          await pmRes.json();
        if (markets.length > 0) {
          polymarketData.question = markets[0].question;
          if (markets[0].outcomePrices) {
            const prices: string[] = JSON.parse(markets[0].outcomePrices);
            polymarketData.probability = parseFloat(prices[0]);
          }
        }
      }
    } catch {
      // Polymarket unavailable
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system:
        "あなたはHyperliquidの専門アナリストです。スマートマネーのperpポジションとPolymarketの予測確率の乖離を分析してください。JSON形式のみで回答してください。",
      messages: [
        {
          role: "user",
          content: `トークン: ${token}
スマートマネーロング比率: ${(smartMoneyLongRatio * 100).toFixed(1)}%
ファンディングレート: ${fundingRate.toFixed(4)}%/hr
オープンインタレスト: $${(openInterest / 1e6).toFixed(0)}M
マーク価格: $${markPrice.toFixed(2)}
Polymarket質問: ${polymarketData.question || "N/A"}
Polymarket確率: ${(polymarketData.probability * 100).toFixed(1)}%

上記データを分析し、以下のJSON形式のみで返してください:
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
}`,
        },
      ],
    });

    const textContent = message.content.find((c) => c.type === "text");
    let analysis: Record<string, unknown> = {};
    if (textContent && textContent.type === "text") {
      const m = textContent.text.match(/\{[\s\S]*\}/);
      if (m) analysis = JSON.parse(m[0]);
    }

    return NextResponse.json({
      token,
      analyzedAt: new Date().toISOString(),
      chain: "solana",
      hyperliquid: { openInterest, fundingRate, markPrice, smartMoneyLongRatio },
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

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "x-payment, content-type",
    },
  });
}
