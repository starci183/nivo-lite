import { PlanCatalog } from "@/components/composites/PlanCatalog"
import type { PlanGroupView } from "@/modules/types"

/** Settled copy, prices and interactions of the plan catalogue. */
export interface BillingPlansBaseProps {
    readonly props: {
        readonly title: string
        readonly text: string
        readonly cycleLabel: string
        readonly cycle: string
        readonly cycleOptions: ReadonlyArray<{ readonly value: string; readonly label: string }>
        readonly notice?: string | undefined
        readonly storage?: string | undefined
        readonly groups: ReadonlyArray<PlanGroupView>
    }
    readonly on: {
        readonly setCycle: (value: string) => void
        readonly setTier: (planId: string, value: string) => void
        readonly setSeats: (value: number) => void
        readonly choose: (planId: string) => void
    }
}

/** Draws the plan catalogue from settled values. */
export const BillingPlansBase = (props: BillingPlansBaseProps) => <PlanCatalog props={props.props} on={props.on} />
