"use client"

import { useLocale } from "next-intl"
import { useModuleCatalog } from "@/hooks/moduleCatalog"
import { pickCopy } from "@/modules/catalog"
import type { ModuleKey } from "@/modules/catalog"

/** The name of an agent type in the reader language. */
export const useModuleName = (module: ModuleKey | null, kind: "name" | "shortName" = "name"): string => {
    const locale = useLocale() === "en" ? "en" : "vi"
    const { modules, slot } = useModuleCatalog()
    const copy = module === null ? undefined : modules[module]
    const fallbackName = slot.isError === true ? (module ?? "") : ""
    return copy === undefined ? fallbackName : pickCopy(copy[kind], locale)
}
