import type { BadgeTone } from "@starci/grammar/common" with { "resolution-mode": "import" }
import type { SlotPanelProps } from "../../slot/slot.types"

/** Where a list of waiting rows stands: a card on a card page, or an app-owned list inside a pane. */
export type WorkbenchSurface = "card" | "pane"

/** The trace line under a row: the branch that decided it, or the gate's reason when no branch did. */
export interface WorkbenchTraceView {
    readonly line: string
    /** The why pane of the item; null for an item with no recorded decision. */
    readonly whyHref: string | null
}

/** Atomic words and capability state of a row command, with no operation callback. */
export interface WorkbenchCommandData {
    readonly id: string
    readonly label: string
    readonly isPending?: boolean
    readonly isDisabled?: boolean
    readonly disabledReason?: string
}

/** The existing domain command binding; a connected owner separates this action from its atomic view data. */
export interface WorkbenchCommandView extends WorkbenchCommandData {
    readonly onPress: () => void
}

/** One state or age mark on a row. */
export interface WorkbenchBadgeView {
    readonly label: string
    readonly tone: BadgeTone
}

/** One decision waiting for a person, or done by the agent, as a row draws it. */
export interface WorkbenchRowData {
    /** The work item id; the why pane opens on it. */
    readonly id: string
    readonly title: string
    /** One line. */
    readonly description: string
    /** State and age, at most two. */
    readonly badges: ReadonlyArray<WorkbenchBadgeView>
    /** Why the agent needs the owner, in plain words; null when the row says it already. */
    readonly reason: string | null
    readonly amount: string | null
    /** What the agent proposes, in code words or a performer's `prepare`. */
    readonly proposal: string
    readonly trace: WorkbenchTraceView | null
    readonly expiry: string | null
    /** The one visible command; null for a person with no right, who sees `waitingFor` instead. */
    readonly primary: WorkbenchCommandData | null
    /** The neutral command beside it that changes the proposal before it goes; null when the row cannot be edited. */
    readonly edit: WorkbenchCommandData | null
    readonly menu: ReadonlyArray<WorkbenchCommandData & { readonly isDanger?: boolean }>
    /** "Waiting for Dinh"; null when the viewer may press. */
    readonly waitingFor: string | null
}

/** Existing world-owner command bindings override only the three command fields; pure inputs use WorkbenchRowData. */
export interface WorkbenchRowView extends WorkbenchRowData {
    readonly primary: WorkbenchCommandView | null
    readonly edit: WorkbenchCommandView | null
    readonly menu: ReadonlyArray<WorkbenchCommandView & { readonly isDanger?: boolean }>
}

/** One step of the path a run walked. */
export interface WorkbenchPathStepView {
    readonly id: string
    readonly title: string
    readonly description: string
    readonly isCurrent: boolean
}

/** One fact the branch read, with its place. */
export interface WorkbenchFactView {
    readonly id: string
    readonly term: string
    readonly value: string
}

/** One source a decision leaned on: a Brain passage, a chat line, a template. */
export interface WorkbenchSourceView {
    readonly id: string
    /** A short word: Brain, Chat, Template. */
    readonly kind: string
    readonly text: string
    readonly byline: string
}

/** Who approves and how much of the time is used. */
export interface WorkbenchApproverView {
    readonly name: string
    readonly seed: string
    readonly limit: string
    readonly onTimeout: string
    /** 0 to 100. */
    readonly usedPercent: number
    readonly valueText: string
}

/** The why pane of one work item, every word resolved. */
export interface WorkbenchWhyView {
    readonly heading: string
    readonly branch: string
    /** One sentence built by code from the branch and the facts. */
    readonly reason: string
    readonly path: ReadonlyArray<WorkbenchPathStepView>
    readonly facts: ReadonlyArray<WorkbenchFactView>
    readonly sources: ReadonlyArray<WorkbenchSourceView>
    readonly approver: WorkbenchApproverView | null
    /** "Open on the map". */
    readonly mapHref: string
    /** The item is closed: no footer buttons. */
    readonly isClosed: boolean
}

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
    /** The one short chip at the end of the region's row: how many connections work. */
    readonly summary: string
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
    /** The one short chip at the end of the region's row: what the agent may read, and how many documents. */
    readonly summary: string
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
