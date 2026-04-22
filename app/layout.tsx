import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cascade V3 — ArcGIS",
  description: "Anticipatory disaster mapping with ArcGIS Maps SDK",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full dark">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;700&family=Source+Sans+Pro:wght@300;400;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="h-full bg-[#1a1a1a] text-[#f7f5f2]">{children}</body>
    </html>
  );
}
