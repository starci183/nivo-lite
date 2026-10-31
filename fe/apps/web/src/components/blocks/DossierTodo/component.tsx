import { Alert, Button, SectionHeader, SegmentedControl, Select } from "@starci/grammar/common"
import { DossierFindingRows } from "@/components/composites/DossierFindingRows"
import type { FindingAction, FindingRowView } from "@/components/composites/DossierFindingRows"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { FILTERS_CLASS_NAME, LIST_CLASS_NAME, TODO_CLASS_NAME } from "./classNames"

/** Copy and values the list of what needs doing supplies. */
export interface DossierTodoBaseProps {
    readonly props: {
        readonly title: string
        readonly filterLabel: string
        readonly filters: ReadonlyArray<{ readonly value: string; readonly label: string }>
        readonly filter: string
        readonly severityLabel: string
        readonly severities: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly severity: string
        readonly listLabel: string
        readonly slot: DataSlot<ReadonlyArray<FindingRowView>>
        readonly placeholder: ReadonlyArray<FindingRowView>
        readonly slotLabels: SlotLabels
        readonly hasNextPage: boolean
        readonly isLoadingMore: boolean
        readonly loadMoreLabel: string
        /** A later page failed to load: the words of the failure; null when none did. */
        readonly pageFailure: string | null
    }
    readonly on: {
        readonly setFilter: (value: string) => void
        readonly setSeverity: (value: string | null) => void
        readonly action: (findingId: string, action: FindingAction) => void
        readonly loadMore: () => void
        readonly retry: () => void
    }
}

/** What follows the last row: a way to read the next page, or the failure of reading it. */
const More = (props: DossierTodoBaseProps) => {
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
 * Draws what needs doing across the dossiers: the findings still open or confirmed, worst first, narrowed by who has them and
 * how serious they are. A row leads to its dossier.
 */
export const DossierTodoBase = (props: DossierTodoBaseProps) => {
    const view = props.props
    return (
        <div className={TODO_CLASS_NAME}>
            <SectionHeader level={2} title={view.title} />
            <div className={FILTERS_CLASS_NAME}>
                <SegmentedControl
                    label={view.filterLabel}
                    isLabelHidden
                    options={view.filters}
                    value={view.filter}
                    onValueChange={props.on.setFilter}
                />
                <Select
                    label={view.severityLabel}
                    options={view.severities}
                    value={view.severity}
                    onValueChange={props.on.setSeverity}
                />
            </div>
            <div className={LIST_CLASS_NAME}>
                <SlotView
                    slot={view.slot}
                    placeholder={view.placeholder}
                    labels={view.slotLabels}
                    onRetry={props.on.retry}
                >
                    {(rows, isSkeleton) => (
                        <DossierFindingRows
                            label={view.listLabel}
                            rows={rows}
                            isSkeleton={isSkeleton}
                            onAction={props.on.action}
                        />
                    )}
                </SlotView>
                <More {...props} />
            </div>
        </div>
    )
}
