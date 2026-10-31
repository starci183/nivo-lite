import { Alert, Badge, Button, SectionHeader, SegmentedControl, Text } from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"
import { DossierFindingDialogs } from "@/components/composites/DossierFindingDialogs"
import type { FindingDialogValues, FindingDialogView } from "@/components/composites/DossierFindingDialogs"
import { DossierFindingRows } from "@/components/composites/DossierFindingRows"
import type { FindingAction, FindingRowView } from "@/components/composites/DossierFindingRows"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { LIST_CLASS_NAME, PANE_CLASS_NAME, STATUS_CLASS_NAME } from "./classNames"

/** Copy and values the findings pane of one dossier supplies. */
export interface DossierFindingsBaseProps {
    readonly props: {
        readonly title: string
        /** The status the review computed, then the checklist status beside it when they differ. */
        readonly badges: ReadonlyArray<{ readonly id: string; readonly label: string; readonly tone: BadgeTone }>
        /** When the dossier was last reviewed, or that it never was. */
        readonly reviewedLine: string
        readonly isRunning: boolean
        readonly runningLabel: string
        /** The button that reviews this dossier; null for a member who may only read. */
        readonly reviewLabel: string | null
        /** Why the last run read nothing with AI; null when it did or has not run. */
        readonly aiNotice: string | null
        readonly filterLabel: string
        readonly filters: ReadonlyArray<{ readonly value: string; readonly label: string }>
        readonly filter: string
        readonly listLabel: string
        readonly slot: DataSlot<ReadonlyArray<FindingRowView>>
        readonly placeholder: ReadonlyArray<FindingRowView>
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
        readonly review: () => void
        readonly action: (findingId: string, action: FindingAction) => void
        readonly loadMore: () => void
        readonly retry: () => void
        readonly submitDialog: (values: FindingDialogValues) => void
        readonly closeDialog: () => void
    }
}

/** The review state under the heading: the badges of the dossier and when NIVO last looked at it. */
const Standing = (
    props: Pick<DossierFindingsBaseProps["props"], "badges" | "reviewedLine" | "isRunning" | "runningLabel">,
) => (
    <div className={STATUS_CLASS_NAME}>
        {props.badges.map((badge) => (
            <Badge key={badge.id} tone={badge.tone}>
                {badge.label}
            </Badge>
        ))}
        <Text tone="muted">{props.isRunning ? props.runningLabel : props.reviewedLine}</Text>
    </div>
)

/** What follows the last row: a way to read the next page, or the failure of reading it. */
const More = (props: DossierFindingsBaseProps) => {
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
 * Draws the findings of one dossier in the detail pane: its heading with the review state and the button that reviews it again,
 * the notice when AI was skipped, the three lists (open, confirmed, closed) and the dialog of the action in progress.
 */
export const DossierFindingsBase = (props: DossierFindingsBaseProps) => {
    const view = props.props
    return (
        <div className={PANE_CLASS_NAME}>
            <SectionHeader
                level={2}
                title={view.title}
                action={
                    view.reviewLabel === null ? undefined : (
                        <Button intent="neutral" isDisabled={view.isRunning} onPress={props.on.review}>
                            {view.reviewLabel}
                        </Button>
                    )
                }
            />
            <Standing {...view} />
            {view.aiNotice === null ? null : <Alert tone="cautionary" title={view.aiNotice} />}
            <div className={LIST_CLASS_NAME}>
                <SegmentedControl
                    label={view.filterLabel}
                    isLabelHidden
                    options={view.filters}
                    value={view.filter}
                    onValueChange={props.on.setFilter}
                />
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
            {view.dialog === null ? null : (
                <DossierFindingDialogs
                    props={view.dialog}
                    on={{ submit: props.on.submitDialog, close: props.on.closeDialog }}
                />
            )}
        </div>
    )
}
