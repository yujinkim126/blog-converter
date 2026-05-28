import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Blog Converter — ARTIENCE",
  description: "구글 독스 → Ghost 블로그 HTML 변환 및 발행 도구",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
