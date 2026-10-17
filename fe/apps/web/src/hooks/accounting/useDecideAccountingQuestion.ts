"use client"

import {
    QUERY_ACCOUNTING_WORKBENCH_SWR_KEY,
    QUERY_AGENT_DASHBOARD_SWR_KEY,
    useMutateDecideWorkItemSwr,
} from "@/hooks/swr"
import type { MutateDecideWorkItemRequest } from "@/hooks/swr"
import { useActiveWorkspace } from "@/hooks/workspaces"
import { useGraphQLWithToast } from "@/modules/toast"
import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { mutate } from "swr"

/** Decides an accounting question and reloads the workbench after the backend resumes it. */
export const useDecideAccountingQuestion = () => {
    const t = useTranslations("workbenchAccounting")
    const runGraphQL = useGraphQLWithToast()
    const { activeWorkspaceId } = useActiveWorkspace()
    const { trigger, isMutating } = useMutateDecideWorkItemSwr()
    const decide = useCallback(
        async (request: MutateDecideWorkItemRequest) => {
            const decided = await runGraphQL(() => trigger(request), { successMessage: t("questionDecided") })
            if (decided === undefined) return undefined
            await Promise.all([
                mutate([QUERY_ACCOUNTING_WORKBENCH_SWR_KEY, activeWorkspaceId]),
                mutate([QUERY_AGENT_DASHBOARD_SWR_KEY, activeWorkspaceId, "accounting"]),
            ])
            return decided
        },
        [activeWorkspaceId, runGraphQL, t, trigger],
    )
    return { decide, isDeciding: isMutating }
}
