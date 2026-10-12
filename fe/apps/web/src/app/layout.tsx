import type { Metadata, Viewport } from "next";
import { Open_Sans } from "next/font/google";
import type { CSSProperties, ReactNode } from "react";
import { Providers } from "@/components/providers/Providers";
import { getLocale } from "@/i18n/server";
import "./globals.css";

const openSans = Open_Sans({ subsets: ["latin", "vietnamese"] });

export const metadata: Metadata = {
  title: "NIVO OS",
  description: "The responsibility operating system for founder-led service businesses.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

type RootLayoutProps = { readonly children: ReactNode };

/** Root document: Open Sans on the body, the reader's locale, and the provider stack. */
const RootLayout = async ({ children }: RootLayoutProps) => {
  const locale = await getLocale();
  return (
  <html lang={locale} suppressHydrationWarning>
    <body
      className="min-h-dvh bg-background text-foreground antialiased"
      style={{ "--font-open-sans": openSans.style.fontFamily } as CSSProperties}
    >
      <Providers locale={locale}>{children}</Providers>
    </body>
  </html>
  );
};

export default RootLayout;
