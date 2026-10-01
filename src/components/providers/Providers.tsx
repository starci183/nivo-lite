"use client";

import { I18nProvider } from "@heroui/react";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { NivoGrammarTheme } from "./NivoGrammarTheme";
import { LocaleProvider } from "@/i18n/client";
import { intlLocale, type Locale } from "@/i18n/core";

/** Props for {@link Providers}. */
export type ProvidersProps = { readonly children: ReactNode; readonly locale: Locale };

/** Client provider stack: locale, theme (light by default) and the nivo palette. */
export const Providers = ({ children, locale }: ProvidersProps) => (
  <LocaleProvider locale={locale}>
  <I18nProvider locale={intlLocale(locale)}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <NivoGrammarTheme>{children}</NivoGrammarTheme>
    </ThemeProvider>
  </I18nProvider>
  </LocaleProvider>
);
