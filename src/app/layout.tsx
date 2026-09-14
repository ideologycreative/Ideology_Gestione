import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "@/styles/ideology-tokens.css";
import "@/styles/monthpicker.css";
import "@/styles/app.css";
import "@/styles/auth.css";

/**
 * next/font self-hosts these (no external Google Fonts request at runtime)
 * but keeps the real family names 'Inter' / 'Plus Jakarta Sans' — the same
 * literal names ideology-tokens.css's --font/--font-display/--mono already
 * reference, so nothing in the ported CSS needs to change.
 */
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-plus-jakarta-sans",
});

export const metadata: Metadata = {
  title: "Ideology Studio",
  description: "Ideology Creative Studio — pianificazione contenuti social",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it" data-theme="light" className={`${inter.variable} ${plusJakartaSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
