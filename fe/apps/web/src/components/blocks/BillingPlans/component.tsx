import { Button, Drawer } from "@starci/grammar/common"
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
        /** The catalogue opens in a drawer from its own command; absent, it is drawn in the page. */
        readonly drawer?: { readonly triggerLabel: string; readonly closeLabel: string } | undefined
    }
    readonly on: {
        readonly setCycle: (value: string) => void
        readonly setTier: (planId: string, value: string) => void
        readonly setSeats: (value: number) => void
        readonly choose: (planId: string) => void
    }
}

/** Draws the plan catalogue from settled values, in the page or in a drawer a command opens. */
export const BillingPlansBase = (props: BillingPlansBaseProps) => {
    const drawer = props.props.drawer
    if (drawer === undefined) return <PlanCatalog props={props.props} on={props.on} />
    return (
        <Drawer
            title={props.props.title}
            description={props.props.text}
            closeLabel={drawer.closeLabel}
            trigger={<Button intent="alternative">{drawer.triggerLabel}</Button>}
        >
            <PlanCatalog props={props.props} on={props.on} />
        </Drawer>
    )
}
