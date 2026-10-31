import type { BadgeTone } from "@starci/grammar/common"

/** Where a list of waiting rows stands: a card on a card page, or an app-owned list inside a pane. */
export type WorkbenchSurface = "card" | "pane"

/** The tone of the dot beside the agent's state. */
export type WorkbenchStateTone = "neutral" | "accent" | "success" | "warning" | "danger"

/** One channel in the status band: bound and connected, or needed and not connected. */
export interface WorkbenchChannelView {
    readonly id: string
    readonly label: string
    readonly isMissing: boolean
}

/** The status band of a workbench, every word resolved. A fact that is not known is null and its cell is left out. */
export interface WorkbenchBandView {
    /** What the agent is doing; null until the work read answers. */
    readonly state: { readonly label: string; readonly tone: WorkbenchStateTone; readonly isEchoing: boolean } | null
    readonly mode: { readonly label: string; readonly tone: BadgeTone } | null
    /** "Version 7"; null when no version is published, never "Version 0". */
    readonly version: string | null
    readonly lastActivity: string
    readonly channels: ReadonlyArray<WorkbenchChannelView>
}

/** The trace line under a row: the branch that decided it, or the gate's reason when no branch did. */
export interface WorkbenchTraceView {
    readonly line: string
    /** The why pane of the item; null for an item with no recorded decision. */
    readonly whyHref: string | null
}

/** One command of a row. */
export interface WorkbenchCommandView {
    readonly id: string
    readonly label: string
    readonly isPending?: boolean
    readonly isDisabled?: boolean
    readonly disabledReason?: string
    readonly onPress: () => void
}

/** One state or age mark on a row. */
export interface WorkbenchBadgeView {
    readonly label: string
    readonly tone: BadgeTone
}

/** One decision waiting for a person, or done by the agent, as a row draws it. */
export interface WorkbenchRowView {
    /** The work item id; the why pane opens on it. */
    readonly id: string
    readonly title: string
    /** One line. */
    readonly description: string
    /** State and age, at most two. */
    readonly badges: ReadonlyArray<WorkbenchBadgeView>
    readonly amount: string | null
    /** What the agent proposes, in code words or a performer's `prepare`. */
    readonly proposal: string
    readonly trace: WorkbenchTraceView | null
    readonly expiry: string | null
    /** The one visible command; null for a person with no right, who sees `waitingFor` instead. */
    readonly primary: WorkbenchCommandView | null
    readonly menu: ReadonlyArray<WorkbenchCommandView & { readonly isDanger?: boolean }>
    /** "Waiting for Dinh"; null when the viewer may press. */
    readonly waitingFor: string | null
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

/** What a module's data must have for a need to be met. */
export type WorkbenchNeedMatch =
    | { readonly kind: "providers"; readonly providers: ReadonlyArray<string> }
    | { readonly kind: "source"; readonly flag: "creditsSource" | "payablesSource" }

/** The words a need has in the `workbench` namespace. */
export type WorkbenchNeedKey = "meta" | "ads" | "money" | "invoices"

/** One thing a block cannot show until something is connected. */
export interface WorkbenchNeed {
    readonly id: WorkbenchNeedKey
    readonly match: WorkbenchNeedMatch
}

/** A need that is not met, worded. */
export interface WorkbenchNeedView {
    readonly id: string
    readonly title: string
    readonly body: string
    readonly badge: string
    readonly actionLabel: string
    readonly href: string
}
