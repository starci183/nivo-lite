"use client"

import { useTranslations } from "next-intl"
import { useBillingOverview } from "@/hooks/billing"
import { useSlotLabels } from "@/hooks/slot"
import { BillingOverviewBase } from "./component"

interface BillingOverviewProps {
    readonly workspaceId: string
}

/** Draws the connected view from its current state. */
export const BillingOverview = (props: BillingOverviewProps) => {
    const t = useTranslations("billing")
    const slotLabels = useSlotLabels()
    const overview = useBillingOverview(props.workspaceId)
    return (
        <BillingOverviewBase
            props={{
                isRenewing: overview.isRenewing,
                usageState: overview.usage.state,
                planLabel: t("currentPlan"),
                statusLabel: t("status"),
                paidUntilLabel: t("paidUntil"),
                renewalLabel: overview.isRenewing ? t("renewing") : t("renew"),
                renewalHint: t("renewHint"),
                plan: overview.plan,
                planSlotLabels: slotLabels(t("noPlan")),
                usage: overview.usage.props,
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
