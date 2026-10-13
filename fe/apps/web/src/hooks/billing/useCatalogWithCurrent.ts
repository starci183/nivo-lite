import { useQueryBillingPlanSwr, useQueryBillingPlansSwr } from "@/hooks/swr"

/** The plans on sale together with the plan a workspace is on, which may no longer be sold. */
export const useCatalogWithCurrent = (currentCode: string | null | undefined) => {
    const plans = useQueryBillingPlansSwr()
    const current = useQueryBillingPlanSwr(currentCode ?? undefined)
    return {
        plans: plans.data,
        current: current.data,
        isCurrentLoading: currentCode != null && current.data === undefined && !current.error,
        error: plans.error ?? current.error,
        refresh: async () => {
            await Promise.all([plans.mutate(), current.mutate()])
        },
    }
}
