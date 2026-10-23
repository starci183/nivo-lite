"use client"

import { useNow, useTranslations } from "next-intl"
import { useEffect } from "react"
import {
    useQueryBillingPlanSwr,
    useQueryBillingWorkspacesSwr,
    useQueryOpenPlanPaymentOrderSwr,
    useQueryPaymentOrderSwr,
    useQueryPaymentOrdersSwr,
} from "@/hooks/swr"
import { useActiveWorkspace } from "@/hooks/workspaces"
import { dayjs } from "@/modules/dayjs"
import { navigation } from "@/modules/i18n"
import { APP_ROUTES, workspaceBillingPath } from "@/modules/routes"
import { useRequestPaymentOrder } from "./useRequestPaymentOrder"
import { readError } from "@/hooks/workspaceread"

/** Selectors retained by the payment route. */
export interface WorkspacePaymentSelectors {
    readonly workspaceId?: string | undefined
    readonly orderId?: string | undefined
    readonly renewing: boolean
}

const messageOf = (error: unknown, fallback: string) => {
    if (error instanceof Error) return error.message
    if (typeof error === "string") return error
    return error ? fallback : undefined
}

/** Browser payment state: request a job, then read its order and poll until the transfer settles. */
export const useWorkspacePayment = (selectors: WorkspacePaymentSelectors) => {
    const t = useTranslations("onboarding")
    const router = navigation.useRouter()
    const { select } = useActiveWorkspace()
    const workspaces = useQueryBillingWorkspacesSwr()
    const workspaceId = selectors.workspaceId
    const workspace = workspaces.data?.find((item) => item.id === workspaceId)
    const requesting = useRequestPaymentOrder(workspaceId)
    const openOrder = useQueryOpenPlanPaymentOrderSwr(workspaceId)
    const order = useQueryPaymentOrderSwr(workspaceId, requesting.orderId ?? selectors.orderId ?? openOrder.data?.id)
    const history = useQueryPaymentOrdersSwr(
        openOrder.data === null && !workspace?.planCode && !order.data?.planCode ? workspaceId : undefined,
    )
    const previousPlanOrder = history.data
        ?.filter((item) => item.kind === "plan")
        .sort((first, second) => second.createdAt.localeCompare(first.createdAt))[0]
    const payment = order.data ?? openOrder.data
    const planCode =
        payment?.planCode ?? order.data?.planCode ?? workspace?.planCode ?? previousPlanOrder?.planCode ?? undefined
    const plan = useQueryBillingPlanSwr(planCode)
    const now = useNow({ updateInterval: 1000 })
    const expiresAt = payment?.expiresAt
    const paid = payment?.status === "paid" || (workspace?.status === "active" && !selectors.renewing)
    const returnTo = workspaceId && selectors.renewing ? workspaceBillingPath(workspaceId) : APP_ROUTES.chat

    useEffect(() => {
        if (!paid || !workspaceId) return
        select(workspaceId)
        const timer = setTimeout(() => router.replace(returnTo), 1800)
        return () => clearTimeout(timer)
    }, [paid, returnTo, router, select, workspaceId])

    const regenerate = () => {
        if (!planCode || plan.data?.isCustom) return
        if (selectors.renewing && payment?.kind !== "plan" && payment?.kind !== "credit_pack") {
            void requesting.request({ kind: "renew" })
            return
        }
        const detail = payment?.detail
        if (payment?.kind === "credit_pack" && detail?.credits != null) {
            void requesting.request({ kind: "credit_pack", target: String(detail.credits) })
            return
        }
        void requesting.request({
            kind: "plan",
            target: planCode,
            cycle: detail?.cycle === "annual" ? "annual" : "monthly",
            tierCredits: detail?.tierCredits ?? null,
            seats: detail?.seats ?? null,
        })
    }
    const left = expiresAt ? Math.max(0, dayjs(expiresAt).diff(now)) : undefined
    const error =
        readError(workspaces) ??
        readError(order) ??
        readError(openOrder) ??
        readError(history) ??
        readError(plan) ??
        readError(requesting)
    const loading =
        workspaces.isLoading || order.isLoading || openOrder.isLoading || history.isLoading || plan.isLoading
    return {
        workspace,
        payment,
        plan: plan.data,
        left,
        error: messageOf(error, t("errGeneric")),
        loading,
        creating: requesting.isRequesting,
        paid,
        expired: payment?.status !== "pending" || left === 0,
        canRegenerate: Boolean(planCode && plan.data && !plan.data.isCustom),
        regenerate,
        returnTo,
    }
}
