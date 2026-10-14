"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { useSWRConfig } from "swr"
import { QUERY_BOOKING_BOARD_SWR_KEY } from "@/hooks/swr"
import { matchesSwrKey } from "@/modules/utils"
import { useGraphQLWithToast } from "@/modules/toast"

/** Runs one setup write of the booking desk with the "saved" toast and refreshes the board after it succeeds; answers the result, or undefined when it failed (the toast already said why). */
export const useBookingSetupSave = () => {
    const t = useTranslations("workbenchBooking")
    const withToast = useGraphQLWithToast()
    const { mutate } = useSWRConfig()
    return useCallback(
        async <T>(action: () => Promise<T>) => {
            const answer = await withToast(action, { successMessage: t("saved") })
            if (answer !== undefined) await mutate(matchesSwrKey(QUERY_BOOKING_BOARD_SWR_KEY))
            return answer
        },
        [mutate, t, withToast],
    )
}
