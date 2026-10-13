import { useTranslations } from "next-intl"
import { useCallback, useRef, useState } from "react"
import { useQueryLeadActionStatusSwr } from "@/hooks/swr"
import { useActiveWorkspace } from "@/hooks/workspaces"
import type { LeadActionQueuedType, LeadActionStatusType } from "@/modules/api"
import { useGraphQLWithToast } from "@/modules/toast"
import { useRevalidateLeadViews } from "./useRevalidateLeadViews"

/** The queued job being observed, bound to the workspace it was queued in. */
interface PendingAction {
    readonly id: string
    readonly workspaceId: string
}

const isTerminal = (status: string): boolean => status === "succeeded" || status === "failed"

/** Enqueues heavy lead work and observes its GraphQL status until a terminal outcome. */
export const useLeadAction = () => {
    const t = useTranslations("lead")
    const withToast = useGraphQLWithToast()
    const revalidate = useRevalidateLeadViews()
    const { activeWorkspaceId } = useActiveWorkspace()
    const [pending, setPending] = useState<PendingAction>()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [hasSubmitFailed, setHasSubmitFailed] = useState(false)
    const settled = useRef<string | undefined>(undefined)
    const reportedError = useRef<string | undefined>(undefined)
    const jobId = pending?.workspaceId === activeWorkspaceId ? pending?.id : undefined

    const settle = useCallback(
        (data: LeadActionStatusType) => {
            if (!isTerminal(data.status) || settled.current === data.id) return
            settled.current = data.id
            void revalidate()
            if (data.status === "failed") {
                void withToast(() => Promise.reject(new Error(t("actionFailed"))))
                return
            }
            void withToast(() => Promise.resolve(data), { successMessage: t("actionCompleted") })
        },
        [revalidate, t, withToast],
    )
    const reportError = useCallback(
        (error: unknown) => {
            if (jobId === undefined || reportedError.current === jobId) return
            reportedError.current = jobId
            void withToast(() => Promise.reject(error))
        },
        [jobId, withToast],
    )
    const status = useQueryLeadActionStatusSwr(activeWorkspaceId, jobId, { onSuccess: settle, onError: reportError })
    const terminal = status.data !== undefined && isTerminal(status.data.status)

    const run = useCallback(
        async (action: () => Promise<LeadActionQueuedType>) => {
            if (activeWorkspaceId === undefined) return undefined
            setHasSubmitFailed(false)
            setPending(undefined)
            setIsSubmitting(true)
            try {
                const queued = await withToast(action, { successMessage: t("actionQueued") })
                if (queued === undefined) {
                    setHasSubmitFailed(true)
                    return undefined
                }
                setPending({ id: queued.id, workspaceId: activeWorkspaceId })
                return queued
            } finally {
                setIsSubmitting(false)
            }
        },
        [activeWorkspaceId, t, withToast],
    )

    const hasFailed = hasSubmitFailed || status.data?.status === "failed" || status.error !== undefined
    return {
        run,
        error: hasFailed ? t("actionFailed") : null,
        result: status.data?.status === "succeeded" ? status.data.result : undefined,
        isPending: isSubmitting || (jobId !== undefined && !terminal),
        jobId,
    }
}
