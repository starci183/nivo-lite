"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { useGraphQLWithToast } from "@/modules/toast"
import { refreshShifts } from "./shiftsCommands.shared"

/** Runs a shifts write with the "saved" toast and revalidates the reads; answers whether it went through (a failure was toasted). */
export const useShiftsSaved = (): (<T>(action: () => Promise<T>) => Promise<boolean>) => {
    const t = useTranslations("shifts")
    const run = useGraphQLWithToast()
    return useCallback(
        async <T>(action: () => Promise<T>): Promise<boolean> => {
            const result = await run(action, { successMessage: t("saved") })
            await refreshShifts()
            return result !== undefined
        },
        [run, t],
    )
}
