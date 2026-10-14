"use client"

import { useTranslations } from "next-intl"
import type { InventorySay } from "@/modules/types"

/** The sentences of the workbench catalog as one function, for the pure halves that draw them. */
export const useSay = (): InventorySay => {
    const t = useTranslations("workbenchInventory")
    return (key, params) => t(key, params)
}
