import type { ReactNode } from "react";
import { SiteNav } from "../components/SiteNav";

export const metadata = { title: "Studio Fable (CellNav + Next.js)" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "Georgia, serif", background: "#faf8f3" }}>
        <header style={{ padding: 16 }}>
          <SiteNav />
        </header>
        <main style={{ padding: "0 24px 48px", maxWidth: 760, margin: "0 auto" }}>{children}</main>
      </body>
    </html>
  );
}
