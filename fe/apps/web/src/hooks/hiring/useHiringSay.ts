"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import type { HiringSay } from "./hiring.shared"

/** The `hiring` catalog as a plain function, for the drawing halves of the Hiring blocks. */
export const useHiringSay = (): HiringSay => {
    const t = useTranslations("hiring")
    return useCallback((key, values) => t(key, values), [t])
}
