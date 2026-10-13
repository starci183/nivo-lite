"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { useMutateApplyShiftsImportSwr } from "@/hooks/swr/api/graphql/mutations/useMutateApplyShiftsImportSwr"
import { toast, useGraphQLWithToast } from "@/modules/toast"
import { refreshShifts } from "./shiftsCommands.shared"

/** The three lists a manager types. */
interface ShiftsImportInput {
    readonly positions: string
    readonly staff: string
    readonly coverage: string
}

/** The quick import: answers whether the lines were created (a failure was toasted with the back end words). */
export const useShiftsImportCommand = (): ((input: ShiftsImportInput) => Promise<boolean>) => {
    const t = useTranslations("shifts")
    const tToast = useTranslations("toast")
    const run = useGraphQLWithToast()
    const importing = useMutateApplyShiftsImportSwr()
    return useCallback(
        async (input: ShiftsImportInput): Promise<boolean> => {
            const result = await run(() => importing.trigger(input), { showSuccessToast: false })
            if (result === undefined) return false
            toast.success(tToast("successTitle"), {
                description: t("importDone", { p: result.positions, s: result.staff, b: result.blocks }),
            })
            await refreshShifts()
            return true
        },
        [run, importing, t, tToast],
    )
}
