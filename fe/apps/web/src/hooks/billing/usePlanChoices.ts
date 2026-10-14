"use client"

import { useEffect, useState } from "react"
import {
    useQueryBillingPlanQuotesSwr,
    useQueryBillingPlansSwr,
    useQueryBillingStorageSwr,
    useQueryBillingWorkspaceSwr,
} from "@/hooks/swr"
import type { BillingPlanType } from "@/modules/api"
import { navigation } from "@/modules/i18n"
import { workspaceRenewalPaymentPath } from "@/modules/routes"
import { useRequestPaymentOrder } from "./useRequestPaymentOrder"

/** How a plan is paid. */
export type PlanCycle = "monthly" | "annual"

/** The selection the page prices and buys for one plan. */
interface PlanSelection {
    readonly planCode: string
    readonly cycle: PlanCycle
    readonly tierCredits: number | null
    readonly seats: number | null
}

/** The plan that is sold by the number of seats starts with the smallest credit level. */
const selectionOf = (
    plan: BillingPlanType,
    cycle: PlanCycle,
    tiers: Readonly<Record<string, number | null>>,
    seats: number,
): PlanSelection => ({
    planCode: plan.code,
    cycle: plan.priceAnnualVnd === null ? "monthly" : cycle,
    tierCredits: tiers[plan.code] ?? (plan.perSeat ? (plan.tiers[0]?.creditsPerMonth ?? null) : null),
    seats: plan.perSeat ? seats : null,
})

/** The plan catalogue of a workspace: selection state, server prices, and the purchase that opens the payment screen. */
export const usePlanChoices = (workspaceId: string) => {
    const router = navigation.useRouter()
    const workspace = useQueryBillingWorkspaceSwr(workspaceId)
    const plans = useQueryBillingPlansSwr()
    const storage = useQueryBillingStorageSwr(workspaceId)
    const order = useRequestPaymentOrder(workspaceId)
    const [cycle, setCycle] = useState<PlanCycle>("monthly")
    const [tiers, setTiers] = useState<Readonly<Record<string, number | null>>>({})
    const [seats, setSeats] = useState(1)
    const buyable = (plans.data ?? []).filter((plan) => !plan.isCustom)
    const selections = buyable.map((plan) => selectionOf(plan, cycle, tiers, seats))
    const quotes = useQueryBillingPlanQuotesSwr(workspaceId, selections)
    useEffect(() => {
        if (order.orderId) router.push(workspaceRenewalPaymentPath(workspaceId, order.orderId))
    }, [order.orderId, router, workspaceId])
    const setTier = (planCode: string, creditsPerMonth: number | null) =>
        setTiers((current) => ({ ...current, [planCode]: creditsPerMonth }))
    const choose = (planCode: string) => {
        const selection = selections.find((candidate) => candidate.planCode === planCode)
        if (selection === undefined) return
        void order.request({
            kind: "plan",
            target: selection.planCode,
            cycle: selection.cycle,
            tierCredits: selection.tierCredits,
            seats: selection.seats,
        })
    }
    return {
        plans: plans.data,
        workspace: workspace.data,
        storage: storage.data,
        error: plans.error ?? workspace.error,
        selections,
        quotes: quotes.data,
        isQuoting: quotes.isLoading,
        cycle,
        tiers,
        seats,
        isRequesting: order.isRequesting,
        setCycle,
        setTier,
        setSeats,
        choose,
    }
}
