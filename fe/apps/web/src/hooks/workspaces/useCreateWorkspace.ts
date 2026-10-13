"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { mutate } from "swr"
import { useMutateCreateWorkspaceSwr, QUERY_MY_WORKSPACES_SWR_KEY } from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"

/**
 * Creates a free workspace through the back end and toasts the outcome. Answers the new workspace id, or `undefined` when it
 * failed (the failure was already toasted with the server-localized message). The workspaces list is revalidated on success.
 */
export const useCreateWorkspace = () => {
    const t = useTranslations("onboarding")
    const runGraphQL = useGraphQLWithToast()
    const { trigger, isMutating } = useMutateCreateWorkspaceSwr()
    const create = useCallback(
        async (name: string): Promise<string | undefined> => {
            const created = await runGraphQL(() => trigger({ name }), { successMessage: t("created") })
            if (created === undefined) return undefined
            await mutate(QUERY_MY_WORKSPACES_SWR_KEY)
            return created.id
        },
        [runGraphQL, trigger, t],
    )
    return { create, isCreating: isMutating }
}
