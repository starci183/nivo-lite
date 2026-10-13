"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { mutate } from "swr"
import {
    QUERY_MY_ACCOUNT_SWR_KEY,
    QUERY_MY_WORKSPACES_SWR_KEY,
    useMutateRevokeSessionSwr,
    useMutateUpdateProfileSwr,
} from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"

/**
 * The account writes that go through the back end, each toasted (the failure with the server-localized message):
 * `saveProfile` saves the display name (the account and the workspaces are revalidated), `revokeSession` signs one other device
 * out (the device list is revalidated). Each answers whether it worked.
 */
export const useAccountCommands = () => {
    const t = useTranslations("account")
    const runGraphQL = useGraphQLWithToast()
    const profile = useMutateUpdateProfileSwr()
    const session = useMutateRevokeSessionSwr()
    const saveProfile = useCallback(
        async (name: string): Promise<boolean> => {
            const saved = await runGraphQL(() => profile.trigger({ name }), { successMessage: t("profileSaved") })
            if (saved === undefined) return false
            await Promise.all([mutate(QUERY_MY_ACCOUNT_SWR_KEY), mutate(QUERY_MY_WORKSPACES_SWR_KEY)])
            return true
        },
        [runGraphQL, profile, t],
    )
    const revokeSession = useCallback(
        async (sessionId: string): Promise<boolean> => {
            const revoked = await runGraphQL(() => session.trigger({ sessionId }), {
                successMessage: t("sessionRevoked"),
            })
            if (revoked === undefined) return false
            await mutate(QUERY_MY_ACCOUNT_SWR_KEY)
            return true
        },
        [runGraphQL, session, t],
    )
    return { saveProfile, isSaving: profile.isMutating, revokeSession, isRevoking: session.isMutating }
}
