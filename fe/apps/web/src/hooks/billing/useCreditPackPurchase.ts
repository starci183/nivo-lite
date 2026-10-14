"use client"

import { useEffect } from "react"
import { useQueryBillingPlanSwr, useQueryBillingWorkspaceSwr } from "@/hooks/swr"
import { navigation } from "@/modules/i18n"
import { workspaceRenewalPaymentPath } from "@/modules/routes"
import { useRequestPaymentOrder } from "./useRequestPaymentOrder"

/** The add-on credit packs of the plan a workspace is on, and the purchase that opens the payment screen. */
export const useCreditPackPurchase = (workspaceId: string) => {
    const router = navigation.useRouter()
    const workspace = useQueryBillingWorkspaceSwr(workspaceId)
    const plan = useQueryBillingPlanSwr(workspace.data?.planCode ?? undefined)
    const order = useRequestPaymentOrder(workspaceId)
    useEffect(() => {
        if (order.orderId) router.push(workspaceRenewalPaymentPath(workspaceId, order.orderId))
    }, [order.orderId, router, workspaceId])
    const role = workspace.data?.role
    return {
        packs: plan.data?.packs ?? [],
        isActive: workspace.data?.status === "active" || workspace.data?.status === "past_due",
        canBuy: role === "owner" || role === "manager",
        isRequesting: order.isRequesting,
        buy: (credits: number) => {
            void order.request({ kind: "credit_pack", target: String(credits) })
        },
    }
}
