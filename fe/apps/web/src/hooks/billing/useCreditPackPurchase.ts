"use client"

import { useEffect } from "react"
import { useQueryBillingPlanSwr, useQueryBillingWorkspaceSwr } from "@/hooks/swr"
import { slotOfReads, useSlotLabels } from "@/hooks/slot"
import { toast } from "@/modules/toast"
import { navigation } from "@/modules/i18n"
import { workspaceRenewalPaymentPath } from "@/modules/routes"
import { useRequestPaymentOrder } from "./useRequestPaymentOrder"
import type { DataSlot } from "@/modules/types"

/** The view `useCreditPackPurchase` returns. */
export interface CreditPackPurchaseView {
    packs: DataSlot<
        {
            creditsPerMonth: number
            priceVnd: number
            perSeat: boolean
        }[]
    >
    canBuy: boolean
    isRequesting: boolean
    retry: () => void
    buy: (credits: number) => void
}

/** The add-on credit packs of the plan a workspace is on, and the purchase that opens the payment screen. */
export const useCreditPackPurchase = (workspaceId: string): CreditPackPurchaseView => {
    const router = navigation.useRouter()
    const workspace = useQueryBillingWorkspaceSwr(workspaceId)
    const plan = useQueryBillingPlanSwr(workspace.data?.planCode ?? undefined)
    const order = useRequestPaymentOrder(workspaceId)
    const slotLabels = useSlotLabels()
    useEffect(() => {
        if (order.orderId) router.push(workspaceRenewalPaymentPath(workspaceId, order.orderId))
    }, [order.orderId, router, workspaceId])
    const role = workspace.data?.role
    const isActive = workspace.data?.status === "active" || workspace.data?.status === "past_due"
    const reads = workspace.data !== undefined && !isActive ? [workspace] : [workspace, plan]
    return {
        packs: slotOfReads(reads, () => {
            const status = workspace.data?.status
            if (status !== "active" && status !== "past_due") return undefined
            return plan.data?.packs
        }),
        canBuy: role === "owner" || role === "manager",
        isRequesting: order.isRequesting,
        retry: () => {
            Promise.all([workspace.mutate(), plan.mutate()]).catch(() => toast.danger(slotLabels("").error))
        },
        buy: (credits: number) => {
            void order.request({ kind: "credit_pack", target: String(credits) })
        },
    }
}
