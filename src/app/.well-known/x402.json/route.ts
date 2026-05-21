import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SOLANA_USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const EVM_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // USDC on Base

export async function GET() {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://localhost:3000";
  const evmPayTo = process.env.WALLET_ADDRESS ?? "";
  const solanaPayTo = process.env.SOLANA_WALLET_ADDRESS ?? "";

  const endpoints = [
    {
      path: "/api/hyperliquid/positions",
      method: "GET",
      description: "Hyperliquid Smart Money Position Analysis",
      accepts: [
        {
          scheme: "exact",
          network: "base",
          maxAmountRequired: "200000",
          payTo: evmPayTo,
          asset: EVM_USDC,
        },
      ],
    },
    {
      path: "/api/hyperliquid/positions/solana",
      method: "GET",
      description: "Hyperliquid Smart Money Position Analysis (Solana)",
      accepts: [
        {
          scheme: "exact",
          network: "solana-mainnet",
          maxAmountRequired: "200000",
          payTo: solanaPayTo,
          asset: SOLANA_USDC,
        },
      ],
    },
    {
      path: "/api/hyperliquid/scan",
      method: "GET",
      description: "Hyperliquid Smart Money Full Scan - Top Divergences",
      accepts: [
        {
          scheme: "exact",
          network: "base",
          maxAmountRequired: "300000",
          payTo: evmPayTo,
          asset: EVM_USDC,
        },
      ],
    },
    {
      path: "/api/hyperliquid/scan/solana",
      method: "GET",
      description: "Hyperliquid Smart Money Full Scan - Top Divergences (Solana)",
      accepts: [
        {
          scheme: "exact",
          network: "solana-mainnet",
          maxAmountRequired: "300000",
          payTo: solanaPayTo,
          asset: SOLANA_USDC,
        },
      ],
    },
    {
      path: "/api/hyperliquid/hyperps",
      method: "GET",
      description: "HIP-3 Hyperperps Smart Money Position Analysis",
      accepts: [
        {
          scheme: "exact",
          network: "base",
          maxAmountRequired: "500000",
          payTo: evmPayTo,
          asset: EVM_USDC,
        },
      ],
    },
    {
      path: "/api/hyperliquid/hyperps/solana",
      method: "GET",
      description: "HIP-3 Hyperperps Smart Money Position Analysis (Solana)",
      accepts: [
        {
          scheme: "exact",
          network: "solana-mainnet",
          maxAmountRequired: "500000",
          payTo: solanaPayTo,
          asset: SOLANA_USDC,
        },
      ],
    },
    {
      path: "/api/hyperliquid/weekly",
      method: "GET",
      description: "Hyperliquid Weekly Smart Money Intelligence Report",
      accepts: [
        {
          scheme: "exact",
          network: "base",
          maxAmountRequired: "2000000",
          payTo: evmPayTo,
          asset: EVM_USDC,
        },
      ],
    },
    {
      path: "/api/hyperliquid/weekly/solana",
      method: "GET",
      description: "Hyperliquid Weekly Smart Money Intelligence Report (Solana)",
      accepts: [
        {
          scheme: "exact",
          network: "solana-mainnet",
          maxAmountRequired: "2000000",
          payTo: solanaPayTo,
          asset: SOLANA_USDC,
        },
      ],
    },
  ];

  return NextResponse.json(
    {
      x402Version: 1,
      baseUrl: appUrl,
      endpoints: endpoints.map((ep) => ({
        ...ep,
        resource: `${appUrl}${ep.path}`,
      })),
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=300",
      },
    }
  );
}
