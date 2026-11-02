import type { BadgeTone } from "@starci/grammar/common"
import type { SlotPanelProps } from "./slot"
import type { WorkbenchRowData, WorkbenchWhyView } from "./workbench"

/** A recorded dashboard item linking to its existing subject. */
export interface WorkbenchDashboardRow {
    readonly id: string
    readonly title: string
    readonly description: string
    readonly href: string
}
/** What the waiting region shows once read. */
export interface WorkbenchWaitingRegionView {
    /** The count badge; null when nothing waits. */
    readonly count: string | null
    readonly rows: ReadonlyArray<WorkbenchDashboardRow>
    readonly openLabel: string
    readonly more: string | null
    readonly emptyMessage: string
    readonly emptyDescription: string
}

/** What the done region shows once read. */
export interface WorkbenchDoneRegionView {
    readonly count: string
    readonly logLabel: string
    readonly logHref: string
    readonly rows: ReadonlyArray<WorkbenchDashboardRow>
    readonly emptyMessage: string
    readonly emptyDescription: string
}

/** What the connections region shows once read. */
export interface WorkbenchConnectionsRegionView {
    readonly manageLabel: string
    readonly manageHref: string
    readonly rows: ReadonlyArray<{
        readonly id: string
        readonly name: string
        readonly description: string
        readonly statusLabel: string
        readonly statusTone: BadgeTone
        readonly accessLabel: string
    }>
    readonly emptyMessage: string
    readonly emptyDescription: string
}

/** The open knowledge gaps of the agent. */
export interface WorkbenchKnowledgeGapsView {
    readonly label: string
    /** The count badge; null when no gap is open. */
    readonly count: string | null
    readonly openLabel: string
    readonly openHref: string
    readonly rows: ReadonlyArray<{
        readonly id: string
        readonly title: string
        readonly description: string
        readonly asked: string
    }>
    readonly emptyMessage: string
    readonly emptyDescription: string
}

/** What the knowledge region shows once read. */
export interface WorkbenchKnowledgeRegionView {
    readonly openLabel: string
    readonly openHref: string
    readonly footer: string
    readonly publicTitle: string
    readonly publicDescription: string
    readonly internalTitle: string
    readonly internalDescription: string
    /** null shows no gaps block. */
    readonly gaps: WorkbenchKnowledgeGapsView | null
}

/** The words of the why pane that are not the decision's own. */
export interface WorkbenchWhyLabels {
    readonly pathLabel: string
    readonly factsLabel: string
    readonly sourcesLabel: string
    readonly approverLabel: string
    readonly timeLabel: string
    readonly openOnMap: string
    readonly missingTitle: string
    readonly missingBody: string
}
/** The same actual read, resting data and status copy that a region's block owns. */
export interface WorkbenchRegionSlot<T> extends SlotPanelProps<T> {
    readonly label: string
}

/** Four independently drawn dashboard regions; each keeps its real status and placeholder. */
export interface WorkbenchDashboardRegions {
    readonly waiting: WorkbenchRegionSlot<WorkbenchWaitingRegionView>
    readonly done: WorkbenchRegionSlot<WorkbenchDoneRegionView>
    readonly connections: WorkbenchRegionSlot<WorkbenchConnectionsRegionView>
    readonly knowledge: WorkbenchRegionSlot<WorkbenchKnowledgeRegionView>
}

/** The recorded explanation and resolved native pane labels, never a world-hook result. */
export interface WorkbenchExplanationView {
    readonly workItemId: string | null
    readonly view: WorkbenchWhyView | null
    readonly labels: WorkbenchWhyLabels
    readonly closeLabel: string
    readonly openLabel: string
    readonly paneLabel: string
    readonly listLabel: string
}

/** Actual figure facts; callback destinations and icon constructors do not cross a data boundary. */
/** Actual figure facts; callback destinations and icon constructors do not cross a data boundary. */
interface WorkbenchFigureFields {
    readonly id: string
    readonly term: string
    readonly value: string | number
    readonly unit?: string | number
    readonly meta?: string
}
/** A real optional native destination; disabled applies only when the figure has that destination. */
export type WorkbenchFigureData = WorkbenchFigureFields &
    ({ readonly href: string; readonly isDisabled?: boolean } | { readonly href?: never; readonly isDisabled?: never })

/** Carries one figure read with its status and placeholder data. */
export type WorkbenchFigureRegion = WorkbenchRegionSlot<ReadonlyArray<WorkbenchFigureData>>

/** The fixed native waiting-list vocabulary, independent of row callbacks and editor nodes. */
export interface WorkbenchWaitingListWords {
    readonly label: string
    readonly count: string | null
    readonly more: { readonly label: string; readonly href: string } | null
    readonly emptyMessage: string
    readonly emptyDescription: string
    readonly seeWhyLabel: string
    readonly moreLabel: string
}

/** Atomic waiting rows and their actual same-shape placeholder; commands remain under Base.on. */
export interface WorkbenchWaitingCardView extends SlotPanelProps<ReadonlyArray<WorkbenchRowData>> {
    readonly list: WorkbenchWaitingListWords
}
