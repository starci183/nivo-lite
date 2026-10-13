import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { mutate } from "swr"
import {
    useMutateRecordManualEvidenceSwr,
    QUERY_ACCOUNTING_WORKBENCH_SWR_KEY,
    QUERY_AGENT_DASHBOARD_SWR_KEY,
} from "@/hooks/swr"
import { useActiveWorkspace } from "@/hooks/workspaces"
import type { MutateRecordManualEvidenceRequest } from "@/modules/api/graphql/mutations/mutation-record-manual-evidence"
import { toast, useGraphQLWithToast } from "@/modules/toast"

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
