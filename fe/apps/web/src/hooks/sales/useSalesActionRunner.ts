import { useTranslations } from "next-intl"
import { useCallback, useRef, useState } from "react"
import { useRevalidateLeadViews } from "@/hooks/leads"
import { useQuerySalesActionStatusSwr } from "@/hooks/swr/api/graphql/queries/useQuerySalesActionStatusSwr"
import { useActiveWorkspace } from "@/hooks/workspaces"
import type { SalesActionType } from "@/modules/api"
import { toast, useGraphQLWithToast } from "@/modules/toast"

/** The queued Sales job being observed, bound to the workspace it was queued in. */
interface PendingSalesAction {
    readonly id: string
    readonly workspaceId: string
}

/** What a write that notifies the accounting side answers: the notification to observe. */
interface ShipmentAnswer {
    readonly notificationId: string
}

const isTerminal = (status: string): boolean => status === "succeeded" || status === "failed"

/**
 * Runs one Sales write at a time (a second call while one is in flight or its queued job is still running answers undefined),
 * toasts the outcome, observes the queued job until it is terminal and reads the affected views again.
 */
export const useSalesActionRunner = () => {
    const t = useTranslations("workbenchSales")
    const runGraphQL = useGraphQLWithToast()
    const { activeWorkspaceId } = useActiveWorkspace()
    const revalidate = useRevalidateLeadViews()
    const [pending, setPending] = useState<PendingSalesAction>()
    const completedId = useRef<string | undefined>(undefined)
    const reportedErrorId = useRef<string | undefined>(undefined)
    const commandLock = useRef(false)
    const pendingId = pending && pending.workspaceId === activeWorkspaceId ? pending.id : undefined

    const finish = useCallback(
        (result: SalesActionType) => {
            if (!pendingId || completedId.current === pendingId || !isTerminal(result.status)) return
            completedId.current = pendingId
            if (result.status === "failed")
                toast.danger(t("salesActionFailed", { code: result.errorCode ?? result.status }))
            else toast.success(t("salesActionCompleted"))
            setPending(undefined)
            void revalidate()
        },
        [pendingId, revalidate, t],
    )
    const reportError = useCallback(
        (error: unknown) => {
            if (!pendingId || reportedErrorId.current === pendingId) return
            reportedErrorId.current = pendingId
            toast.danger(error instanceof Error ? error.message : t("loadFailedBody"))
        },
        [pendingId, t],
    )
    useQuerySalesActionStatusSwr(activeWorkspaceId, pendingId, { onSuccess: finish, onError: reportError })

    const watch = useCallback(
        (id: string) => {
            if (!activeWorkspaceId) return
            completedId.current = undefined
            setPending({ id, workspaceId: activeWorkspaceId })
        },
        [activeWorkspaceId],
    )
    const track = useCallback(
        (result: SalesActionType | undefined) => {
            if (result === undefined) return undefined
            if (result.status === "failed")
                toast.danger(t("salesActionFailed", { code: result.errorCode ?? result.status }))
            else if (result.status === "succeeded") toast.success(t("salesActionCompleted"))
            else toast.success(t("salesActionQueued"))
            if (!isTerminal(result.status)) watch(result.id)
            return result
        },
        [t, watch],
    )
    const locked = useCallback(
        async <Result>(action: () => Promise<Result | undefined>) => {
            if (commandLock.current || pendingId) return undefined
            commandLock.current = true
            try {
                const result = await action()
                if (result !== undefined) await revalidate()
                return result
            } finally {
                commandLock.current = false
            }
        },
        [pendingId, revalidate],
    )
    const runQueued = useCallback(
        (action: () => Promise<SalesActionType>) =>
            locked(async () => track(await runGraphQL(action, { showSuccessToast: false }))),
        [locked, runGraphQL, track],
    )
    const runImmediate = useCallback(
        <Result>(action: () => Promise<Result>, successMessage: string) =>
            locked(() => runGraphQL(action, { successMessage })),
        [locked, runGraphQL],
    )
    const runShipment = useCallback(
        <Result extends ShipmentAnswer>(action: () => Promise<Result>) =>
            locked(async () => {
                const result = await runGraphQL(action, { successMessage: t("salesActionQueued") })
                if (result !== undefined) watch(result.notificationId)
                return result
            }),
        [locked, runGraphQL, t, watch],
    )
    return { isBusy: Boolean(pendingId), runQueued, runImmediate, runShipment }
}

/** The runner the Sales action hooks share. */
export type SalesActionRunner = ReturnType<typeof useSalesActionRunner>
