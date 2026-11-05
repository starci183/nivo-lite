import type { BadgeTone } from "@starci/grammar/common" with { "resolution-mode": "import" }

/** A recorded dashboard item linking to its existing subject. */
export interface DashboardRow {
    /** The key the list draws the row under; unique within its region. */
    readonly id: string
    /** The headline of the item. */
    readonly title: string
    /** The line of detail under the headline. */
    readonly description: string
    /** Where choosing the row goes: the page of its subject. */
    readonly href: string
}

/** What a region of finished or waiting items shows once read; the words of an empty region are the block's own. */
export interface ItemsRegionView {
    /** The count badge; null when there is none. */
    readonly count: string | null
    /** The items the region lists, already cut to the number it shows. */
    readonly rows: ReadonlyArray<DashboardRow>
    /** The link beside the rows, for instance "Open"; empty when the rows are not links. */
    readonly linkLabel: string
    /** Where the link beside the rows goes. */
    readonly linkHref: string
    /** "N more", null when every row is shown. */
    readonly more: string | null
}

/** One connection bound to an agent. */
export interface ConnectionRow {
    /** The key the list draws the connection under. */
    readonly id: string
    /** The name of the provider the agent acts through. */
    readonly name: string
    /** What the connection lets the agent do, in a line. */
    readonly description: string
    /** The words of its state, for instance "Connected". */
    readonly statusLabel: string
    /** The colour family of the state badge. */
    readonly statusTone: BadgeTone
    /** The words of what the agent may do through it, for instance "Read only". */
    readonly accessLabel: string
}

/** What the connections region shows once read. */
export interface ConnectionsRegionView {
    /** The words of the link to the page where connections are managed. */
    readonly manageLabel: string
    /** Where the manage link goes. */
    readonly manageHref: string
    /** The connections bound to the agent. */
    readonly rows: ReadonlyArray<ConnectionRow>
}

/** One open knowledge gap. */
export interface KnowledgeGapRow {
    /** The key the list draws the gap under. */
    readonly id: string
    /** The question the agent could not answer. */
    readonly title: string
    /** What the agent was asked when it met the gap. */
    readonly description: string
    /** When or how often the gap was met, in words. */
    readonly asked: string
}

/** The open knowledge gaps of the agent. */
export interface KnowledgeGapsView {
    /** The heading of the gaps card. */
    readonly label: string
    /** The count badge; null when there is none. */
    readonly count: string | null
    /** The words of the link that opens the gaps page. */
    readonly openLabel: string
    /** Where the open link goes. */
    readonly openHref: string
    /** The gaps the card lists. */
    readonly rows: ReadonlyArray<KnowledgeGapRow>
}

/** What the knowledge region shows once read. */
export interface KnowledgeRegionView {
    /** The words of the link that opens the knowledge page. */
    readonly openLabel: string
    /** Where the open link goes. */
    readonly openHref: string
    /** The line under the two parts, saying how the agent uses them. */
    readonly footer: string
    /** The heading of the part customers' turns may read. */
    readonly publicTitle: string
    /** What the public part holds, in a line. */
    readonly publicDescription: string
    /** The heading of the part only the business reads. */
    readonly internalTitle: string
    /** What the internal part holds, in a line. */
    readonly internalDescription: string
    /** Null shows no gaps card. */
    readonly gaps: KnowledgeGapsView | null
}

/** The trace line under a row: the branch that decided it, with a link to the why when one is recorded. */
export interface TraceView {
    /** The branch that decided the row, in words. */
    readonly line: string
    /** Where the why pane of the decision opens; null when none is recorded. */
    readonly whyHref: string | null
}

/** Atomic words and state of a row command. */
export interface CommandView {
    /** The command the host runs when the person chooses it. */
    readonly id: string
    /** The words on the control. */
    readonly label: string
    /** Whether the command is running now, which the control shows. */
    readonly isPending?: boolean | undefined
    /** Whether the person may not choose it now. */
    readonly isDisabled?: boolean | undefined
    /** Why it is disabled, shown to the person who asks. */
    readonly disabledReason?: string | undefined
    /** Whether choosing it cannot be taken back, which the control shows in the danger tone. */
    readonly isDanger?: boolean | undefined
    /** The look of the control when it is not a danger: the one that decides, an alternative, a dismissal or a plain one. */
    readonly intent?: "commit" | "alternative" | "dismiss" | "neutral" | undefined
}

