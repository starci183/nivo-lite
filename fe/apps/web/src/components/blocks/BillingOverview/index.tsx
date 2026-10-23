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
import { BillingOverviewBase, buildBillingOverviewState, type BillingOverviewBaseProps } from "./component"

interface BillingOverviewProps {
    readonly workspaceId: string
}

/** Draws the connected view from its current state. */
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

    const error: unknown = workspace.error || orders.error || plan.error || review.error
    let phase: BillingOverviewBaseProps["state"]["phase"] = "ready"
    if (!workspace.data || !orders.data || !review.data || plan.isLoading) phase = "loading"
    if (error || (workspace.data && !allowed)) phase = "error"
    const connected = buildBillingOverviewState({
        workspace,
        orders,
        plan,
        review,
        phase,
        error,
        format,
        t,
        locale,
        renewal,
        usage,
        timeZone: PRODUCT_TIME_ZONE,
    })
    return (
        <BillingOverviewBase
            state={{
                phase,
                canRenew: Boolean(plan.data && !plan.data.isCustom),
                isRenewing: renewal.isRequesting,
                usage: usage.state,
            }}
            props={billingOverviewProps(connected)}
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

/** Builds the props supplied to BillingOverviewBase. */
const billingOverviewProps = (
    connected: NonNullable<ReturnType<typeof buildBillingOverviewState>>,
): Parameters<typeof BillingOverviewBase>[0]["props"] => {
    const {
        t,
        error,
        planName,
        statusLabels,
        workspace,
        statusTones,
        paidUntil,
        format,
        renewal,
        usage,
        orders,
        money,
        stamp,
        orderLabels,
        orderTones,
        review,
        reviewLabels,
    } = connected
    return {
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
    }
}
