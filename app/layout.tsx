import type { Metadata, Viewport } from "next";
import "./globals.css";
import VoiceDock from "@/components/VoiceDock";

export const metadata: Metadata = {
  title: "90 Numbers House Game",
  description: "Multiplayer 90 Numbers House Game",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

const themeScript = `
(function () {
  try {
    var t = localStorage.getItem('theme');
    if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen font-sans antialiased">
        {children}
        <VoiceDock />
      </body>
    </html>
  );
}
