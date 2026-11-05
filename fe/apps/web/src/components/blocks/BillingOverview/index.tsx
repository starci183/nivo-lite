"use client"

import { useTranslations } from "next-intl"
import { useBillingOverview } from "@/hooks/billing"
import { useMember } from "@/hooks/member"
import { useSlotLabels } from "@/hooks/slot"
import { BillingOverviewBase } from "./component"

interface BillingOverviewProps {
    /** The workspace to bill; the signed-in workspace when none is named. */
    readonly workspaceId?: string
    /** Draw the payment history too; the credits page has its own, so it leaves this one out. */
    readonly withOrders?: boolean
}

/** Draws the connected view from its current state. */
export const BillingOverview = (props: BillingOverviewProps) => {
    const t = useTranslations("billing")
    const slotLabels = useSlotLabels()
    const member = useMember()
    const overview = useBillingOverview(props.workspaceId ?? member?.workspaceId ?? "")
    return (
        <BillingOverviewBase
            props={{
                isRenewing: overview.isRenewing,
                withOrders: props.withOrders ?? true,
                planLabel: t("currentPlan"),
                statusLabel: t("status"),
                paidUntilLabel: t("paidUntil"),
                renewalLabel: overview.isRenewing ? t("renewing") : t("renew"),
                renewalHint: t("renewHint"),
                plan: overview.plan,
                planSlotLabels: slotLabels(t("noPlan")),
                usage: overview.usage.slot,
                usagePlaceholder: overview.usage.placeholder,
                usageSlotLabels: slotLabels(t("usageEmpty")),
                historyTitle: t("history"),
                historyEmpty: t("noHistory"),
                orders: overview.orders,
                ordersSlotLabels: slotLabels(t("noHistory")),
                reviewTitle: t("review"),
                reviewDescription: t("reviewText"),
                reviewEmpty: t("noReview"),
                review: overview.review,
                reviewSlotLabels: slotLabels(t("noReview")),
            }}
            on={overview.on}
        />
    )
}
