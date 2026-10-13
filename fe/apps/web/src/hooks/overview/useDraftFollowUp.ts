"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { mutate } from "swr"
import { useMutateDraftLeadExecutionSwr, QUERY_DASHBOARD_SWR_KEY } from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"

/**
 * Asks for a follow-up draft for the customer behind a responsibility. The draft is queued on the back end and waits for the
 * owner's approval (or is sent inside the granted authority). The outcome is toasted; the dashboard is read again on success.
 */
export const useDraftFollowUp = () => {
    const t = useTranslations("responsibilities")
    const runGraphQL = useGraphQLWithToast()
    const { trigger, isMutating } = useMutateDraftLeadExecutionSwr()
    const draft = useCallback(
        async (responsibilityId: string): Promise<void> => {
            const queued = await runGraphQL(() => trigger({ responsibilityId }), { successMessage: t("drafting") })
            if (queued === undefined) return
            await mutate((key) => Array.isArray(key) && key[0] === QUERY_DASHBOARD_SWR_KEY)
        },
        [runGraphQL, trigger, t],
    )
    return { draft, isDrafting: isMutating }
}
