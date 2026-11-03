import { DossierFindingsFrame } from "@/components/frames/DossierFindingsFrame"
import type { DossierFindingsFrameView } from "@/components/frames/DossierFindingsFrame"
import { DossierFindingRows } from "@/components/composites/DossierFindingRows"
import type { FindingAction, FindingRowView } from "@/components/composites/DossierFindingRows"
import type { FindingDialogValues } from "@/components/composites/DossierFindingDialogs"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** The same finding-row geometry drawn while this region's actual read is pending. */
const PLACEHOLDER_ROW: FindingRowView = {
    id: "placeholder",
    title: "-",
    titleHref: null,
    detail: "-",
    badges: [{ id: "severity", label: "-", tone: "neutral" }],
    meta: null,
    isFocused: false,
    evidenceTitle: "-",
    evidence: [],
    sources: [],
    actions: [],
}
const PLACEHOLDER: ReadonlyArray<FindingRowView> = [1, 2, 3].map((n) => ({
    ...PLACEHOLDER_ROW,
    id: `placeholder-${n}`,
}))

/** Real read data and resolved findings anatomy, with command callbacks kept under on. */
export interface DossierFindingsBaseProps {
    readonly props: {
        readonly isVisible: boolean
        readonly frame: DossierFindingsFrameView
        readonly filterLabel: string
        readonly filters: ReadonlyArray<{ readonly value: string; readonly label: string }>
        readonly filter: string
        readonly listLabel: string
        readonly slot: DataSlot<ReadonlyArray<FindingRowView>>
        readonly slotLabels: SlotLabels
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

/** Draws this inline region's independent status inside the shared findings anatomy. */
export const DossierFindingsBase = (props: DossierFindingsBaseProps) => {
    const view = props.props
    if (!view.isVisible) return null
    return (
        <DossierFindingsFrame
            {...view.frame}
            onReview={props.on.review}
            onLoadMore={props.on.loadMore}
            onRetry={props.on.retry}
            onSubmitDialog={props.on.submitDialog}
            onCloseDialog={props.on.closeDialog}
        >
            <SlotView
                slot={view.slot}
                placeholder={PLACEHOLDER}
                labels={view.slotLabels}
                onRetry={props.on.retry}
                render={(rows, isLoading) => (
                    <DossierFindingRows
                        label={view.listLabel}
                        rows={rows}
                        isSkeleton={isLoading}
                        filterLabel={view.filterLabel}
                        filters={view.filters}
                        filter={view.filter}
                        onFilterChange={props.on.setFilter}
                        onAction={props.on.action}
                    />
                )}
            />
        </DossierFindingsFrame>
    )
}
