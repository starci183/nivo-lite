import { useQueryBillingPlanSwr, useQueryBillingPlansSwr } from "@/hooks/swr"
import { readError } from "@/hooks/workspaceread"

/** The view `useCatalogWithCurrent` returns. */
export interface CatalogWithCurrentView {
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
    current:
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
          }
        | null
        | undefined
    isCurrentLoading: boolean
    error: unknown
    refresh: () => Promise<void>
}

/** The plans on sale together with the plan a workspace is on, which may no longer be sold. */
export const useCatalogWithCurrent = (currentCode: string | null | undefined): CatalogWithCurrentView => {
    const plans = useQueryBillingPlansSwr()
    const current = useQueryBillingPlanSwr(currentCode ?? undefined)
    return {
        plans: plans.data,
        current: current.data,
        isCurrentLoading: currentCode != null && current.data === undefined && !current.error,
        error: readError(plans) ?? readError(current),
        refresh: async () => {
            await Promise.all([plans.mutate(), current.mutate()])
        },
    }
}
