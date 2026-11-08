"use client"

import {
    useQueryBillingPlanQuotesSwr,
    useQueryBillingPlansSwr,
    useQueryBillingStorageSwr,
    useQueryBillingWorkspaceSwr,
    type BillingPlanType,
} from "@/hooks/swr"
import { navigation } from "@/modules/i18n"
import { workspaceRenewalPaymentPath } from "@/modules/routes"
import { useEffect, useState, type Dispatch, type SetStateAction } from "react"
import { useRequestPaymentOrder } from "./useRequestPaymentOrder"
import { readError } from "@/hooks/workspaceread"

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

/** The view `usePlanChoices` returns. */
export interface PlanChoicesView {
    plans:
        | {
              code: string
              nameVi: string
              nameEn: string
              priceVnd: number
              period: string
              seats: number
              sort: number
              aiCreditsPerMonth: number | null
              isCustom: boolean
              priceAnnualVnd: number | null
              annualDiscountPct: number | null
              promoPriceVnd: number | null
              promoMonths: number | null
              storageGb: number | null
              individual: boolean
              perSeat: boolean
              listed: boolean
              features: {
                  vi: Array<string>
                  en: Array<string>
              }
              tiers: Array<{
                  creditsPerMonth: number
                  priceVnd: number
                  perSeat: boolean
              }>
              packs: Array<{
                  creditsPerMonth: number
                  priceVnd: number
                  perSeat: boolean
              }>
          }[]
        | undefined
    workspace:
        | {
              id: string
              name: string
              status: string
              planCode: string | null
              paidUntil: string | null
              tierCredits: number | null
              seatCount: number | null
              billingCycle: string | null
              billedMonthlyVnd: number | null
              role: string
          }
        | undefined
    storage:
        | {
              usedBytes: number
              quotaBytes: number | null
          }
        | undefined
    error: unknown
    selections: PlanSelection[]
    quotes:
        | ({
              planCode: string
              cycle: string
              months: number
              amountVnd: number
              listMonthlyVnd: number
              promo: boolean
              tierCredits: number | null
              seats: number
              creditsPerMonth: number | null
          } | null)[]
        | undefined
    isQuoting: boolean
    isLoading: boolean
    cycle: PlanCycle
    tiers: Readonly<Record<string, number | null>>
    seats: number
    isRequesting: boolean
    setCycle: Dispatch<SetStateAction<PlanCycle>>
    setTier: (planCode: string, creditsPerMonth: number | null) => void
    setSeats: Dispatch<SetStateAction<number>>
    choose: (planCode: string) => void
}

/** The plan catalogue of a workspace: selection state, server prices, and the purchase that opens the payment screen. */
export const usePlanChoices = (workspaceId: string): PlanChoicesView => {
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
        error: readError(plans) ?? readError(workspace) ?? readError(storage) ?? readError(quotes),
        selections,
        quotes: quotes.data,
        isQuoting: quotes.isLoading,
        isLoading: plans.isLoading || workspace.isLoading || storage.isLoading,
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
