import type { Metadata } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/providers/app-providers";
import { TailwindDebug } from "@/components/debug/tailwind-debug";

const display = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

const body = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BluBook",
  description:
    "Unified operations platform for customer, partner, sales and logistics workflows.",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="theme-light">
      <body className={`${display.variable} ${body.variable}`}>
        <TailwindDebug />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
