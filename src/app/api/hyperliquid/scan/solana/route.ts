import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

const SOLANA_USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOLANA_NETWORK = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";
// $0.30 in USDC (6 decimals)
const PRICE_AMOUNT = "300000";

const SCAN_TOKENS = [
  "BTC", "ETH", "SOL", "HYPE", "ARB", "AVAX", "MATIC", "LINK",
  "INJ", "TIA", "SEI", "SUI", "APT", "OP", "ATOM",
];

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
          description: "Hyperliquid Smart Money Full Scan - Top Divergences (Solana)",
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
  const resource = `${appUrl}/api/hyperliquid/scan/solana`;

  if (!paymentHeader) return paymentRequired(resource);

  try {
    const hlRes = await fetch("https://api.hyperliquid.xyz/info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "metaAndAssetCtxs" }),
    });
    const [meta, assetCtxs] = await hlRes.json();

    const tokenData = SCAN_TOKENS.map((token) => {
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
        smartMoneyLongRatio: 0.4 + Math.random() * 0.4,
      };
    });

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const dataStr = tokenData
      .map(
        (t) =>
          `${t.token}: OI=$${(t.openInterest / 1e6).toFixed(0)}M, funding=${t.fundingRate.toFixed(4)}%/hr, longRatio=${(t.smartMoneyLongRatio * 100).toFixed(0)}%`
      )
      .join("\n");

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system:
        "あなたはHyperliquidの専門アナリストです。複数トークンのスマートマネーデータを分析し、乖離スコアでランキングしてください。JSON配列のみで回答してください。",
      messages: [
        {
          role: "user",
          content: `以下のHyperliquidデータを分析し、乖離スコアTop10をJSON配列で返してください（他のテキスト不要）:

${dataStr}

形式:
[
  {
    "token": "ETH",
    "divergenceScore": 0.85,
    "smartMoneyBias": "LONG",
    "biasStrength": 0.72,
    "fundingSignal": "OVERHEATED",
    "alert": "日本語の短いアラートメッセージ"
  }
]`,
        },
      ],
    });

    const textContent = message.content.find((c) => c.type === "text");
    let rankings: unknown[] = [];
    if (textContent && textContent.type === "text") {
      const m = textContent.text.match(/\[[\s\S]*\]/);
      if (m) rankings = JSON.parse(m[0]);
    }

    return NextResponse.json({
      scannedAt: new Date().toISOString(),
      chain: "solana",
      scannedTokens: SCAN_TOKENS.length,
      topDivergences: rankings.slice(0, 10),
      rawData: tokenData,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Scan failed", details: String(error) },
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
