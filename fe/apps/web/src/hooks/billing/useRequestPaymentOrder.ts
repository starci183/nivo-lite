"use client"

import {
    QUERY_OPEN_PLAN_PAYMENT_ORDER_SWR_KEY,
    QUERY_PAYMENT_ORDERS_SWR_KEY,
    useMutateRequestPaymentOrderSwr,
    useQueryPaymentOrderRequestStatusSwr,
} from "@/hooks/swr"
import type { MutateRequestPaymentOrderRequest } from "@/hooks/swr"
import { toast, useGraphQLWithToast } from "@/modules/toast"
import { useTranslations } from "next-intl"
import { useCallback, useRef, useState } from "react"
import { mutate } from "swr"
import { usePaymentOrderInvocation } from "./usePaymentOrderInvocation"

const failureKey = (code: string | null | undefined): "errForbidden" | "errCustomPlan" | "paymentFailed" => {
    if (code === "BILLING_FORBIDDEN" || code === "BILLING_NOT_MEMBER") return "errForbidden"
    if (code === "BILLING_PLAN_CUSTOM") return "errCustomPlan"
    return "paymentFailed"
}

/** Enqueues a payment order, polls creation, and toasts each outcome once. */
export const useRequestPaymentOrder = (workspaceId: string | undefined) => {
    const t = useTranslations("billing")
    const runGraphQL = useGraphQLWithToast()
    const [pendingRequest, setPendingRequest] = useState<{
        readonly workspaceId: string | undefined
        readonly id: string
        readonly sequence: number
    }>()
    const [requestWorkspaceId, setRequestWorkspaceId] = useState(workspaceId)
    if (requestWorkspaceId !== workspaceId) {
        setRequestWorkspaceId(workspaceId)
        setPendingRequest(undefined)
    }
    const invocation = usePaymentOrderInvocation(workspaceId)
    const requestId = pendingRequest?.workspaceId === workspaceId ? pendingRequest?.id : undefined
    const completed = useRef(new Set<string>())
    const notifiedErrors = useRef(new Set<string>())
    const { trigger, isMutating } = useMutateRequestPaymentOrderSwr()
    const onSuccess = useCallback(
        (progress: ReturnType<typeof useQueryPaymentOrderRequestStatusSwr>["data"]) => {
            const current = invocation.read()
            if (!current.live || current.workspaceId !== workspaceId || current.sequence !== pendingRequest?.sequence)
                return
            if (!progress || progress.id !== requestId || completed.current.has(progress.id)) return
            if (progress.status !== "succeeded" && progress.status !== "failed") return
            completed.current.add(progress.id)
            if (progress.status === "failed") {
                toast.danger(t("errGeneric"), { description: t(failureKey(progress.errorCode)) })
                return
            }
            toast.success(t("paymentReady"))
            void mutate(
                (key) =>
                    Array.isArray(key) &&
                    (key[0] === QUERY_PAYMENT_ORDERS_SWR_KEY || key[0] === QUERY_OPEN_PLAN_PAYMENT_ORDER_SWR_KEY) &&
                    key[1] === workspaceId,
            )
        },
        [invocation, pendingRequest?.sequence, requestId, t, workspaceId],
    )
    const onError = useCallback(
        (failure: unknown) => {
            const current = invocation.read()
            if (!current.live || current.workspaceId !== workspaceId || current.sequence !== pendingRequest?.sequence)
                return
            if (!requestId || notifiedErrors.current.has(requestId)) return
            notifiedErrors.current.add(requestId)
            toast.danger(t("errGeneric"), {
                description: failure instanceof Error ? failure.message : t("paymentFailed"),
            })
        },
        [invocation, pendingRequest?.sequence, requestId, t, workspaceId],
    )
    const { data: status, error } = useQueryPaymentOrderRequestStatusSwr(workspaceId, requestId, { onSuccess, onError })
    const terminal = status?.status === "succeeded" || status?.status === "failed"

    const request = useCallback(
        async (input: MutateRequestPaymentOrderRequest) => {
            const current = invocation.read()
            if (!current.live || current.workspaceId !== workspaceId) return undefined
            const sequence = invocation.begin()
            setPendingRequest(undefined)
            const queued = await runGraphQL(() => trigger(input), { successMessage: t("paymentQueued") })
            const latest = invocation.read()
            if (!latest.live || latest.workspaceId !== workspaceId || latest.sequence !== sequence) return undefined
            if (queued !== undefined) setPendingRequest({ workspaceId, id: queued.id, sequence })
            return queued
        },
        [invocation, runGraphQL, trigger, t, workspaceId],
    )

    return {
        request,
        isRequesting: isMutating || (requestId !== undefined && !terminal && !error),
        status,
        orderId: status?.status === "succeeded" ? (status.resultId ?? undefined) : undefined,
        error,
    }
}
