# HYPERLIQUID INTELLIGENCE

**Hyperliquidのスマートマネーポジション × 予測市場の乖離を検出する**  
**Detect smart money divergence between Hyperliquid perpetuals and prediction markets**

---

## 概要 / Overview

x402 Hyperliquid Intelligenceは、オンチェーンPerpDEX「Hyperliquid」上のスマートマネー取引データをNansen APIで取得し、Polymarketの予測市場データと組み合わせてClaudeが統合分析を行うインテリジェンスツールです。

x402 Hyperliquid Intelligence is an AI-powered analysis tool that aggregates smart money perpetual trading data from Hyperliquid via the Nansen API, cross-references it with Polymarket prediction market probabilities, and delivers integrated analysis powered by Claude.

各APIエンドポイントは **x402プロトコル v2**（Base / Solana 上のUSDC少額決済）で保護されており、エージェントやウォレットから直接アクセスできます。ネットワーク識別子はCAIP-2形式（`eip155:8453` / `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`）を使用します。

Each API endpoint is protected by the **x402 protocol v2** (micro-payments in USDC on Base or Solana), making them directly accessible by AI agents and wallets. Network identifiers use CAIP-2 format (`eip155:8453` / `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`).

---

## 機能 / Features

- **スマートマネーポジション追跡** — Nansen APIによるHyperliquid上の機関投資家・ウォレットのlong/shortポジション
- **ファンディングレート分析** — 過熱・冷却・売り圧力シグナルの検出
- **Polymarket乖離スコア** — オンチェーンポジションvs予測市場確率の乖離を数値化
- **HIP-3 Hyperperps分析** — 上場前トークンのスマートマネー蓄積動向
- **週次インテリジェンスレポート** — 約2000字の日本語詳細レポート
- **ターミナル風リアルタイムUI** — 30秒ごとに自動更新

---

- **Smart money position tracking** — Long/short positions of institutional wallets on Hyperliquid via Nansen API
- **Funding rate analysis** — Detection of overheated, cooling, and sell-pressure signals
- **Polymarket divergence score** — Quantifies the gap between on-chain positioning and prediction market probabilities
- **HIP-3 Hyperperps analysis** — Smart money accumulation on pre-listing tokens
- **Weekly intelligence report** — ~2,000 character detailed Japanese report
- **Terminal-style real-time UI** — Auto-refreshes every 30 seconds

---

## APIエンドポイント / API Endpoints

すべてのエンドポイントはx402プロトコルで保護されています。Base上のUSDCで自動決済されます。

All endpoints are protected by x402. Payments are settled automatically in USDC on Base.

| エンドポイント | 価格 | 説明 |
|---|---|---|
| `GET /api/hyperliquid/positions?token=ETH` | $0.20 | トークン別スマートマネー分析 + Polymarket乖離スコア |
| `GET /api/hyperliquid/scan` | $0.30 | 全トークンスキャン、乖離スコアTop10 |
| `GET /api/hyperliquid/hyperps` | $0.50 | HIP-3上場前トークンのポジション動向 |
| `GET /api/hyperliquid/weekly` | $2.00 | 週次Hyperliquidスマートマネーレポート |

### レスポンス例 / Sample Response (`/api/hyperliquid/positions?token=ETH`)

```json
{
  "token": "ETH",
  "analyzedAt": "2026-05-20T00:00:00Z",
  "hyperliquid": {
    "openInterest": 1250000000,
    "fundingRate": 0.0125,
    "markPrice": 2850.5,
    "smartMoneyLongRatio": 0.72
  },
  "polymarket": {
    "question": "Will ETH be above $3000 by June?",
    "probability": 0.61
  },
  "analysis": {
    "smartMoneyBias": "LONG",
    "biasStrength": 0.78,
    "fundingSignal": "OVERHEATED",
    "divergenceScore": 0.17,
    "divergenceType": "ALIGNED",
    "keySignals": ["スマートマネーが強くロングを積み上げ中", "ファンディング過熱に注意"],
    "analysis_ja": "ETHのスマートマネーは強いロングバイアスを示しており...",
    "confidence": 0.82
  }
}
```

