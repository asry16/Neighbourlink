import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { DemoProvider } from "@/context/demo-context";
import { Analytics } from "@vercel/analytics/next";

const heading = Bricolage_Grotesque({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const ui = Instrument_Sans({
  variable: "--font-ui",
  subsets: ["latin"],
});

const code = JetBrains_Mono({
  variable: "--font-code",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Neighbourlink — Community hazard & emergency coordination",
  description:
    "Real-time hazard awareness, transparent flood-risk estimation, citizen reporting, independent corroboration and emergency coordination.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Draw under notches / home indicator; layout pads with safe-area insets.
  viewportFit: "cover",
  // Let the keyboard resize the layout so forms stay scrollable.
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f6f3" },
    { media: "(prefers-color-scheme: dark)", color: "#131210" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${heading.variable} ${ui.variable} ${code.variable} h-full antialiased`}
    >
      <body className="h-full flex flex-col overflow-hidden">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <DemoProvider>{children}</DemoProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