/** One state or age mark on a row. */
export interface BadgeView {
    /** The words on the badge. */
    readonly label: string
    /** The colour family of the badge. */
    readonly tone: BadgeTone
}

/** One decision waiting for a person, as a row draws it. */
export interface DecisionRowView {
    /** The key the queue draws the decision under, and the record its commands act on. */
    readonly id: string
    /** The headline of the decision. */
    readonly title: string
    /** The line of detail under the headline. */
    readonly description: string
    /** The name whose initials lead the row (the agent that asked); absent draws no mark. */
    readonly leading?: string | undefined
    /** The state and age marks beside the headline. */
    readonly badges: ReadonlyArray<BadgeView>
    /** Why the agent stopped for a person; null when it gave none. */
    readonly reason: string | null
    /** The sum the decision is about, as words; null when it concerns none. */
    readonly amount: string | null
    /** What the agent proposes to do if the person agrees. */
    readonly proposal: string
    /** The branch that decided the row; null when none is recorded. */
    readonly trace: TraceView | null
    /** When the proposal lapses, as words; null when it does not. */
    readonly expiry: string | null
    /** The main command of the row; null when the viewer may run none. */
    readonly primary: CommandView | null
    /** The command that changes the proposal before it is run; null when the viewer may not. */
    readonly edit: CommandView | null
    /** The other commands, shown in the row's menu. */
    readonly menu: ReadonlyArray<CommandView>
    /** The values the edit form of the block starts from, by field name; absent starts every field empty. */
    readonly draft?: Readonly<Record<string, string | number | boolean | null>> | undefined
    /** The person the decision waits for when it is not the viewer; null otherwise. */
    readonly waitingFor: string | null
}

/** The decision queue once read. */
export interface DecisionQueueView {
    /** The count badge; null when there is none. */
    readonly count: string | null
    /** The link to the rest of the queue; null when every decision is shown. */
    readonly more: { readonly label: string; readonly href: string } | null
    /** The decisions the queue lists. */
    readonly rows: ReadonlyArray<DecisionRowView>
}

/** One step of the path a run walked. */
export interface PathStepView {
    /** The key the path draws the step under. */
    readonly id: string
    /** The name of the step. */
    readonly title: string
    /** What the step did, in a line. */
    readonly description: string
    /** Whether the run stands at this step now. */
    readonly isCurrent: boolean
}

/** One fact the branch read. */
export interface FactView {
    /** The key the list draws the fact under. */
    readonly id: string
    /** The name of the fact, for instance "Amount". */
    readonly term: string
    /** The value the branch read, as words. */
    readonly value: string
}

/** One source a decision leaned on. */
export interface SourceView {
    /** The key the list draws the source under. */
    readonly id: string
    /** What kind of source it is, for instance "Policy". */
    readonly kind: string
    /** The words of the source the decision cited. */
    readonly text: string
    /** Who wrote the source and when, in a line. */
    readonly byline: string
}

/** Who approves and how much of the time is used. */
export interface ApproverView {
    /** The name of the person who approves. */
    readonly name: string
    /** The text the avatar of the person is drawn from, so one person keeps one colour. */
    readonly seed: string
    /** The limit the approver may decide up to, as words. */
    readonly limit: string
    /** What happens when the approver does not answer in time, as words. */
    readonly onTimeout: string
    /** 0 to 100. */
    readonly usedPercent: number
    /** The words of the time used, read by a screen reader. */
    readonly valueText: string
}

/** The why pane of one work item, every word resolved. */
export interface WhyView {
    /** The heading of the pane. */
    readonly heading: string
    /** The branch that decided the item. */
    readonly branch: string
    /** The reason the branch gave. */
    readonly reason: string
    /** The steps the run walked to the item. */
    readonly path: ReadonlyArray<PathStepView>
    /** The facts the branch read. */
    readonly facts: ReadonlyArray<FactView>
    /** The sources the decision leaned on. */
    readonly sources: ReadonlyArray<SourceView>
    /** Who approves; null when no approval is asked. */
    readonly approver: ApproverView | null
    /** Where the map of the whole work graph opens at this item. */
    readonly mapHref: string
}
