import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "@/styles/ideology-tokens.css";
import "@/styles/monthpicker.css";
import "@/styles/app.css";
import "@/styles/auth.css";

/**
 * next/font self-hosts these (no external Google Fonts request at runtime)
 * but keeps the real family names 'Inter' / 'Plus Jakarta Sans' /
 * 'JetBrains Mono' — the same literal names ideology-tokens.css's
 * --font/--font-display/--mono reference, so nothing in the ported CSS
 * needs to change beyond the token itself.
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

// --mono was quietly just Inter — every uppercase "machine text" label
// (status tokens, ids, timestamps) rendered in the body face, not a real
// monospace, so it never actually looked like the terminal-esque data
// styling the rest of the CSS around it implies.
const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "Ideology Studio",
  description: "Ideology Creative Studio — pianificazione contenuti social",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it" data-theme="light" className={`${inter.variable} ${plusJakartaSans.variable} ${jetBrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
