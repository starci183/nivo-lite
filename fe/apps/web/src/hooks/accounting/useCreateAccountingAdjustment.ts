"use client"

import { QUERY_ACCOUNTING_WORKBENCH_SWR_KEY, useMutateCreateAccountingAdjustmentSwr } from "@/hooks/swr"
import type { MutateCreateAccountingAdjustmentRequest } from "@/hooks/swr"
import { useActiveWorkspace } from "@/hooks/workspaces"
import { useGraphQLWithToast } from "@/modules/toast"
import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { mutate } from "@/modules/viewer-cache"

/** Records a correction, reports its outcome and refreshes the accounting ledger. */
export const useCreateAccountingAdjustment = () => {
    const t = useTranslations("workbenchAccounting")
    const { activeWorkspaceId } = useActiveWorkspace()
    const runGraphQL = useGraphQLWithToast()
    const { trigger, isMutating } = useMutateCreateAccountingAdjustmentSwr()
    const create = useCallback(
        async (request: MutateCreateAccountingAdjustmentRequest) => {
            const result = await runGraphQL(() => trigger(request), { successMessage: t("adjustSaved") })
            if (result === undefined) return undefined
            await mutate([QUERY_ACCOUNTING_WORKBENCH_SWR_KEY, activeWorkspaceId])
            return result
        },
        [activeWorkspaceId, runGraphQL, t, trigger],
    )
    return { create, isSaving: isMutating }
}
