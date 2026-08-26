import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Doeëg Mêin Haore | Bêij Jelle - Kapper Stokkem",
  description:
    "Kapsalon Doeëg Mêin Haore van Jelle Steutelings in Stokkem. Boek eenvoudig online je afspraak voor knippen, kleuring, balayage en meer.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Bêij Jelle",
  },
};

export const viewport: Viewport = {
  themeColor: "#241318",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl">
      <head>
        {/* Voorkomt een korte "flits" van het verkeerde thema bij het laden */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try {
              var t = localStorage.getItem('beijJelleTheme');
              if (t === 'light') document.documentElement.classList.add('light');
            } catch (e) {}`,
          }}
        />
      </head>
      <body className="font-body bg-deep text-cream antialiased">
        {/* Subtiel logo op de achtergrond, over alle pagina's */}
        <div
          aria-hidden
          className="fixed inset-0 -z-10 flex items-center justify-center pointer-events-none overflow-hidden"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-watermark.png"
            alt=""
            className="w-[900px] max-w-[120vw] h-auto"
            style={{ opacity: "var(--watermark-opacity)" }}
          />
        </div>
        {children}
      </body>
    </html>
  );
}
