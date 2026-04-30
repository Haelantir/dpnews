import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DeepNews",
  description: "뉴스와 지식이 연결되는 공간",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 1.25rem" }}>
          <header
            style={{
              borderBottom: "2px solid #1a1a1a",
              padding: "1rem 0 0.75rem",
              marginBottom: "2rem",
              display: "flex",
              alignItems: "baseline",
              gap: "1.5rem",
            }}
          >
            <a
              href="/"
              style={{
                fontWeight: 800,
                fontSize: "1.2rem",
                color: "#1a1a1a",
                letterSpacing: "-0.03em",
              }}
            >
              DeepNews
            </a>
            <nav style={{ display: "flex", gap: "1.25rem", fontSize: "0.875rem" }}>
              <a href="/" style={{ color: "#333" }}>최신 뉴스</a>
              <a href="/knowledge" style={{ color: "#333" }}>지식 사전</a>
              <a href="/admin" style={{ color: "#888" }}>관리</a>
            </nav>
          </header>
          <main>{children}</main>
          <footer
            style={{
              borderTop: "1px solid #e0e0e0",
              marginTop: "4rem",
              padding: "1.5rem 0",
              fontSize: "0.8rem",
              color: "#999",
            }}
          >
            DeepNews
          </footer>
        </div>
      </body>
    </html>
  );
}
