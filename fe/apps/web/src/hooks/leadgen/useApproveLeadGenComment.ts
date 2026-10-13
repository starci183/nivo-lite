import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { useSWRConfig } from "swr"
import { useAuthUser } from "@/hooks/auth"
import { useMutateApproveLeadGenCommentSwr } from "@/hooks/swr/api/graphql/mutations/useMutateApproveLeadGenCommentSwr"
import {
    useQueryLeadGenCommentStatusSwr,
    QUERY_LEAD_GEN_COMMENT_STATUS_SWR_KEY,
} from "@/hooks/swr/api/graphql/queries/useQueryLeadGenCommentStatusSwr"
import { QUERY_LEAD_GEN_WORKBENCH_SWR_KEY } from "@/hooks/swr/api/graphql/queries/useQueryLeadGenWorkbenchSwr"
import { QUERY_LEAD_GEN_AGENT_DASHBOARD_SWR_KEY } from "@/hooks/swr/api/graphql/queries/useQueryLeadGenAgentDashboardSwr"
import { useActiveWorkspace } from "@/hooks/workspaces"
import { useLeadGenApprovalStore } from "@/hooks/zustand/leadgen"
import type { MutateApproveLeadGenCommentRequest } from "@/modules/api/graphql/mutations/mutation-approve-lead-gen-comment"
import { useGraphQLWithToast } from "@/modules/toast"

/** The SWR keys whose data a finished approval changes. */
const REFRESHED_KEYS: ReadonlyArray<unknown> = [
    QUERY_LEAD_GEN_WORKBENCH_SWR_KEY,
    QUERY_LEAD_GEN_AGENT_DASHBOARD_SWR_KEY,
]

/** What the status poll reports about an approval. */
interface ApprovalProgress {
    readonly status: string
}

/** Approves a public reply, follows its job, and refreshes the affected workspace views. */
export const useApproveLeadGenComment = () => {
    const t = useTranslations("workbenchLeadGen")
    const runGraphQL = useGraphQLWithToast()
    const { activeWorkspaceId } = useActiveWorkspace()
    const { data: user } = useAuthUser()
    const scopeId = activeWorkspaceId && user ? `${activeWorkspaceId}:${user.id}` : undefined
    const { mutate } = useSWRConfig()
    const { trigger, isMutating } = useMutateApproveLeadGenCommentSwr()
    const approval = useLeadGenApprovalStore((state) => (scopeId ? state.approvals[scopeId] : undefined))
    const workItemId = approval?.requesting ? undefined : approval?.jobId

    const settle = (progress: ApprovalProgress) => {
        if (!activeWorkspaceId || !scopeId || !workItemId) return
        if (progress.status !== "succeeded" && progress.status !== "failed") return
        const result = progress.status === "failed" ? "failed" : "succeeded"
        if (!useLeadGenApprovalStore.getState().finish(scopeId, workItemId, result)) return
        const message = t(result === "failed" ? "commentFailed" : "commentApproved")
        void runGraphQL(() => (result === "failed" ? Promise.reject(new Error(message)) : Promise.resolve(progress)), {
            successMessage: message,
        })
        void mutate(
            (key: unknown) => Array.isArray(key) && key[1] === activeWorkspaceId && REFRESHED_KEYS.includes(key[0]),
        )
    }

    const reportReadError = (error: unknown) => {
        if (!scopeId || !workItemId) return
        if (!useLeadGenApprovalStore.getState().reportReadError(scopeId, workItemId)) return
        void runGraphQL(() => Promise.reject(error))
    }

    const status = useQueryLeadGenCommentStatusSwr(activeWorkspaceId, workItemId, {
        onSuccess: settle,
        onError: reportReadError,
    })
    const terminal = status.data?.status === "succeeded" || status.data?.status === "failed"

    const approve = useCallback(
        async (request: MutateApproveLeadGenCommentRequest) => {
            if (
                !activeWorkspaceId ||
                !scopeId ||
                !useLeadGenApprovalStore.getState().claim(scopeId, request.workItemId)
            )
                return false
            const approved = await runGraphQL(() => trigger(request), { successMessage: t("commentQueued") })
            if (!approved) {
                useLeadGenApprovalStore.getState().refused(scopeId, request.workItemId)
                return false
            }
            await mutate([QUERY_LEAD_GEN_COMMENT_STATUS_SWR_KEY, activeWorkspaceId, approved.id], approved, {
                revalidate: false,
            })
            useLeadGenApprovalStore.getState().accepted(scopeId, request.workItemId, approved.id)
            return true
        },
        [activeWorkspaceId, scopeId, runGraphQL, trigger, t, mutate],
    )

    return {
        approve,
        busyId: approval?.pending ? approval.workItemId : null,
        isApproving: isMutating || Boolean(approval?.pending),
        statusReadError: workItemId && !terminal && status.error ? t("statusReadFailed") : null,
        retryStatus: () => {
            void status.mutate()
        },
    }
}
