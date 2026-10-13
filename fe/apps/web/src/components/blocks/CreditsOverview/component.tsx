import { Alert } from "@starci/grammar/common"
import { CreditsBalance } from "@/components/composites/CreditsBalance"
import { CreditsCatalogue } from "@/components/composites/CreditsCatalogue"
import { CreditsUpgrade } from "@/components/composites/CreditsUpgrade"
import { SlotView } from "@/components/composites/SlotView"
import type { CreditsOverviewView, useCreditsView } from "@/hooks/credits"
import type { DataSlot, PayTarget } from "@/modules/types"
import { COLUMNS_CLASS_NAME, PAGE_CLASS_NAME } from "./classNames"

type CreditsOverviewBaseProps = {
    readonly props: ReturnType<typeof useCreditsView> & {
        readonly slot: DataSlot<CreditsOverviewView>
    }
    readonly on: { readonly buy: (target: PayTarget) => void; readonly retry: () => void }
}

/** Draws the credits overview entirely from settled copy, slots and purchase actions. */
export const CreditsOverviewBase = (props: CreditsOverviewBaseProps) => {
    const copy = props.props
    return (
        <>
            <div className={PAGE_CLASS_NAME}>
                <SlotView slot={copy.slot} placeholder={copy.view} labels={copy.slotLabels} onRetry={props.on.retry}>
                    {(view, isSkeleton) => (
                        <>
                            {view.canBuy || isSkeleton ? null : <Alert tone="informative" title={view.staffNote} />}
                            <CreditsBalance props={{ balance: view.balance, label: copy.labels.balance, isSkeleton }} />
                            <div className={COLUMNS_CLASS_NAME}>
                                <CreditsCatalogue
                                    props={{
                                        packs: view.packs,
                                        canBuy: view.canBuy,
                                        label: copy.labels.topups,
                                        fact: copy.labels.topupFact,
                                        buy: copy.labels.buy,
                                        empty: copy.labels.emptyPacks,
                                        loading: copy.labels.loading,
                                        isSkeleton,
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
                                        isSkeleton,
                                    }}
                                    on={{ upgrade: props.on.buy }}
                                />
                            </div>
                        </>
                    )}
                </SlotView>
            </div>
        </>
    )
}
