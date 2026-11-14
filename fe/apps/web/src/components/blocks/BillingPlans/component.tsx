import { Link } from "@starci/grammar/common"
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
        /** The catalogue lives on its own page, reached by this link; absent, it is drawn here. */
        readonly link?: { readonly label: string; readonly href: string } | undefined
    }
    readonly on: {
        readonly setCycle: (value: string) => void
        readonly setTier: (planId: string, value: string) => void
        readonly setSeats: (value: number) => void
        readonly choose: (planId: string) => void
    }
}

/** Draws the plan catalogue from settled values here, or the link to the plan change page. */
export const BillingPlansBase = (props: BillingPlansBaseProps) => {
    const link = props.props.link
    if (link === undefined) return <PlanCatalog props={props.props} on={props.on} />
    return (
        <Link variant="plain" href={link.href}>
            {link.label}
        </Link>
    )
}
