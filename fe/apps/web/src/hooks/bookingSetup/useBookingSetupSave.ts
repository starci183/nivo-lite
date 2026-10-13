import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { useSWRConfig } from "swr"
import { isQueryBookingBoardSwrKey } from "@/hooks/swr/api/graphql"
import { useGraphQLWithToast } from "@/modules/toast"

/** Runs one setup write of the booking desk with the "saved" toast and refreshes the board after it succeeds; answers the result, or undefined when it failed (the toast already said why). */
export const useBookingSetupSave = () => {
    const t = useTranslations("workbenchBooking")
    const withToast = useGraphQLWithToast()
    const { mutate } = useSWRConfig()
    return useCallback(
        async <T>(action: () => Promise<T>) => {
            const answer = await withToast(action, { successMessage: t("saved") })
            if (answer !== undefined) await mutate(isQueryBookingBoardSwrKey)
            return answer
        },
        [mutate, t, withToast],
    )
}
