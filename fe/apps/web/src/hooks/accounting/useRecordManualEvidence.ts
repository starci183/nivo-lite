"use client"

import {
    QUERY_ACCOUNTING_WORKBENCH_SWR_KEY,
    QUERY_AGENT_DASHBOARD_SWR_KEY,
    useMutateRecordManualEvidenceSwr,
} from "@/hooks/swr"
import type { MutateRecordManualEvidenceRequest } from "@/hooks/swr"
import { useActiveWorkspace } from "@/hooks/workspaces"
import { toast, useGraphQLWithToast } from "@/modules/toast"
import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { mutate } from "@/modules/viewer-cache"

/** Records a manual credit, reports duplicates and revalidates the accounting figures. */
export const useRecordManualEvidence = () => {
    const t = useTranslations("workbenchAccounting")
    const runGraphQL = useGraphQLWithToast()
    const { activeWorkspaceId } = useActiveWorkspace()
    const { trigger, isMutating } = useMutateRecordManualEvidenceSwr()
    const record = useCallback(
        async (request: MutateRecordManualEvidenceRequest) => {
            const recorded = await runGraphQL(() => trigger(request), { showSuccessToast: false })
            if (recorded === undefined) return undefined
            toast.success(t(recorded.duplicate ? "manualDuplicate" : "manualSaved"))
            await Promise.all([
                mutate([QUERY_ACCOUNTING_WORKBENCH_SWR_KEY, activeWorkspaceId]),
                mutate([QUERY_AGENT_DASHBOARD_SWR_KEY, activeWorkspaceId, "accounting"]),
            ])
            return recorded
        },
        [activeWorkspaceId, runGraphQL, t, trigger],
    )
    return { record, isRecording: isMutating }
}
