"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { mutate } from "swr"
import { useActiveWorkspace } from "@/hooks/workspaces"
import { useMutateCreateAccountingAdjustmentSwr, QUERY_ACCOUNTING_WORKBENCH_SWR_KEY } from "@/hooks/swr"
import type { MutateCreateAccountingAdjustmentRequest } from "@/modules/api/graphql/mutations/mutation-create-accounting-adjustment"
import { useGraphQLWithToast } from "@/modules/toast"

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
