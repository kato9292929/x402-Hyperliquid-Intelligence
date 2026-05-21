import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

const SOLANA_USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
// $0.50 in USDC (6 decimals)
const PRICE_AMOUNT = "500000";

function paymentRequired(resource: string) {
  return new NextResponse(
    JSON.stringify({
      error: "Payment Required",
      x402Version: 1,
      accepts: [
        {
          scheme: "exact",
          network: "solana-mainnet",
          maxAmountRequired: PRICE_AMOUNT,
          resource,
          description: "HIP-3 Hyperperps Smart Money Position Analysis (Solana)",
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
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://localhost:3000";
  const resource = `${appUrl}/api/hyperliquid/hyperps/solana`;

  if (!paymentHeader) {
    return paymentRequired(resource);
  }

  try {
    const hlRes = await fetch("https://api.hyperliquid.xyz/info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "metaAndAssetCtxs" }),
    });
    const [meta, assetCtxs] = await hlRes.json();

    interface UniverseToken {
      name: string;
      szDecimals: number;
      maxLeverage: number;
      onlyIsolated?: boolean;
    }

    const allTokens = meta.universe.map((u: UniverseToken, i: number) => ({
      token: u.name,
      openInterest:
        parseFloat(assetCtxs[i]?.openInterest || "0") *
        parseFloat(assetCtxs[i]?.markPx || "0"),
      fundingRate: parseFloat(assetCtxs[i]?.funding || "0") * 100,
      markPrice: parseFloat(assetCtxs[i]?.markPx || "0"),
      onlyIsolated: u.onlyIsolated || false,
    }));

    const hyperpsTokens = allTokens
      .filter(
        (t: { token: string; openInterest: number; onlyIsolated: boolean }) =>
          t.openInterest > 100000 &&
          !["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "AVAX", "MATIC"].includes(
            t.token
          )
      )
      .sort(
        (
          a: { openInterest: number },
          b: { openInterest: number }
        ) => b.openInterest - a.openInterest
      )
      .slice(0, 20);

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const dataStr = hyperpsTokens
      .map(
        (t: {
          token: string;
          openInterest: number;
          fundingRate: number;
          markPrice: number;
          onlyIsolated: boolean;
        }) =>
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
      const m = textContent.text.match(/\{[\s\S]*\}/);
      if (m) analysis = JSON.parse(m[0]);
    }

    return NextResponse.json({
      analyzedAt: new Date().toISOString(),
      chain: "solana",
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
