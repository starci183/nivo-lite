import { Stack, Grid, Alert } from "@starci/grammar/common"

import { CreditsBalance } from "@/components/composites/CreditsBalance"
import { CreditsCatalogue } from "@/components/composites/CreditsCatalogue"
import { CreditsUpgrade } from "@/components/composites/CreditsUpgrade"
import { SlotView } from "@/components/composites/SlotView"
import type { CreditsOverviewView, DataSlot, PayTarget, SlotLabels } from "@/modules/types"

/** The resolved words of the overview. */
interface CreditsOverviewLabels {
    readonly balance: string
    readonly topups: string
    readonly topupFact: string
    readonly upgrade: string
    readonly plans: string
    readonly plansLabel: string
    readonly buy: string
    readonly plansCta: string
    readonly plansHref: string
    readonly loading: string
    readonly emptyPacks: string
}

type CreditsOverviewBaseProps = {
    readonly props: {
        /** The view drawn from no data: the placeholder the skeleton reuses. */
        readonly view: CreditsOverviewView
        readonly labels: CreditsOverviewLabels
        readonly slotLabels: SlotLabels
        readonly slot: DataSlot<CreditsOverviewView>
    }
    readonly on: { readonly buy: (target: PayTarget) => void; readonly retry: () => void }
}

/** Draws the credits overview entirely from settled copy, slots and purchase actions. */
export const CreditsOverviewBase = (props: CreditsOverviewBaseProps) => {
    const copy = props.props
    return (
        <Stack gap="section">
            <SlotView
                slot={copy.slot}
                placeholder={copy.view}
                labels={copy.slotLabels}
                onRetry={props.on.retry}
                render={(view, isLoading) => (
                    <>
                        {view.canBuy ? null : <Alert tone="informative" title={view.staffNote} isLoading={isLoading} />}
                        <CreditsBalance props={{ balance: view.balance, label: copy.labels.balance, isLoading }} />
                        <Grid kind="cards" columns={2}>
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
                            <CreditsUpgrade
                                props={{
                                    view,
                                    title: copy.labels.upgrade,
                                    plansTitle: copy.labels.plans,
                                    plansLabel: copy.labels.plansLabel,
                                    plansCta: copy.labels.plansCta,
                                    plansHref: copy.labels.plansHref,
                                    loading: copy.labels.loading,
                                    isLoading: isLoading,
                                }}
                                on={{ upgrade: props.on.buy }}
                            />
                        </Grid>
                    </>
                )}
            />
        </Stack>
    )
}
