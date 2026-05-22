import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import { MissingKeyBanner } from "@/components/MissingKeyBanner";
import { AuthBootstrap } from "@/components/AuthBootstrap";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-brand",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "LearnMate",
  description: "Your personal study buddy",
  applicationName: "LearnMate",
  appleWebApp: {
    capable: true,
    title: "LearnMate",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0B0F0E",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${poppins.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-bg text-foreground">
        <AuthBootstrap />
        <MissingKeyBanner />
        {children}
      </body>
    </html>
  );
}
