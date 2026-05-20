import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HYPERLIQUID INTELLIGENCE",
  description: "Hyperliquidのスマートマネーポジション × 予測市場の乖離を検出する",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
