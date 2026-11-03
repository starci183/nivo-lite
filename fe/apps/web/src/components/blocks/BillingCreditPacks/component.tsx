import { CreditsCatalogue } from "@/components/composites/CreditsCatalogue"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import type { CreditsOverviewView, DataSlot, PayTarget, SlotLabels } from "@/modules/types"

/** Settled copy and rows of the "Buy more credits" section. */
export interface BillingCreditPacksBaseProps {
    readonly props: {
        readonly title: string
        readonly fact: string
        readonly buy: string
        readonly empty: string
        readonly canBuy: boolean
        readonly slot: DataSlot<CreditsOverviewView["packs"]>
        readonly labels: SlotLabels
    }
    readonly on: { readonly buy: (target: PayTarget) => void; readonly retry: () => void }
}

/** Draws the add-on credit packs of the current plan. */
export const BillingCreditPacksBase = (props: BillingCreditPacksBaseProps) => (
    <SlotView
        slot={props.props.slot}
        placeholder={[]}
        labels={props.props.labels}
        empty="collapse"
        onRetry={props.on.retry}
        render={(packs, isLoading) => (
            <CreditsCatalogue
                props={{
                    packs,
                    canBuy: props.props.canBuy,
                    label: props.props.title,
                    fact: props.props.fact,
                    buy: props.props.buy,
                    empty: props.props.empty,
                    isLoading,
                }}
                on={{ buy: props.on.buy }}
            />
        )}
    />
)
