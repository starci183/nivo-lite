import type { BadgeTone } from "@starci/grammar/common" with { "resolution-mode": "import" }

/** A recorded dashboard item linking to its existing subject. */
export interface DashboardRow {
    /** The id the row is told apart by. */
    readonly id: string
    /** The headline of the row. */
    readonly title: string
    /** The line of words under the headline. */
    readonly description: string
    /** Where the row leads. */
    readonly href: string
}

/** What a region of finished or waiting items shows once read; the words of an empty region are the block's own. */
export interface ItemsRegionView {
    /** The count badge; null when there is none. */
    readonly count: string | null
    /** The rows to draw, in order. */
    readonly rows: ReadonlyArray<DashboardRow>
    /** The link beside the rows, for instance "Open"; empty when the rows are not links. */
    readonly linkLabel: string
    /** Where the link leads; empty when the rows are not links. */
    readonly linkHref: string
    /** "N more", null when every row is shown. */
    readonly more: string | null
}

/** One connection bound to an agent. */
export interface ConnectionRow {
    /** The id the row is told apart by. */
    readonly id: string
    /** The name of the subject. */
    readonly name: string
    /** The line of words under the headline. */
    readonly description: string
    /** The words of the connection state. */
    readonly statusLabel: string
    /** The tone of the state mark. */
    readonly statusTone: BadgeTone
    /** The words that say what the agent may do through the connection. */
    readonly accessLabel: string
}

/** What the connections region shows once read. */
export interface ConnectionsRegionView {
    /** The words of the link to manage the connections. */
    readonly manageLabel: string
    /** Where the manage link leads. */
    readonly manageHref: string
    /** The rows to draw, in order. */
    readonly rows: ReadonlyArray<ConnectionRow>
}

/** One open knowledge gap. */
export interface KnowledgeGapRow {
    /** The id the row is told apart by. */
    readonly id: string
    /** The headline of the row. */
    readonly title: string
    /** The line of words under the headline. */
    readonly description: string
    /** How often or when the question was asked. */
    readonly asked: string
}

/** The open knowledge gaps of the agent. */
export interface KnowledgeGapsView {
    /** The words the reader sees. */
    readonly label: string
    /** The count badge; null when there is none. */
    readonly count: string | null
    /** The words of the link that opens the whole list. */
    readonly openLabel: string
    /** Where the open link leads. */
    readonly openHref: string
    /** The rows to draw, in order. */
    readonly rows: ReadonlyArray<KnowledgeGapRow>
}

/** What the knowledge region shows once read. */
export interface KnowledgeRegionView {
    /** The words of the link that opens the whole list. */
    readonly openLabel: string
    /** Where the open link leads. */
    readonly openHref: string
    /** The closing line of the region. */
    readonly footer: string
    /** The headline of the public knowledge card. */
    readonly publicTitle: string
    /** The line under the public knowledge headline. */
    readonly publicDescription: string
    /** The headline of the internal knowledge card. */
    readonly internalTitle: string
    /** The line under the internal knowledge headline. */
    readonly internalDescription: string
    /** Null shows no gaps card. */
    readonly gaps: KnowledgeGapsView | null
}

/** The trace line under a row: the branch that decided it, with a link to the why when one is recorded. */
export interface TraceView {
    /** The words of the trace. */
    readonly line: string
    /** Where the why of the decision is shown; null when none is recorded. */
    readonly whyHref: string | null
}

/** Atomic words and state of a row command. */
export interface CommandView {
    /** The id the row is told apart by. */
    readonly id: string
    /** The words the reader sees. */
    readonly label: string
    /** True while the command runs. */
    readonly isPending?: boolean | undefined
    /** True when the command cannot be run now. */
    readonly isDisabled?: boolean | undefined
    /** Why the command cannot be run now. */
    readonly disabledReason?: string | undefined
    /** True when the command is drawn as a risk. */
    readonly isDanger?: boolean | undefined
}

/** One state or age mark on a row. */
export interface BadgeView {
    /** The words the reader sees. */
    readonly label: string
    /** The tone of the mark. */
    readonly tone: BadgeTone
}

/** One decision waiting for a person, as a row draws it. */
export interface DecisionRowView {
    /** The id the row is told apart by. */
    readonly id: string
    /** The headline of the row. */
    readonly title: string
    /** The line of words under the headline. */
    readonly description: string
    /** The state and age marks of the row. */
    readonly badges: ReadonlyArray<BadgeView>
    /** Why the decision waits for a person; null when no reason is recorded. */
    readonly reason: string | null
    /** The amount at stake as written; null when there is none. */
    readonly amount: string | null
    /** What the agent proposes to do. */
    readonly proposal: string
    /** The branch that decided the row; null when none is recorded. */
    readonly trace: TraceView | null
    /** When the decision lapses; null when it does not. */
    readonly expiry: string | null
    /** The command a person is most likely to run; null when there is none. */
    readonly primary: CommandView | null
    /** The command that edits the proposal; null when it cannot be edited. */
    readonly edit: CommandView | null
    /** The commands under the more menu. */
    readonly menu: ReadonlyArray<CommandView>
    /** Who or what the row waits for; null when nothing. */
    readonly waitingFor: string | null
}

/** The decision queue once read. */
export interface DecisionQueueView {
    /** The count badge; null when there is none. */
    readonly count: string | null
    /** The link that opens the rows not shown; null when every row is shown. */
    readonly more: { readonly label: string; readonly href: string } | null
    /** The rows to draw, in order. */
    readonly rows: ReadonlyArray<DecisionRowView>
}

/** One step of the path a run walked. */
export interface PathStepView {
    /** The id the row is told apart by. */
    readonly id: string
    /** The headline of the row. */
    readonly title: string
    /** The line of words under the headline. */
    readonly description: string
    /** True for the step the run is at. */
    readonly isCurrent: boolean
}

/** One fact the branch read. */
export interface FactView {
    /** The id the row is told apart by. */
    readonly id: string
    /** The name of the fact. */
    readonly term: string
    /** The value of the fact as written. */
    readonly value: string
}

/** One source a decision leaned on. */
export interface SourceView {
    /** The id the row is told apart by. */
    readonly id: string
    /** The kind of the source. */
    readonly kind: string
    /** The words of the source. */
    readonly text: string
    /** Who or what the source came from. */
    readonly byline: string
}

/** Who approves and how much of the time is used. */
export interface ApproverView {
    /** The name of the subject. */
    readonly name: string
    /** What the avatar of the approver is drawn from. */
    readonly seed: string
    /** The time limit as written. */
    readonly limit: string
    /** What happens when the limit passes. */
    readonly onTimeout: string
    /** 0 to 100. */
    readonly usedPercent: number
    /** The used share as written for a screen reader. */
    readonly valueText: string
}

/** The why pane of one work item, every word resolved. */
export interface WhyView {
    /** The headline of the pane. */
    readonly heading: string
    /** The branch the run took. */
    readonly branch: string
    /** Why the decision waits for a person; null when no reason is recorded. */
    readonly reason: string
    /** The steps the run walked, in order. */
    readonly path: ReadonlyArray<PathStepView>
    /** The facts the branch read. */
    readonly facts: ReadonlyArray<FactView>
    /** The sources the decision leaned on. */
    readonly sources: ReadonlyArray<SourceView>
    /** Who approves; null when no one does. */
    readonly approver: ApproverView | null
    /** Where the run is shown on the map. */
    readonly mapHref: string
}
