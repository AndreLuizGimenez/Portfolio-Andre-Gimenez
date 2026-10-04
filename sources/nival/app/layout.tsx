/* Estrutura compartilhada: metadados, viewport, folhas de estilo e pré-carregamento das fontes.
 * O fallback noscript mantém conteúdo acessível quando o JavaScript não executa. */
import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./experience.css";
import "./purchase.css";
import "./loading.css";
import "./large-screens.css";

// Let backgrounds extend edge to edge. Only important content uses the
// browser's safe insets; no reserved strip follows the Safari toolbar.
export const viewport: Viewport = {
  width: 'device-width', initialScale: 1, viewportFit: 'cover',
  colorScheme: 'light',
};

export const metadata: Metadata = {
  title: '"XXXX" — Sua noite em outro clima',
  description: 'Conforto que se adapta a você. Conheça a proposta "XXXX" com espuma viscoelástica e tecnologia de regulação térmica Hot & Cold.',
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preload" href="/demos/nival/fonts/manrope-variable.woff2" as="font" type="font/woff2" crossOrigin="anonymous"/>
        <link rel="preload" href="/demos/nival/fonts/dm-sans-variable.woff2" as="font" type="font/woff2" crossOrigin="anonymous"/>
      </head>
      <body className="antialiased"><noscript><style>{'.site-loader{display:none!important}.site-loader~.nival-page{visibility:visible!important;pointer-events:auto!important}html:has(.site-loader){overflow:auto!important;background:#fff!important}.story.is-ready{height:auto!important}.story.is-ready .story-stage{height:auto!important;position:relative!important}.story.is-ready .story-poster{display:block!important}.story.is-ready .story-steps{flex-basis:auto!important}.story.is-ready .story-chapter{display:block!important;position:relative!important;inset:auto!important;padding:32px 24px!important}'}</style></noscript>{children}</body>
    </html>
  );
}
