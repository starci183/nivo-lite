"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { mutate } from "swr"
import { QUERY_MY_WORKSPACES_SWR_KEY, useMutateAcceptInviteSwr } from "@/hooks/swr"
import { useActiveWorkspace } from "@/hooks/workspaces"
import { useGraphQLWithToast } from "@/modules/toast"
import { matchesSwrKey } from "@/modules/utils"

/**
 * Accepts an invitation for the signed-in person through the back end and toasts the outcome (a failure shows the server-localized
 * reason). On success the joined workspace becomes the active one and the workspaces list is revalidated. Answers the joined
 * workspace id, or `undefined` when it failed.
 */
export const useAcceptInvite = () => {
    const t = useTranslations("invite")
    const runGraphQL = useGraphQLWithToast()
    const { trigger, isMutating } = useMutateAcceptInviteSwr()
    const { select } = useActiveWorkspace()
    const accept = useCallback(
        async (token: string): Promise<string | undefined> => {
            const joined = await runGraphQL(() => trigger({ token }), { successMessage: t("joined") })
            if (joined === undefined) return undefined
            select(joined.workspaceId)
            await mutate(matchesSwrKey(QUERY_MY_WORKSPACES_SWR_KEY))
            return joined.workspaceId
        },
        [runGraphQL, trigger, select, t],
    )
    return { accept, isAccepting: isMutating }
}
