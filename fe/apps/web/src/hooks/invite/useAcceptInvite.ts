"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { mutate } from "@/modules/viewer-cache"
import { QUERY_MY_WORKSPACES_SWR_KEY, useMutateAcceptInviteSwr } from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"
import { matchesSwrKey } from "@/modules/utils"

/** The view `useAcceptInvite` returns. */
export interface AcceptInviteView {
    accept: (token: string) => Promise<string | undefined>
    isAccepting: boolean
}

/**
 * Accepts an invitation for the signed-in person through the back end and toasts the outcome (a failure shows the server-localized
 * reason). On success the workspaces list is revalidated. Answers the joined
 * workspace id, or `undefined` when it failed.
 */
export const useAcceptInvite = (): AcceptInviteView => {
    const t = useTranslations("invite")
    const runGraphQL = useGraphQLWithToast()
    const { trigger, isMutating } = useMutateAcceptInviteSwr()
    const accept = useCallback(
        async (token: string): Promise<string | undefined> => {
            const joined = await runGraphQL(() => trigger({ token }), { successMessage: t("joined") })
            if (joined === undefined) return undefined
            await mutate(matchesSwrKey(QUERY_MY_WORKSPACES_SWR_KEY))
            return joined.workspaceId
        },
        [runGraphQL, trigger, t],
    )
    return { accept, isAccepting: isMutating }
}
