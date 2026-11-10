import { Stack, Alert } from "@starci/grammar/common"

import { CreditsBalance } from "@/components/composites/CreditsBalance"
import { CreditsCatalogue } from "@/components/composites/CreditsCatalogue"
import { CreditsUpgrade } from "@/components/composites/CreditsUpgrade"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import type { CreditsOverviewView, DataSlot, PayTarget, SlotLabels } from "@/modules/types"

/** The resolved words of the overview. */
interface CreditsOverviewLabels {
    readonly balance: string
    readonly topups: string
    readonly topupFact: string
    readonly upgrade: string
    readonly buy: string
    readonly loading: string
    readonly emptyPacks: string
}

/** Which part of the overview a slot of the page draws: the balance in the main column, or the offers (upgrade, packs) in the rail. */
export type CreditsOverviewShape = "balance" | "offers"

type CreditsOverviewBaseProps = {
    readonly shape: CreditsOverviewShape
    readonly props: {
        /** The view drawn from no data: the placeholder the skeleton reuses. */
        readonly view: CreditsOverviewView
        readonly labels: CreditsOverviewLabels
        readonly slotLabels: SlotLabels
        readonly slot: DataSlot<CreditsOverviewView>
    }
    readonly on: { readonly buy: (target: PayTarget) => void; readonly retry: () => void }
}

/** Draws one part of the credits overview from settled copy, slots and purchase actions: the balance, or the upgrade and the packs. */
export const CreditsOverviewBase = (props: CreditsOverviewBaseProps) => {
    const copy = props.props
    return (
        <Stack gap="section">
            <SlotView
                slot={copy.slot}
                placeholder={copy.view}
                labels={copy.slotLabels}
                onRetry={props.on.retry}
                render={(view, isLoading) =>
                    props.shape === "balance" ? (
                        <>
                            {view.canBuy ? null : <Alert tone="informative" title={view.staffNote} isLoading={isLoading} />}
                            <CreditsBalance props={{ balance: view.balance, label: copy.labels.balance, isLoading }} />
                        </>
                    ) : (
                        <>
                            <CreditsUpgrade
                                props={{ view, title: copy.labels.upgrade, loading: copy.labels.loading, isLoading }}
                                on={{ upgrade: props.on.buy }}
                            />
                            <CreditsCatalogue
                                props={{
                                    packs: view.packs,
                                    canBuy: view.canBuy,
                                    label: copy.labels.topups,
                                    fact: copy.labels.topupFact,
                                    buy: copy.labels.buy,
                                    empty: copy.labels.emptyPacks,
                                    isLoading,
                                }}
                                on={{ buy: props.on.buy }}
                            />
                        </>
                    )
                }
            />
        </Stack>
    )
}
