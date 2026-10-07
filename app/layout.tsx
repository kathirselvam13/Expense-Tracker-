import type { Metadata } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import { Toaster } from "@/components/ui/sonner";
import "@flaticon/flaticon-uicons/css/regular/rounded.css";
import "./globals.css";

const inter = localFont({
  src: "./fonts/Inter-Variable.ttf",
  weight: "100 900",
  variable: "--font-inter",
  display: "swap",
});

const poppins = localFont({
  src: [
    { path: "./fonts/Poppins-Medium.ttf", weight: "500", style: "normal" },
    { path: "./fonts/Poppins-SemiBold.ttf", weight: "600", style: "normal" },
  ],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Expense Tracker",
  description: "A clear view of your everyday spending, saved on this device.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${poppins.variable}`}>
      <body>{children}<Toaster /></body>
    </html>
  );
}
