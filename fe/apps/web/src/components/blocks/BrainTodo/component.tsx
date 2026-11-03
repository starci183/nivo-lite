import { Alert, Button } from "@starci/grammar/common"
import { DossierFindingDialogs } from "@/components/composites/DossierFindingDialogs"
import type { FindingDialogValues, FindingDialogView } from "@/components/composites/DossierFindingDialogs"
import { FindingCards } from "@/components/composites/FindingCards"
import type { FindingCardActionView, FindingCardView } from "@/components/composites/FindingCards"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { FilterButtons } from "@/components/leaves/FilterButtons"
import type { FilterButtonView } from "@/components/leaves/FilterButtons"
import type { DataSlot, SlotLabels, KnowledgeListView } from "@/modules/types"
import {
    KNOWLEDGE_ROWS_PLACEHOLDER,
    KnowledgeRowList,
    KnowledgeRowsSection,
    rowListPropsOf,
} from "@/components/composites/KnowledgeRows"
import { TODO_CLASS_NAME } from "./classNames"

/** Copy and values the queue of what needs doing supplies. */
export interface BrainTodoBaseProps {
    readonly props: {
        readonly review: KnowledgeListView | null
        readonly proposals: KnowledgeListView | null
        readonly gaps: KnowledgeListView | null
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
        readonly reviewAction: (rowId: string, actionId: string, partId?: string) => void
        readonly gapAction: (rowId: string, actionId: string) => void
        readonly proposalAction: (rowId: string, actionId: string) => void
        readonly retryReview: () => void
        readonly retryGaps: () => void
        readonly retryProposals: () => void
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
 * facts waiting for a decision, the answers NIVO found in the internal documents for customers' questions and the questions
 * customers asked that nobody answered.
 */
export const BrainTodoBase = (props: BrainTodoBaseProps) => {
    const view = props.props
    const regions = [
        { id: "review", list: view.review, action: props.on.reviewAction, retry: props.on.retryReview },
        { id: "proposals", list: view.proposals, action: props.on.proposalAction, retry: props.on.retryProposals },
        { id: "gaps", list: view.gaps, action: props.on.gapAction, retry: props.on.retryGaps },
    ]
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
                <SlotView
                    slot={view.cards}
                    placeholder={[]}
                    labels={view.slotLabels}
                    onRetry={props.on.retry}
                    render={(cards, isLoading) => (
                        <FindingCards
                            label={view.cardsLabel}
                            cards={cards}
                            isLoading={isLoading}
                            onAction={props.on.action}
                        />
                    )}
                />
            )}
            {view.cards === null ? null : <More props={view} on={props.on} />}
            {regions.map((region) => {
                const list = region.list
                return list === null ? null : (
                    <SlotView
                        key={region.id}
                        slot={list.slot}
                        placeholder={KNOWLEDGE_ROWS_PLACEHOLDER}
                        labels={list.slotLabels}
                        empty="collapse"
                        onRetry={region.retry}
                        render={(rows, isLoading) => (
                            <KnowledgeRowsSection
                                isHeadingInCard
                                section={list.section}
                                isLoading={isLoading}
                                body={
                                    <KnowledgeRowList
                                        {...rowListPropsOf(list)}
                                        rows={rows}
                                        isLoading={isLoading}
                                        onAction={region.action}
                                    />
                                }
                            />
                        )}
                    />
                )
            })}
            {view.dialog === null ? null : (
                <DossierFindingDialogs
                    props={view.dialog}
                    on={{ submit: props.on.submitDialog, close: props.on.closeDialog }}
                />
            )}
        </div>
    )
}
