"use client"

import { useLocale as useIntlLocale, useTranslations } from "next-intl"
import { useMemo, type ReactNode } from "react"
import { toLocale, type Dict, type Locale, type RawT, type Translate } from "./core"

/** The locale the reader sees, from the next-intl provider of the locale layout. */
export const useLocale = (): Locale => toLocale(useIntlLocale())

/** Client-side translator for one namespace; compat shim over next-intl's `useTranslations`. */
export const useT = <T extends Record<string, string>>(dict: Dict<T>): Translate<T> => {
    const t = useTranslations(dict.ns) as unknown as RawT
    return useMemo<Translate<T>>(() => (key, vars) => t(key, vars), [t])
}

/** Compat shim (Providers still wraps with it): the locale now comes from the next-intl provider, so this passes children through. */
export const LocaleProvider = ({ children }: { readonly locale: Locale; readonly children: ReactNode }) => (
    <>{children}</>
)
