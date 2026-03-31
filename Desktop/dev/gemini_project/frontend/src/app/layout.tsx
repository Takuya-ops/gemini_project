import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Video Analyzer - Google Drive動画分析",
  description: "Google Driveの動画をGemini AIで分析し、結果をメールで送信",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className="bg-gray-50 text-gray-900 min-h-screen">{children}</body>
    </html>
  );
}