---

## データソース / Data Sources

| ソース | 用途 | 認証 |
|---|---|---|
| [Hyperliquid Info API](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api) | OI・ファンディングレート・マーク価格 | 不要（無料） |
| [Nansen API](https://docs.nansen.ai/) | スマートマネーポジションデータ | `NANSEN_API_KEY` |
| [Polymarket Gamma API](https://docs.polymarket.com/) | 予測市場確率 | 不要（無料） |
| [Anthropic Claude](https://docs.anthropic.com/) | 統合分析・レポート生成 | `ANTHROPIC_API_KEY` |

---

## セットアップ / Setup

### 必要環境 / Requirements

- Node.js 20+
- npm 10+

### x402 v2 + CDP Facilitator

本プロジェクトは **x402 v2** を使用します。決済処理には Coinbase Developer Platform (CDP) の facilitator を推奨します。

This project uses **x402 v2**. The Coinbase Developer Platform (CDP) facilitator is recommended for production payment processing.

CDP API キーの取得 / Get CDP API keys: [https://portal.cdp.coinbase.com/](https://portal.cdp.coinbase.com/)

### インストール / Install

```bash
git clone https://github.com/kato9292929/x402-hyperliquid-intelligence.git
cd x402-hyperliquid-intelligence
npm install
```

### 環境変数 / Environment Variables

`.env.local` を作成し以下を設定 / Create `.env.local` and configure:

```env
# CDP API キー (x402 v2 facilitator 用・必須)
CDP_API_KEY_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
CDP_API_KEY_SECRET=your_base64_secret==

# Facilitator URL (v2)
FACILITATOR_URL=https://api.cdp.coinbase.com/platform/v2/x402

# EVM 受領ウォレット (Base)
WALLET_ADDRESS=0xYourEvmWalletAddress

# Solana 受領ウォレット (base58)
SOLANA_WALLET_ADDRESS=YourSolanaWalletAddress

# 外部 API
NANSEN_API_KEY=your_nansen_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=your_key

# アプリ URL
NEXT_PUBLIC_APP_URL=https://your-project.vercel.app
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
```

### 開発サーバー起動 / Run Dev Server

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) でアクセス / Open at http://localhost:3000

### ビルド / Build

```bash
npm run build
npm start
```

---

## Vercelデプロイ / Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

1. Vercelにリポジトリをインポート
2. 環境変数を設定（上記参照）
3. デプロイ実行

---

1. Import the repository to Vercel
2. Set environment variables (see above)
3. Deploy

---

## x402プロトコルについて / About x402

x402はHTTP 402 Payment Requiredステータスコードを活用した、AIエージェント向けのマイクロペイメントプロトコルです。ウォレットがAPIにアクセスする際、自動的にUSDCで決済が行われます。

x402 is a micro-payment protocol for AI agents leveraging the HTTP 402 Payment Required status code. When a wallet-enabled agent accesses an API, payment in USDC is settled automatically.

詳細 / More info: [x402.org](https://x402.org)

---

## 技術スタック / Tech Stack

- **フレームワーク / Framework**: Next.js 15 (App Router)
- **決済 / Payments**: x402 v2 (`@x402/next`, `@x402/core`, `@x402/evm`, `@x402/svm`, `@coinbase/x402`)
- **AI分析 / AI Analysis**: Anthropic Claude (`claude-sonnet-4-6`)
- **チェーン / Chain**: Base `eip155:8453` / Solana `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`
- **UI**: React 19, CSS Modules
- **型安全 / Type Safety**: TypeScript (strict)

---

## 免責事項 / Disclaimer

本ツールは情報提供のみを目的としています。投資判断はご自身でお願いします。

This tool is for informational purposes only. All investment decisions are your own responsibility.
