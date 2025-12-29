import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Little Life - Economic Freedom",
  description: "경제적 자유를 위한 자산 관리 앱 - Happiness Unlocked",
  manifest: "/manifest.json",
  themeColor: "#1E3A5F",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Little Life",
  },
  icons: {
    icon: "/little-life-logo.png",
    apple: "/little-life-logo.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Little Life" />
        <link rel="apple-touch-icon" href="/little-life-logo.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
