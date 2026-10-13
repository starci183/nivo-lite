"use client"

import { useEffect } from "react"
import { useFormatter, useLocale, useTranslations } from "next-intl"
import {
    useQueryBillingWorkspaceSwr,
    useQueryBillingPlanSwr,
    useQueryPaymentOrdersSwr,
    useQueryBillingReviewTransactionsSwr,
} from "@/hooks/swr"
import { navigation, PRODUCT_TIME_ZONE } from "@/modules/i18n"
import { AUTH_ROUTES, workspaceRenewalPaymentPath } from "@/modules/routes"
import { useRequestPaymentOrder } from "@/hooks/billing"
import { useUsageCard } from "@/hooks/usageCard"
import { BillingOverviewBase } from "./component"
import type { BillingOverviewBaseProps } from "./component"

interface BillingOverviewProps {
    readonly workspaceId: string
}

/** Connects billing reads, renewal and usage to settled display values. */
export const BillingOverview = (props: BillingOverviewProps) => {
    const t = useTranslations("billing")
    const format = useFormatter()
    const locale = useLocale()
    const router = navigation.useRouter()
    const renewal = useRequestPaymentOrder(props.workspaceId)
    useEffect(() => {
        if (renewal.orderId) router.push(workspaceRenewalPaymentPath(props.workspaceId, renewal.orderId))
    }, [renewal.orderId, router, props.workspaceId])
    const workspace = useQueryBillingWorkspaceSwr(props.workspaceId)
    const allowed = workspace.data?.role === "owner" || workspace.data?.role === "manager"
    const selectedWorkspace = allowed ? props.workspaceId : undefined
    const usage = useUsageCard(selectedWorkspace)
    const plan = useQueryBillingPlanSwr(allowed ? (workspace.data?.planCode ?? undefined) : undefined)
    const orders = useQueryPaymentOrdersSwr(selectedWorkspace)
    const review = useQueryBillingReviewTransactionsSwr(
        selectedWorkspace,
        orders.data?.map((order) => order.id),
    )
    const error = workspace.error || orders.error || plan.error || review.error
    let phase: BillingOverviewBaseProps["state"]["phase"] = "ready"
    if (!workspace.data || !orders.data || !review.data || plan.isLoading) phase = "loading"
    if (error || (workspace.data && !allowed)) phase = "error"
    const money = (amount: number) =>
        format.number(amount, { style: "currency", currency: "VND", maximumFractionDigits: 0 })
    const stamp = (value: string) =>
        format.dateTime(new Date(value), { dateStyle: "medium", timeStyle: "short", timeZone: PRODUCT_TIME_ZONE })
    const statusLabels: Record<string, string> = {
        pending_payment: t("statusPending_payment"),
        active: t("statusActive"),
        past_due: t("statusPast_due"),
        cancelled: t("statusCancelled"),
    }
    const statusTones: Record<string, BillingOverviewBaseProps["props"]["statusTone"]> = {
        active: "success",
        pending_payment: "warning",
        past_due: "danger",
        cancelled: "neutral",
    }
    const orderLabels: Record<string, string> = {
        pending: t("orderPending"),
        paid: t("orderPaid"),
        expired: t("orderExpired"),
        cancelled: t("orderCancelled"),
    }
    const orderTones: Record<string, BillingOverviewBaseProps["props"]["statusTone"]> = {
        paid: "success",
        pending: "warning",
        expired: "neutral",
        cancelled: "neutral",
    }
    const reviewLabels: Record<string, string> = {
        underpaid: t("reviewUnderpaid"),
        expired: t("reviewExpired"),
        unmatched: t("reviewUnmatched"),
    }
    let planName = t("noPlan")
    if (plan.data) planName = locale === "vi" ? plan.data.nameVi : plan.data.nameEn
    const paidUntil = workspace.data?.paidUntil
    return (
        <BillingOverviewBase
            state={{
                phase,
                canRenew: Boolean(plan.data && !plan.data.isCustom),
                isRenewing: renewal.isRequesting,
                usage: usage.state,
            }}
            props={{
                title: t("pageTitle"),
                description: t("pageText"),
                backHref: AUTH_ROUTES.workspaces,
                backLabel: t("allWorkspaces"),
                loading: t("loading"),
                errorTitle: t("errGeneric"),
                errorDescription: error instanceof Error ? error.message : t("errForbidden"),
                planLabel: t("currentPlan"),
                planName,
                statusLabel: t("status"),
                status: statusLabels[workspace.data?.status ?? "cancelled"] ?? t("statusCancelled"),
                statusTone: statusTones[workspace.data?.status ?? "cancelled"] ?? "neutral",
                paidUntilLabel: t("paidUntil"),
                paidUntil: paidUntil
                    ? format.dateTime(new Date(paidUntil), { dateStyle: "long", timeZone: PRODUCT_TIME_ZONE })
                    : t("notPaid"),
                renewalLabel: renewal.isRequesting ? t("renewing") : t("renew"),
                renewalHint: t("renewHint"),
                usage: usage.props,
                historyTitle: t("history"),
                historyEmpty: t("noHistory"),
                orders: (orders.data ?? []).map((order) => ({
                    id: order.id,
                    title: money(order.amountVnd),
                    detail: `${stamp(order.createdAt)} · ${order.planCode} · ${order.orderCode}`,
                    status: {
                        label: orderLabels[order.status] ?? order.status,
                        tone: orderTones[order.status] ?? "neutral",
                    },
                })),
                reviewTitle: t("review"),
                reviewDescription: t("reviewText"),
                reviewEmpty: t("noReview"),
                review: (review.data ?? []).map((item) => ({
                    id: String(item.id),
                    title: reviewLabels[item.status] ?? item.status,
                    detail: t("reviewReceived", { amount: money(item.transferAmount), date: stamp(item.receivedAt) }),
                    content: item.content ?? undefined,
                })),
            }}
            on={{
                renew: () => {
                    void renewal.request({ kind: "renew" })
                },
                openCredits: usage.on.openCredits,
                formatUsageDay: usage.on.formatDay,
                formatUsageCredits: usage.on.formatCredits,
                minimumUsageBarSize: usage.on.minimumBarSize,
            }}
        />
    )
}
