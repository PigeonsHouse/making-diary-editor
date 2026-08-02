import type {Metadata} from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "製作日誌動画エディター",
  description: "製作記録を会話動画へ",
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="ja">
      <body>
        <header className="app-header">
          <Link href="/" className="brand">
            MAKING DIARY
          </Link>
          <nav>
            <Link href="/">プロジェクト</Link>
            <Link href="/characters">キャラクター</Link>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
