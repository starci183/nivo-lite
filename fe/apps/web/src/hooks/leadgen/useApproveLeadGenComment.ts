"use client"

import { useTranslations } from "next-intl"
import { useCallback, useRef, useState } from "react"
import { useRevalidateLeadViews } from "@/hooks/leads"
import { useMutateApproveLeadGenCommentSwr } from "@/hooks/swr/api/graphql/mutations/useMutateApproveLeadGenCommentSwr"
import { useQueryLeadGenCommentStatusSwr } from "@/hooks/swr/api/graphql/queries/useQueryLeadGenCommentStatusSwr"
import { useActiveWorkspace } from "@/hooks/workspaces"
import type { LeadGenCommentStatusType } from "@/modules/api"
import { toast, useGraphQLWithToast } from "@/modules/toast"

/** A reply being approved, bound to the workspace it was queued in. */
interface ApprovalTarget {
    readonly id: string
    readonly workspaceId: string
}

/** Queues a public reply, polls its GraphQL status, and refreshes the workbench when it finishes. */
export const useApproveLeadGenComment = () => {
    const t = useTranslations("workbenchLeadGen")
    const runGraphQL = useGraphQLWithToast()
    const revalidate = useRevalidateLeadViews()
    const { activeWorkspaceId } = useActiveWorkspace()
    const { trigger, isMutating } = useMutateApproveLeadGenCommentSwr()
    const [approval, setApproval] = useState<ApprovalTarget>()
    const [pending, setPending] = useState<ApprovalTarget>()
    const workItemId = approval?.workspaceId === activeWorkspaceId ? approval?.id : undefined
    const pendingId = pending?.workspaceId === activeWorkspaceId ? pending?.id : undefined
    const [errors, setErrors] = useState<Readonly<Record<string, string>>>({})
    const finished = useRef<string | undefined>(undefined)

    const finish = useCallback(
        (status: LeadGenCommentStatusType) => {
            if (!workItemId || status.id !== workItemId || finished.current === workItemId) return
            if (status.status !== "succeeded" && status.status !== "failed") return
            finished.current = workItemId
            if (status.status === "succeeded") toast.success(t("approvalSucceeded"))
            else {
                const message = t("approvalFailed", { error: status.errorCode ?? status.workStatus })
                toast.danger(message)
                setErrors((previous) => ({ ...previous, [`${activeWorkspaceId}:${workItemId}`]: message }))
            }
            setApproval(undefined)
            void revalidate()
        },
        [activeWorkspaceId, revalidate, t, workItemId],
    )
    const { error: statusError } = useQueryLeadGenCommentStatusSwr(activeWorkspaceId, workItemId, {
        onSuccess: finish,
    })

    const approve = useCallback(
        async (id: string, draft?: string) => {
            if (!activeWorkspaceId || isMutating || workItemId !== undefined) return false
            setErrors((previous) => ({ ...previous, [`${activeWorkspaceId}:${id}`]: "" }))
            setPending({ id, workspaceId: activeWorkspaceId })
            const queued = await runGraphQL(() => trigger({ workItemId: id, draft }), {
                successMessage: t("approvalQueued"),
            })
            if (!queued) {
                setPending(undefined)
                return false
            }
            finished.current = undefined
            setApproval({ id: queued.id, workspaceId: activeWorkspaceId })
            setPending(undefined)
            return true
        },
        [activeWorkspaceId, isMutating, runGraphQL, t, trigger, workItemId],
    )

    return {
        approve,
        busyId: pendingId ?? workItemId ?? null,
        isApproving: isMutating || workItemId !== undefined,
        errors: Object.fromEntries(
            Object.entries(errors)
                .filter(([key]) => key.startsWith(`${activeWorkspaceId}:`))
                .map(([key, message]) => [key.slice(`${activeWorkspaceId}:`.length), message]),
        ),
        statusError: statusError instanceof Error ? statusError.message : null,
    }
}
