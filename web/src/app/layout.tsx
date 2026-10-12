import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Dota Metrics", template: "%s · Dota Metrics" },
  description:
    "Meta de Dota 2: taxa de vitória e de escolha dos heróis em partidas profissionais e de alto rank",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <header className="site-header">
          <Link href="/meta" className="brand">
            Dota Metrics
          </Link>
          <nav>
            <Link href="/meta">Meta</Link>
          </nav>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          Dados de partidas da{" "}
          <a href="https://www.opendota.com" target="_blank" rel="noreferrer">
            OpenDota
          </a>
          , atualizados a cada 15 minutos.
        </footer>
      </body>
    </html>
  );
}
