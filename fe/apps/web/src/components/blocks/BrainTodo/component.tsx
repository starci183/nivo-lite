import type { ReactNode } from "react"
import { Alert, Button } from "@starci/grammar/common"
import { DossierFindingDialogs } from "@/components/composites/DossierFindingDialogs"
import type { FindingDialogValues, FindingDialogView } from "@/components/composites/DossierFindingDialogs"
import { FindingCards } from "@/components/composites/FindingCards"
import type { FindingCardActionView, FindingCardView } from "@/components/composites/FindingCards"
import { SlotView } from "@/components/composites/SlotView"
import { FilterButtons } from "@/components/leaves/FilterButtons"
import type { FilterButtonView } from "@/components/leaves/FilterButtons"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { TODO_CLASS_NAME } from "./classNames"

/** Copy and values the queue of what needs doing supplies. */
export interface BrainTodoBaseProps {
    /** The lists of facts waiting and customer questions, drawn by their own blocks; null where the filter or the queue leaves them out. */
    readonly shape: { readonly facts: ReactNode; readonly questions: ReactNode }
    readonly props: {
        readonly filterLabel: string
        readonly filters: ReadonlyArray<FilterButtonView>
        readonly filter: string
        readonly cardsLabel: string
        /** The finding cards as their slot carries them; not drawn when the queue holds only facts and questions. */
        readonly cards: DataSlot<ReadonlyArray<FindingCardView>> | null
        readonly slotLabels: SlotLabels
        readonly hasNextPage: boolean
        readonly isLoadingMore: boolean
        readonly loadMoreLabel: string
        /** A later page failed to load: the words of the failure; null when none did. */
        readonly pageFailure: string | null
        readonly dialog: FindingDialogView | null
    }
    readonly on: {
        readonly setFilter: (value: string) => void
        readonly action: (findingId: string, action: FindingCardActionView) => void
        readonly loadMore: () => void
        readonly retry: () => void
        readonly submitDialog: (values: FindingDialogValues) => void
        readonly closeDialog: () => void
    }
}

/** What follows the last card: a way to read the next page, or the failure of reading it. */
/** What the paging of the cards needs. */
interface MoreProps {
    readonly props: BrainTodoBaseProps["props"]
    readonly on: Pick<BrainTodoBaseProps["on"], "loadMore" | "retry">
}

const More = (props: MoreProps) => {
    const view = props.props
    if (view.pageFailure !== null) {
        return (
            <Alert
                tone="negative"
                title={view.pageFailure}
                action={{ label: view.slotLabels.retry, onAction: props.on.retry }}
            />
        )
    }
    return view.hasNextPage ? (
        <Button intent="neutral" isPending={view.isLoadingMore} onPress={props.on.loadMore}>
            {view.loadMoreLabel}
        </Button>
    ) : null
}

/**
 * Draws the one queue of what needs the owner: a row of filters, the findings of the dossiers as cards (worst first), then the
 * facts waiting for a decision and the questions customers asked that nobody answered.
 */
export const BrainTodoBase = (props: BrainTodoBaseProps) => {
    const view = props.props
    return (
        <div className={TODO_CLASS_NAME}>
            {view.filters.length > 1 ? (
                <FilterButtons
                    label={view.filterLabel}
                    options={view.filters}
                    value={view.filter}
                    onValueChange={props.on.setFilter}
                />
            ) : null}
            {view.cards === null ? null : (
                <SlotView slot={view.cards} placeholder={[]} labels={view.slotLabels} onRetry={props.on.retry}>
                    {(cards, isSkeleton) => (
                        <FindingCards
                            label={view.cardsLabel}
                            cards={cards}
                            isSkeleton={isSkeleton}
                            onAction={props.on.action}
                        />
                    )}
                </SlotView>
            )}
            {view.cards === null ? null : <More props={view} on={props.on} />}
            {props.shape.facts}
            {props.shape.questions}
            {view.dialog === null ? null : (
                <DossierFindingDialogs
                    props={view.dialog}
                    on={{ submit: props.on.submitDialog, close: props.on.closeDialog }}
                />
            )}
        </div>
    )
}
