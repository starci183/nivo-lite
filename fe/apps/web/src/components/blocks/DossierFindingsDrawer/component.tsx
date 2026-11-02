import { Drawer } from "@starci/grammar/common"
import { DossierFindingsFrame } from "@/components/frames/DossierFindingsFrame"
import type { DossierFindingsFrameView } from "@/components/frames/DossierFindingsFrame"
import { DossierFindingRows } from "@/components/composites/DossierFindingRows"
import type { FindingAction, FindingRowView } from "@/components/composites/DossierFindingRows"
import type { FindingDialogValues } from "@/components/composites/DossierFindingDialogs"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** The same ready rows own the drawer's pending geometry. */
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

/** The selected findings read and its actual drawer copy. */
export interface DossierFindingsDrawerBaseProps {
    readonly props: {
        readonly isVisible: boolean
        readonly drawerTitle: string
        readonly closeLabel: string
        readonly frame: DossierFindingsFrameView
        readonly filterLabel: string
        readonly filters: ReadonlyArray<{ readonly value: string; readonly label: string }>
        readonly filter: string
        readonly listLabel: string
        readonly slot: DataSlot<ReadonlyArray<FindingRowView>>
        readonly slotLabels: SlotLabels
    }
    readonly on: {
        readonly close: () => void
        readonly setFilter: (value: string) => void
        readonly review: () => void
        readonly action: (findingId: string, action: FindingAction) => void
        readonly loadMore: () => void
        readonly retry: () => void
        readonly submitDialog: (values: FindingDialogValues) => void
        readonly closeDialog: () => void
    }
}

/** The original selected-dossier Drawer, now owned directly by its connected findings region. */
export const DossierFindingsDrawerBase = (props: DossierFindingsDrawerBaseProps) => {
    const view = props.props
    if (!view.isVisible) return null
    return (
        <Drawer
            isOpen
            onOpenChange={(isOpen) => {
                if (!isOpen) props.on.close()
            }}
            title={view.drawerTitle}
            closeLabel={view.closeLabel}
            placement="right"
        >
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
        </Drawer>
    )
}
