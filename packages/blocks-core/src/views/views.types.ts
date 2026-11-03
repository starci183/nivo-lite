import type { BadgeTone } from "@starci/grammar/common" with { "resolution-mode": "import" }

/** A recorded dashboard item linking to its existing subject. */
export interface DashboardRow {
    readonly id: string
    readonly title: string
    readonly description: string
    readonly href: string
}

/** What a region of finished or waiting items shows once read; the words of an empty region are the block's own. */
export interface ItemsRegionView {
    /** The count badge; null when there is none. */
    readonly count: string | null
    readonly rows: ReadonlyArray<DashboardRow>
    /** The link beside the rows, for instance "Open"; empty when the rows are not links. */
    readonly linkLabel: string
    readonly linkHref: string
    /** "N more", null when every row is shown. */
    readonly more: string | null
}

/** One connection bound to an agent. */
export interface ConnectionRow {
    readonly id: string
    readonly name: string
    readonly description: string
    readonly statusLabel: string
    readonly statusTone: BadgeTone
    readonly accessLabel: string
}

/** What the connections region shows once read. */
export interface ConnectionsRegionView {
    readonly manageLabel: string
    readonly manageHref: string
    readonly rows: ReadonlyArray<ConnectionRow>
}

/** One open knowledge gap. */
export interface KnowledgeGapRow {
    readonly id: string
    readonly title: string
    readonly description: string
    readonly asked: string
}

/** The open knowledge gaps of the agent. */
export interface KnowledgeGapsView {
    readonly label: string
    readonly count: string | null
    readonly openLabel: string
    readonly openHref: string
    readonly rows: ReadonlyArray<KnowledgeGapRow>
}

/** What the knowledge region shows once read. */
export interface KnowledgeRegionView {
    readonly openLabel: string
    readonly openHref: string
    readonly footer: string
    readonly publicTitle: string
    readonly publicDescription: string
    readonly internalTitle: string
    readonly internalDescription: string
    /** Null shows no gaps card. */
    readonly gaps: KnowledgeGapsView | null
}

/** The trace line under a row: the branch that decided it, with a link to the why when one is recorded. */
export interface TraceView {
    readonly line: string
    readonly whyHref: string | null
}

/** Atomic words and state of a row command. */
export interface CommandView {
    readonly id: string
    readonly label: string
    readonly isPending?: boolean | undefined
    readonly isDisabled?: boolean | undefined
    readonly disabledReason?: string | undefined
    readonly isDanger?: boolean | undefined
}

/** One state or age mark on a row. */
export interface BadgeView {
    readonly label: string
    readonly tone: BadgeTone
}

/** One decision waiting for a person, as a row draws it. */
export interface DecisionRowView {
    readonly id: string
    readonly title: string
    readonly description: string
    readonly badges: ReadonlyArray<BadgeView>
    readonly reason: string | null
    readonly amount: string | null
    readonly proposal: string
    readonly trace: TraceView | null
    readonly expiry: string | null
    readonly primary: CommandView | null
    readonly edit: CommandView | null
    readonly menu: ReadonlyArray<CommandView>
    readonly waitingFor: string | null
}

/** The decision queue once read. */
export interface DecisionQueueView {
    readonly count: string | null
    readonly more: { readonly label: string; readonly href: string } | null
    readonly rows: ReadonlyArray<DecisionRowView>
}

/** One step of the path a run walked. */
export interface PathStepView {
    readonly id: string
    readonly title: string
    readonly description: string
    readonly isCurrent: boolean
}

/** One fact the branch read. */
export interface FactView {
    readonly id: string
    readonly term: string
    readonly value: string
}

/** One source a decision leaned on. */
export interface SourceView {
    readonly id: string
    readonly kind: string
    readonly text: string
    readonly byline: string
}

/** Who approves and how much of the time is used. */
export interface ApproverView {
    readonly name: string
    readonly seed: string
    readonly limit: string
    readonly onTimeout: string
    /** 0 to 100. */
    readonly usedPercent: number
    readonly valueText: string
}

/** The why pane of one work item, every word resolved. */
export interface WhyView {
    readonly heading: string
    readonly branch: string
    readonly reason: string
    readonly path: ReadonlyArray<PathStepView>
    readonly facts: ReadonlyArray<FactView>
    readonly sources: ReadonlyArray<SourceView>
    readonly approver: ApproverView | null
    readonly mapHref: string
}
