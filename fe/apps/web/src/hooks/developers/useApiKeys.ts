"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { useMutateCreateApiKeySwr, useMutateRevokeApiKeySwr, useQueryApiKeysSwr } from "@/hooks/swr"
import { useActiveWorkspace } from "@/hooks/workspaces"
import { useGraphQLWithToast } from "@/modules/toast"

/**
 * The API keys of the active workspace with their two writes. Each write toasts its outcome (a failure shows the server-localized
 * message) and refreshes the list on success. `create` answers the secret once, or `undefined` when it failed.
 */
export const useApiKeys = () => {
    const t = useTranslations("developers")
    const runGraphQL = useGraphQLWithToast()
    const { activeWorkspaceId } = useActiveWorkspace()
    const keys = useQueryApiKeysSwr(activeWorkspaceId)
    const creation = useMutateCreateApiKeySwr()
    const revocation = useMutateRevokeApiKeySwr()
    const { mutate } = keys
    const create = useCallback(
        async (name: string): Promise<string | undefined> => {
            const created = await runGraphQL(() => creation.trigger({ name }), { successMessage: t("keyCreated") })
            if (created === undefined) return undefined
            await mutate()
            return created.key
        },
        [runGraphQL, creation, mutate, t],
    )
    const revoke = useCallback(
        async (keyId: string): Promise<boolean> => {
            const revoked = await runGraphQL(() => revocation.trigger({ keyId }), { successMessage: t("keyRevoked") })
            if (revoked === undefined) return false
            await mutate()
            return true
        },
        [runGraphQL, revocation, mutate, t],
    )
    return {
        items: keys.data ?? [],
        isLoading: keys.isLoading,
        loadFailed: keys.error !== undefined,
        create,
        isCreating: creation.isMutating,
        revoke,
        isRevoking: revocation.isMutating,
    }
}
