"use client"

import { useLocale } from "next-intl"
import { useModuleCatalog } from "@/hooks/moduleCatalog"
import { isModuleKey, pickCopy } from "@/modules/catalog"

/** What an agent of a type does, in the reader language ("Ban hang"): the type's name, or its key when the catalogue does not name it. */
export const useTagRole = (): ((module: string) => string) => {
    const locale = useLocale() === "en" ? "en" : "vi"
    const { modules } = useModuleCatalog()
    return (module) => {
        const copy = isModuleKey(module) ? modules[module] : undefined
        return copy === undefined ? module : pickCopy(copy.name, locale)
    }
}
