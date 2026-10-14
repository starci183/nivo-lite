"use client"

import { useFormatter, useLocale, useTranslations } from "next-intl"
import { useMemo } from "react"
import { useModuleCatalog } from "@/hooks/moduleCatalog"
import { isModuleKey, pickCopy } from "@/modules/catalog"
import type { OfficeWords } from "@/modules/office"

/** Resolves the words and the formats of the Office once per language. */
export const useOfficeWords = (): OfficeWords => {
    const t = useTranslations("office")
    const g = useTranslations("governance")
    const format = useFormatter()
    const locale = useLocale() === "en" ? "en" : "vi"
    const { modules, slot } = useModuleCatalog()
    const isCatalogError = slot.isError === true
    return useMemo<OfficeWords>(() => {
        const time = (iso: string) => format.dateTime(new Date(iso), { hour: "2-digit", minute: "2-digit" })
        const day = (iso: string) => format.dateTime(new Date(iso), { day: "numeric", month: "short" })
        return {
            t: (key, values) => t(key, values),
            g: (key, values) => g(key, values),
            time,
            day,
            stamp: (iso) => `${time(iso)}, ${day(iso)}`,
            money: (amount) => format.number(amount, { style: "currency", currency: "VND", maximumFractionDigits: 0 }),
            moduleName: (module) => {
                if (!isModuleKey(module)) return module
                const copy = modules[module]
                const fallbackName = isCatalogError ? module : ""
                return copy === undefined ? fallbackName : pickCopy(copy.name, locale)
            },
        }
    }, [t, g, format, locale, modules, isCatalogError])
}
