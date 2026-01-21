import type { Metadata } from "next";
import "./globals.css";
import BottomNav from "../components/BottomNav";
import TopBar from "../components/TopBar";
import PageTransition from "./components/PageTransition";
import { AdminProvider } from "./contexts/AdminContext";

export const metadata: Metadata = {
  title: "TL Raid Manager",
  description: "Raid Manager pour Throne and Liberty",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "TL Raid Manager",
    statusBarStyle: "black",
  },
};

export const viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 0.9,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" translate="no">
      <body className="antialiased">
        <AdminProvider>
          <meta name="google" content="notranslate" />
          <TopBar />
          <PageTransition>{children}</PageTransition>
          <BottomNav />
        </AdminProvider>
      </body>
    </html>
  );
}
