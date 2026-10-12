"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { DEFAULT_LOCALE, translator, type Dict, type Locale } from "./core";

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

/** Provides the locale read on the server to every client component. */
export const LocaleProvider = ({ locale, children }: { readonly locale: Locale; readonly children: ReactNode }) => (
  <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
);

export const useLocale = (): Locale => useContext(LocaleContext);

/** Client-side translator for one namespace dictionary. */
export const useT = <T extends Record<string, string>>(dict: Dict<T>) => {
  const locale = useLocale();
  return useMemo(() => translator(dict, locale), [dict, locale]);
};
