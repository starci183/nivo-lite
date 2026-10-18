"use client"

import { useQueryAuthUserSwr } from "@/hooks/auth"
import {
    QUERY_AGENT_DASHBOARD_SWR_KEY,
    QUERY_LEAD_GEN_COMMENT_STATUS_SWR_KEY,
    QUERY_LEAD_GEN_WORKBENCH_SWR_KEY,
    useMutateApproveLeadGenCommentSwr,
    useQueryLeadGenCommentStatusSwr,
    type MutateApproveLeadGenCommentRequest,
} from "@/hooks/swr"

import { useActiveWorkspace } from "@/hooks/workspaces"
import { useLeadGenApprovalStore } from "@/hooks/zustand/leadgen"
import { useGraphQLWithToast } from "@/modules/toast"
import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { useSWRConfig } from "swr"

/** The SWR keys whose data a finished approval changes. */
const REFRESHED_KEYS: ReadonlySet<unknown> = new Set([QUERY_LEAD_GEN_WORKBENCH_SWR_KEY, QUERY_AGENT_DASHBOARD_SWR_KEY])

/** What the status poll reports about an approval. */
interface ApprovalProgress {
    readonly status: string
}

/** Approves a public reply, follows its job, and refreshes the affected workspace views. */
export const useApproveLeadGenComment = () => {
    const t = useTranslations("workbenchLeadGen")
    const runGraphQL = useGraphQLWithToast()
    const { activeWorkspaceId } = useActiveWorkspace()
    const { data: user } = useQueryAuthUserSwr()
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
        void mutate((key: unknown) => Array.isArray(key) && key[1] === activeWorkspaceId && REFRESHED_KEYS.has(key[0]))
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
            const requestedItemId = String(request.workItemId)
            if (!activeWorkspaceId || !scopeId || !useLeadGenApprovalStore.getState().claim(scopeId, requestedItemId))
                return false
            const approved = await runGraphQL(() => trigger(request), { successMessage: t("commentQueued") })
            if (!approved) {
                useLeadGenApprovalStore.getState().refused(scopeId, requestedItemId)
                return false
            }
            await mutate([QUERY_LEAD_GEN_COMMENT_STATUS_SWR_KEY, activeWorkspaceId, approved.id], approved, {
                revalidate: false,
            })
            useLeadGenApprovalStore.getState().accepted(scopeId, requestedItemId, approved.id)
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
