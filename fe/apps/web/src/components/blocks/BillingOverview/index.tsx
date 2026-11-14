"use client"

import { useTranslations } from "next-intl"
import { useBillingOverview } from "@/hooks/billing"
import { useMember } from "@/hooks/member"
import { loadingSlot, useSlotLabels } from "@/hooks/slot"
import { useUsageCardPlaceholder } from "@/hooks/usageCard"
import { BillingOverviewBase, type BillingOverviewBaseProps } from "./component"

interface BillingOverviewProps {
    /** The workspace to bill; the signed-in workspace when none is named. */
    readonly workspaceId?: string
    /** Draw the payment history too; the credits page has its own, so it leaves this one out. */
    readonly withOrders?: boolean
}

/** The words of every region, the same for the ready view and its skeleton. */
const wordsOf = (
    t: ReturnType<typeof useTranslations<"billing">>,
    slotLabels: ReturnType<typeof useSlotLabels>,
    withOrders: boolean,
): Pick<
    BillingOverviewBaseProps["props"],
    | "withOrders"
    | "planLabel"
    | "planTermLabel"
    | "statusLabel"
    | "paidUntilLabel"
    | "renewalHint"
    | "planSlotLabels"
    | "usageSlotLabels"
    | "historyTitle"
    | "historyEmpty"
    | "ordersSlotLabels"
    | "reviewTitle"
    | "reviewDescription"
    | "reviewEmpty"
    | "reviewSlotLabels"
> => ({
    withOrders,
    planLabel: t("currentPlan"),
    planTermLabel: t("planTerm"),
    statusLabel: t("status"),
    paidUntilLabel: t("paidUntil"),
    renewalHint: t("renewHint"),
    planSlotLabels: slotLabels(t("noPlan")),
    usageSlotLabels: slotLabels(t("usageEmpty")),
    historyTitle: t("history"),
    historyEmpty: t("noHistory"),
    ordersSlotLabels: slotLabels(t("noHistory")),
    reviewTitle: t("review"),
    reviewDescription: t("reviewText"),
    reviewEmpty: t("noReview"),
    reviewSlotLabels: slotLabels(t("noReview")),
})

/** Draws the connected view from its current state. */
export const BillingOverview = (props: BillingOverviewProps) => {
    const t = useTranslations("billing")
    const slotLabels = useSlotLabels()
    const member = useMember()
    const overview = useBillingOverview(props.workspaceId ?? member?.workspaceId ?? "")
    return (
        <BillingOverviewBase
            props={{
                ...wordsOf(t, slotLabels, props.withOrders ?? true),
                isRenewing: overview.isRenewing,
                renewalLabel: overview.isRenewing ? t("renewing") : t("renew"),
                plan: overview.plan,
                usage: overview.usage.slot,
                usagePlaceholder: overview.usage.placeholder,
                orders: overview.orders,
                review: overview.review,
            }}
            on={overview.on}
        />
    )
}

/** What the skeleton is told: whether it stands for the history region too. */
interface BillingOverviewSkeletonProps {
    readonly withOrders?: boolean
}

/** The commands of the skeleton: none does anything, nothing is read. */
const NO_ON: BillingOverviewBaseProps["on"] = {
    renew: () => undefined,
    retryPlan: () => undefined,
    retryOrders: () => undefined,
    retryReview: () => undefined,
    retryUsage: () => undefined,
    openCredits: () => undefined,
    formatUsageDay: () => "",
    formatUsageCredits: () => "",
    minimumUsageBarSize: () => 0,
}

/** The same regions as skeletons, from copy alone: no data operation runs, so the route's loading page keeps the ready layout. */
export const BillingOverviewSkeleton = (props: BillingOverviewSkeletonProps) => {
    const t = useTranslations("billing")
    const slotLabels = useSlotLabels()
    const usagePlaceholder = useUsageCardPlaceholder()
    return (
        <BillingOverviewBase
            props={{
                ...wordsOf(t, slotLabels, props.withOrders ?? true),
                isRenewing: false,
                renewalLabel: t("renew"),
                plan: loadingSlot(),
                usage: loadingSlot(),
                usagePlaceholder,
                orders: loadingSlot(),
                review: loadingSlot(),
            }}
            on={NO_ON}
        />
    )
}
