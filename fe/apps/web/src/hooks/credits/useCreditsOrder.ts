"use client"

import { useCallback, useEffect, useLayoutEffect, useRef } from "react"
import { useTranslations } from "next-intl"
import { useRequestPaymentOrder } from "@/hooks/billing"
import { useCreditsCheckoutStore } from "@/hooks/zustand/creditsCheckout"
import type { PayTarget } from "@/modules/types"

/** Enqueues purchases only from user events and shares progress with the payment slot. */
export const useCreditsOrder = (workspaceId: string | undefined) => {
    const t = useTranslations("credits")
    const { target, isRequesting: checkoutPending, open, close, update, registerRequest } = useCreditsCheckoutStore()
    const { request, orderId, isRequesting, status, error } = useRequestPaymentOrder(workspaceId)
    const queuedId = useRef<string | undefined>(undefined)
    const invocation = useRef({ workspaceId, sequence: 0, live: true })
    const begin = useCallback(
        async (next: PayTarget) => {
            const current = invocation.current
            if (workspaceId === undefined || !current.live || current.workspaceId !== workspaceId) return
            const sequence = current.sequence + 1
            current.sequence = sequence
            open(workspaceId, next)
            queuedId.current = undefined
            const queued = await request(
                next.kind === "credit_pack"
                    ? { kind: "credit_pack", target: String(next.credits) }
                    : { kind: next.kind, target: next.kind === "topup" ? next.packCode : next.planCode },
            )
            const latest = invocation.current
            if (!latest.live || latest.workspaceId !== workspaceId || latest.sequence !== sequence) return
            if (queued === undefined) close()
            else queuedId.current = queued.id
        },
        [workspaceId, open, close, request],
    )
    useLayoutEffect(() => {
        const current = invocation.current
        current.workspaceId = workspaceId
        current.live = true
        queuedId.current = undefined
        close()
        return () => {
            current.live = false
            current.sequence += 1
            queuedId.current = undefined
            close()
        }
    }, [workspaceId, close])
    useEffect(() => {
        const current = invocation.current
        if (!current.live || current.workspaceId !== workspaceId) return
        registerRequest(begin)
        return () => registerRequest(undefined)
    }, [begin, registerRequest, workspaceId])
    useEffect(() => {
        const current = invocation.current
        if (!current.live || current.workspaceId !== workspaceId) return
        if (!target) return
        const matching = queuedId.current !== undefined && status?.id === queuedId.current
        const failed = Boolean(error) || (matching && status?.status === "failed")
        const pending = isRequesting || (!matching && !error)
        update(matching ? orderId : undefined, pending, failed ? t("errGeneric") : null)
    }, [target, orderId, isRequesting, status, error, update, t, workspaceId])
    let busy: string | null = null
    if (checkoutPending && target) {
        if (target.kind === "credit_pack") busy = `pack-${target.credits}`
        else busy = target.kind === "topup" ? target.packCode : target.planCode
    }
    return { begin, busy }
}
