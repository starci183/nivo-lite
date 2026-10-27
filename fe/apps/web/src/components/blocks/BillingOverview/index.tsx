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
import { mapSlot, slotOfSwr, useSlotLabels } from "@/hooks/slot"
import type { BillingHistoryRow } from "@/components/composites/BillingHistoryList"
import type { DataSlot } from "@/modules/types"
import { BillingOverviewBase, type BillingPlanView, type BillingTone } from "./component"

interface BillingOverviewProps {
    readonly workspaceId: string
}

/** Display tones for workspace billing states. */
const STATUS_TONES: Record<string, BillingTone> = {
    active: "success",
    pending_payment: "warning",
    past_due: "danger",
    cancelled: "neutral",
}

/** Display tones for payment order states. */
const ORDER_TONES: Record<string, BillingTone> = {
    paid: "success",
    pending: "warning",
    expired: "neutral",
    cancelled: "neutral",
}

/** Draws the connected view from its current state. */
export const BillingOverview = (props: BillingOverviewProps) => {
    const t = useTranslations("billing")
    const slotLabels = useSlotLabels()
    const format = useFormatter()
    const locale = useLocale()
    const router = navigation.useRouter()
    const renewal = useRequestPaymentOrder(props.workspaceId)
    useEffect(() => {
        if (renewal.orderId) router.push(workspaceRenewalPaymentPath(props.workspaceId, renewal.orderId))
    }, [renewal.orderId, router, props.workspaceId])
    const workspace = useQueryBillingWorkspaceSwr(props.workspaceId)
    const isAllowed = workspace.data?.role === "owner" || workspace.data?.role === "manager"
    const isRefused = workspace.data !== undefined && !isAllowed
    const selectedWorkspace = isAllowed ? props.workspaceId : undefined
    const usage = useUsageCard(selectedWorkspace)
    const plan = useQueryBillingPlanSwr(isAllowed ? (workspace.data?.planCode ?? undefined) : undefined)
    const orders = useQueryPaymentOrdersSwr(selectedWorkspace)
    const review = useQueryBillingReviewTransactionsSwr(
        selectedWorkspace,
        orders.data?.map((order) => order.id),
    )

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
    const orderLabels: Record<string, string> = {
        pending: t("orderPending"),
        paid: t("orderPaid"),
        expired: t("orderExpired"),
        cancelled: t("orderCancelled"),
    }
    const reviewLabels: Record<string, string> = {
        underpaid: t("reviewUnderpaid"),
        expired: t("reviewExpired"),
        unmatched: t("reviewUnmatched"),
    }

    const refused = <T,>(slot: DataSlot<T>): DataSlot<T> => (isRefused ? { isForbidden: true } : slot)
    const planSlot = refused(
        mapSlot(slotOfSwr(workspace), (item): BillingPlanView => {
            let planName = t("noPlan")
            if (plan.data) planName = locale === "vi" ? plan.data.nameVi : plan.data.nameEn
            const status = item.status
            return {
                planName,
                status: statusLabels[status] ?? t("statusCancelled"),
                statusTone: STATUS_TONES[status] ?? "neutral",
                paidUntil: item.paidUntil
                    ? format.dateTime(new Date(item.paidUntil), { dateStyle: "long", timeZone: PRODUCT_TIME_ZONE })
                    : t("notPaid"),
                canRenew: Boolean(plan.data && !plan.data.isCustom),
            }
        }),
    )
    // The plan card also waits on, and fails with, the plan read it words.
    const planRead = slotOfSwr(plan)
    const planCard: DataSlot<BillingPlanView> =
        planSlot.items !== undefined && (planRead.isLoading || planRead.isError)
            ? { isLoading: planRead.isLoading, isError: planRead.isError }
            : planSlot
    const ordersSlot = refused(
        mapSlot(
            slotOfSwr(orders),
            (items): ReadonlyArray<BillingHistoryRow> =>
                items.map((order) => ({
                    id: order.id,
                    title: money(order.amountVnd),
                    detail: `${stamp(order.createdAt)} · ${order.planCode} · ${order.orderCode}`,
                    status: {
                        label: orderLabels[order.status] ?? order.status,
                        tone: ORDER_TONES[order.status] ?? "neutral",
                    },
                })),
        ),
    )
    const reviewSlot = refused(
        mapSlot(
            slotOfSwr(review),
            (items): ReadonlyArray<BillingHistoryRow> =>
                items.map((item) => ({
                    id: String(item.id),
                    title: reviewLabels[item.status] ?? item.status,
                    detail: t("reviewReceived", { amount: money(item.transferAmount), date: stamp(item.receivedAt) }),
                    content: item.content ?? undefined,
                })),
        ),
    )
    return (
        <BillingOverviewBase
            state={{ isRenewing: renewal.isRequesting, usage: usage.state }}
            props={{
                title: t("pageTitle"),
                description: t("pageText"),
                backHref: AUTH_ROUTES.workspaces,
                backLabel: t("allWorkspaces"),
                planLabel: t("currentPlan"),
                statusLabel: t("status"),
                paidUntilLabel: t("paidUntil"),
                renewalLabel: renewal.isRequesting ? t("renewing") : t("renew"),
                renewalHint: t("renewHint"),
                plan: planCard,
                planSlotLabels: slotLabels(t("noPlan")),
                usage: usage.props,
                historyTitle: t("history"),
                historyEmpty: t("noHistory"),
                orders: ordersSlot,
                ordersSlotLabels: slotLabels(t("noHistory")),
                reviewTitle: t("review"),
                reviewDescription: t("reviewText"),
                reviewEmpty: t("noReview"),
                review: reviewSlot,
                reviewSlotLabels: slotLabels(t("noReview")),
            }}
            on={{
                renew: () => {
                    void renewal.request({ kind: "renew" })
                },
                retryPlan: () => {
                    void workspace.mutate()
                    void plan.mutate()
                },
                retryOrders: () => {
                    void orders.mutate()
                },
                retryReview: () => {
                    void review.mutate()
                },
                openCredits: usage.on.openCredits,
                formatUsageDay: usage.on.formatDay,
                formatUsageCredits: usage.on.formatCredits,
                minimumUsageBarSize: usage.on.minimumBarSize,
            }}
        />
    )
}
