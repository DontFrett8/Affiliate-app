import type { Metadata, Viewport } from "next";
import { Fraunces, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { getThemePref } from "@/lib/theme";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], style: ["normal", "italic"], axes: ["SOFT", "opsz"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "PinFlow", template: "%s · PinFlow" },
  description: "Amazon finds → Pinterest, beautifully scheduled",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "PinFlow", statusBarStyle: "default" },
  icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/icon-512.png", sizes: "512x512" }], apple: "/apple-icon.png" },
};

export async function generateViewport(): Promise<Viewport> {
  const pref = await getThemePref();
  const base = { width: "device-width", initialScale: 1, viewportFit: "cover" as const };
  if (pref === "light") return { ...base, themeColor: "#fdf7f5" };
  if (pref === "dark") return { ...base, themeColor: "#1b1016" };
  return {
    ...base,
    themeColor: [
      { media: "(prefers-color-scheme: light)", color: "#fdf7f5" },
      { media: "(prefers-color-scheme: dark)", color: "#1b1016" },
    ],
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const pref = await getThemePref();
  return (
    <html lang="en" data-theme={pref === "system" ? undefined : pref} suppressHydrationWarning className={`${jakarta.variable} ${fraunces.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
