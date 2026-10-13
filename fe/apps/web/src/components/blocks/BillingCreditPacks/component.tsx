import { CreditsCatalogue } from "@/components/composites/CreditsCatalogue"
import type { PayTarget } from "@/modules/types"

/** Settled copy and rows of the "Buy more credits" section. */
export interface BillingCreditPacksBaseProps {
    readonly props: {
        readonly title: string
        readonly fact: string
        readonly buy: string
        readonly empty: string
        readonly loading: string
        readonly canBuy: boolean
        readonly packs: React.ComponentProps<typeof CreditsCatalogue>["props"]["packs"]
    }
    readonly on: { readonly buy: (target: PayTarget) => void }
}

/** Draws the add-on credit packs of the current plan. */
export const BillingCreditPacksBase = (props: BillingCreditPacksBaseProps) => (
    <CreditsCatalogue
        props={{
            packs: props.props.packs,
            canBuy: props.props.canBuy,
            label: props.props.title,
            fact: props.props.fact,
            buy: props.props.buy,
            empty: props.props.empty,
            loading: props.props.loading,
            isSkeleton: false,
        }}
        on={{ buy: props.on.buy }}
    />
)
