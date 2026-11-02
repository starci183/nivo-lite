"use client"

import { useRevalidateLeadViews } from "@/hooks/leads"
import { useFeatureLifetime } from "@/hooks/reuseables"
import { useQuerySalesActionStatusSwr } from "@/hooks/swr"
import type { SalesActionType } from "@/hooks/swr"
import { useActiveWorkspace } from "@/hooks/workspaces"
import { toast, useGraphQLWithToast } from "@/modules/toast"
import { useTranslations } from "next-intl"
import { useCallback, useMemo, useRef, useState } from "react"

/** The actual mounted panel identity, when its controller remains mounted between tabs. */
export interface SalesActionActivity {
    readonly isActive: boolean
    readonly scope: string
}

/** One command origin; a retired origin cannot hold a fresh editor busy. */
interface SalesOperation {
    readonly scope: string
    readonly isCurrent: () => boolean
}

/** The server-owned queued action observed by this particular mounted panel. */
interface PendingSalesAction extends SalesOperation {
    readonly id: string
    readonly workspaceId: string
}

interface ShipmentAnswer {
    readonly notificationId: string
}

const isTerminal = (status: string): boolean => status === "succeeded" || status === "failed"

/** Runs one Sales command, retaining normal feedback and revalidation while fencing local panel ownership. */
export const useSalesActionRunner = (activity?: SalesActionActivity) => {
    const t = useTranslations("workbenchSales")
    const runGraphQL = useGraphQLWithToast()
    const { activeWorkspaceId } = useActiveWorkspace()
    const revalidate = useRevalidateLeadViews()
    const isActive = activity?.isActive ?? true
    const isScoped = activity !== undefined
    const scope = JSON.stringify([activeWorkspaceId, activity?.scope ?? null])
    const lifetime = useFeatureLifetime(isActive, scope)
    const observer = useSalesActionObserver(isActive, scope)
    const lease = useMemo(() => ({ isLocked: false }), [isActive, scope])
    const [operation, setOperation] = useState<SalesOperation | null>(null)
    const locked = useCallback(
        async <Result>(action: (isCurrent: () => boolean) => Promise<Result | undefined>) => {
            const pending = { scope, isCurrent: lifetime.capture() }
            if (!pending.isCurrent() || lease.isLocked || observer.pendingId) return undefined
            lease.isLocked = true
            setOperation(pending)
            try {
                const result = await action(pending.isCurrent)
                if (result !== undefined) await revalidate()
                return result
            } catch (error) {
                if (!isScoped) throw error
                return await runGraphQL(() => Promise.reject(error), { showSuccessToast: false })
            } finally {
                lease.isLocked = false
                setOperation((current) => (current === pending ? null : current))
            }
        },
        [isScoped, lease, lifetime, observer.pendingId, revalidate, runGraphQL, scope],
    )
    const runQueued = useCallback(
        (action: () => Promise<SalesActionType>) =>
            locked(async (isCurrent) =>
                trackSalesAction(
                    t,
                    (id) => observer.watch(id, isCurrent),
                    await runGraphQL(action, { showSuccessToast: false }),
                ),
            ),
        [locked, observer.watch, runGraphQL, t],
    )
    const runImmediate = useCallback(
        <Result>(action: () => Promise<Result>, successMessage: string) =>
            locked(() => runGraphQL(action, { successMessage })),
        [locked, runGraphQL],
    )
    const runShipment = useCallback(
        <Result extends ShipmentAnswer>(action: () => Promise<Result>) =>
            locked(async (isCurrent) => {
                const result = await runGraphQL(action, { successMessage: t("salesActionQueued") })
                if (result !== undefined) observer.watch(result.notificationId, isCurrent)
                return result
            }),
        [locked, observer.watch, runGraphQL, t],
    )
    return {
        isBusy: Boolean(observer.pendingId),
        isExecuting: operation?.scope === scope && operation.isCurrent(),
        runQueued,
        runImmediate,
        runShipment,
    }
}

/** Polls the real job only while its originating panel is mounted; status remains the server's authority. */
const useSalesActionObserver = (isActive: boolean, scope: string) => {
    const t = useTranslations("workbenchSales")
    const { activeWorkspaceId } = useActiveWorkspace()
    const revalidate = useRevalidateLeadViews()
    const [pending, setPending] = useState<PendingSalesAction>()
    const completed = useRef<PendingSalesAction | undefined>(undefined)
    const reportedError = useRef<PendingSalesAction | undefined>(undefined)
    const pendingId =
        isActive && pending?.scope === scope && pending.workspaceId === activeWorkspaceId && pending.isCurrent()
            ? pending.id
            : undefined
    const finish = useCallback(
        (result: SalesActionType) => {
            if (!pendingId || !pending?.isCurrent() || completed.current === pending || !isTerminal(result.status))
                return
            completed.current = pending
            if (result.status === "failed")
                toast.danger(t("salesActionFailed", { code: result.errorCode ?? result.status }))
            else toast.success(t("salesActionCompleted"))
            setPending((current) => (current === pending ? undefined : current))
            void revalidate()
        },
        [pending, pendingId, revalidate, t],
    )
    const reportError = useCallback(
        (error: unknown) => {
            if (!pendingId || !pending?.isCurrent() || reportedError.current === pending) return
            reportedError.current = pending
            toast.danger(error instanceof Error ? error.message : t("loadFailedBody"))
        },
        [pending, pendingId, t],
    )
    useQuerySalesActionStatusSwr(pendingId ? activeWorkspaceId : undefined, pendingId, {
        onSuccess: finish,
        onError: reportError,
    })
    const watch = useCallback(
        (id: string, isCurrent: () => boolean) => {
            if (!activeWorkspaceId || !isActive || !isCurrent()) return
            setPending({ id, workspaceId: activeWorkspaceId, scope, isCurrent })
        },
        [activeWorkspaceId, isActive, scope],
    )
    return { pendingId, watch }
}

/** The runner the Sales command hooks share. */
export type SalesActionRunner = ReturnType<typeof useSalesActionRunner>

/** Reports the normal command result and observes a nonterminal server job only for its original panel. */
const trackSalesAction = (
    t: ReturnType<typeof useTranslations<"workbenchSales">>,
    watch: (id: string) => void,
    result: SalesActionType | undefined,
) => {
    if (result === undefined) return undefined
    if (result.status === "failed") toast.danger(t("salesActionFailed", { code: result.errorCode ?? result.status }))
    else if (result.status === "succeeded") toast.success(t("salesActionCompleted"))
    else toast.success(t("salesActionQueued"))
    if (!isTerminal(result.status)) watch(result.id)
    return result
}
