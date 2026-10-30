"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { mutate } from "swr"
import { useMutateCreateWorkspaceSwr, QUERY_MY_WORKSPACES_SWR_KEY } from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"
import { matchesSwrKey } from "@/modules/utils"

/**
 * Creates a free workspace with its business type (a known key or the owner's words) through the back end and toasts the outcome. Answers the new workspace id, or `undefined` when it
 * failed (the failure was already toasted with the server-localized message). The workspaces list is revalidated on success.
 */
export const useCreateWorkspace = () => {
    const t = useTranslations("onboarding")
    const runGraphQL = useGraphQLWithToast()
    const { trigger, isMutating } = useMutateCreateWorkspaceSwr()
    const create = useCallback(
        async (name: string, businessType: string): Promise<string | undefined> => {
            const created = await runGraphQL(() => trigger({ name, businessType }), { successMessage: t("created") })
            if (created === undefined) return undefined
            await mutate(matchesSwrKey(QUERY_MY_WORKSPACES_SWR_KEY))
            return created.id
        },
        [runGraphQL, trigger, t],
    )
    return { create, isCreating: isMutating }
}
