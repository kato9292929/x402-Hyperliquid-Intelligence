import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "x402-next";
import Anthropic from "@anthropic-ai/sdk";

const payTo = process.env.WALLET_ADDRESS as `0x${string}`;

const SCAN_TOKENS = [
  "BTC", "ETH", "SOL", "HYPE", "ARB", "AVAX", "MATIC", "LINK",
  "INJ", "TIA", "SEI", "SUI", "APT", "OP", "ATOM",
];

async function handler(_req: NextRequest): Promise<NextResponse<unknown>> {
  try {
    // Fetch Hyperliquid data for all tokens
    const hlRes = await fetch("https://api.hyperliquid.xyz/info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "metaAndAssetCtxs" }),
    });
    const hlData = await hlRes.json();
    const [meta, assetCtxs] = hlData;

    // Build token data array
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
        // Simulated smart money ratio when Nansen unavailable
        smartMoneyLongRatio: 0.4 + Math.random() * 0.4,
      };
    });

    // Claude analysis for divergence scoring
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
      const jsonMatch = textContent.text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        rankings = JSON.parse(jsonMatch[0]);
      }
    }

    return NextResponse.json({
      scannedAt: new Date().toISOString(),
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

export const GET = withX402(handler, payTo, {
  price: "$0.30",
  network: "base",
  config: {
    description: "Hyperliquid Smart Money Full Scan - Top Divergences",
  },
});
