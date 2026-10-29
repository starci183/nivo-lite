"use client"

import { useEffect } from "react"
import { useFormatter, useLocale, useTranslations } from "next-intl"
import {
    useQueryBillingWorkspaceSwr,
    useQueryBillingPlanSwr,
    useQueryPaymentOrdersSwr,
    useQueryBillingReviewTransactionsSwr,
} from "@/hooks/swr"
import { useUsageCard } from "@/hooks/usageCard"
import { navigation } from "@/modules/i18n"
import { workspaceRenewalPaymentPath } from "@/modules/routes"
import { billingWordsOf, ordersSlotOf, planCardOf, reviewSlotOf } from "./billing.shared"
import { useRequestPaymentOrder } from "./useRequestPaymentOrder"

/**
 * Reads the billing of one workspace for its owner or manager and words it for the overview: the plan card, the payment
 * history, the transfers held for review and the usage card, with renew (which opens the renewal payment once its order
 * exists) and the retries. A viewer without the role reads every region as forbidden.
 */
export const useBillingOverview = (workspaceId: string) => {
    const t = useTranslations("billing")
    const format = useFormatter()
    const locale = useLocale()
    const router = navigation.useRouter()
    const renewal = useRequestPaymentOrder(workspaceId)
    useEffect(() => {
        if (renewal.orderId) router.push(workspaceRenewalPaymentPath(workspaceId, renewal.orderId))
    }, [renewal.orderId, router, workspaceId])
    const workspace = useQueryBillingWorkspaceSwr(workspaceId)
    const isAllowed = workspace.data?.role === "owner" || workspace.data?.role === "manager"
    const isRefused = workspace.data !== undefined && !isAllowed
    const selectedWorkspace = isAllowed ? workspaceId : undefined
    const usage = useUsageCard(selectedWorkspace)
    const plan = useQueryBillingPlanSwr(isAllowed ? (workspace.data?.planCode ?? undefined) : undefined)
    const orders = useQueryPaymentOrdersSwr(selectedWorkspace)
    const review = useQueryBillingReviewTransactionsSwr(
        selectedWorkspace,
        orders.data?.map((order) => order.id),
    )
    const words = billingWordsOf(t, format)
    return {
        isRenewing: renewal.isRequesting,
        usage,
        plan: planCardOf(words, locale, { workspace, plan }, isRefused),
        orders: ordersSlotOf(words, orders, isRefused),
        review: reviewSlotOf(words, review, isRefused),
        on: {
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
            retryUsage: usage.on.retry,
            openCredits: usage.on.openCredits,
            formatUsageDay: usage.on.formatDay,
            formatUsageCredits: usage.on.formatCredits,
            minimumUsageBarSize: usage.on.minimumBarSize,
        },
    }
}
