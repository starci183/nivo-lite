import type { BadgeTone, FlowGraphEdge, FlowGraphLegendItem, FlowGraphNode, FlowGraphRunStatus } from "@starci/grammar/common"

/** Where a run stands as a person tells it. */
export type RunStatus = "queued" | "scheduled" | "running" | "waiting" | "done" | "failed" | "cancelled"

/** Where a step stands as a person tells it. */
export type RunStepStatus = "pending" | "running" | "waiting" | "done" | "failed"

/** The status tabs of the list: each stands for one or more statuses. */
export type RunTab = "all" | "running" | "queued" | "waiting" | "done" | "failed"

/** One workflow of the left pane. */
export interface RunWorkflowView {
    readonly key: string
    readonly label: string
    readonly count: number
}

/** One row of the table of runs. */
export interface RunRowView {
    readonly id: string
    readonly status: RunStatus
    readonly title: string
    /** "#4821": the short id the row is named by. */
    readonly idLabel: string
    /** The name of the workflow the run ran, without its version or source. */
    readonly workflowName: string
    /** When the run began, date and time. */
    readonly startedLabel: string
    /** The workflow the run ran, as the muted line under the title. */
    readonly workflowLabel: string
    /** Where the run stands: the step it is at, its place in the queue, or why it stopped. */
    readonly stepLine: string
    readonly durationLabel: string
    readonly statusLabel: string
    readonly statusTone: BadgeTone
    readonly href: string
}

/** One value of a filter and how many runs carry it. */
export interface RunChipView {
    readonly value: string
    readonly label: string
    readonly count: number
}

/** The filters of the list. */
export interface RunsFilter {
    readonly workflow: string
    readonly tab: RunTab
    readonly source: string
    readonly query: string
}

/** The list of runs as the page draws it. */
export interface RunsView {
    readonly workflows: ReadonlyArray<RunWorkflowView>
    readonly rows: ReadonlyArray<RunRowView>
    readonly tabs: ReadonlyArray<RunChipView>
    readonly sources: ReadonlyArray<RunChipView>
    /** "2 running, 1 queued": the head line of the table card. */
    readonly headLine: string
    /** The name of the table card: the list and the workflow it is narrowed to. */
    readonly title: string
    readonly isFiltered: boolean
    /** How many runs the agent has, before any filter: the chip beside the title. */
    readonly total?: number
}

/** One step of the left pane of a run. */
export interface RunStepView {
    readonly id: string
    readonly nodeKey: string
    readonly label: string
    readonly status: RunStepStatus
    readonly statusLabel: string
    readonly durationLabel: string
    /** The step belongs to a group (a sub-flow) and is drawn indented. */
    readonly isNested: boolean
    /** What the step came to, in one plain line under its title. */
    readonly result: string
}

/** One plain fact of a step. */
export interface RunFactView {
    readonly key: string
    readonly value: string
}

/** One row of a list of the selected step: a plain label and its value, and where it leads when it is a link. */
export interface RunFieldView {
    readonly id: string
    readonly term: string
    readonly value: string
    /** Where the value leads, or empty for plain text. */
    readonly href: string
}

/** One line of the log of a step: a door call and how it ended. */
export interface RunLogLineView {
    readonly id: string
    readonly text: string
    readonly isFailure: boolean
}

/** One param of the selected step in this run: its name, the value it resolved to and where that came from. */
export interface RunParamView {
    readonly id: string
    /** The field in plain words. */
    readonly name: string
    /** The value it resolved to, as text; masked when it is a secret or personal data. */
    readonly value: string
    /** Where the value came from: a ref as written ("= trigger.leadId", "= steps.order.output.orderNo"), or empty for a fixed value. */
    readonly source: string
    /** The value is a secret or personal data and is shown masked. */
    readonly isMasked: boolean
    /** The ref found nothing and the param has no default. */
    readonly isMissing: boolean
    /** The id behind a value that names an entity (a customer, an order): shown only on hover; empty otherwise. */
    readonly raw: string
    /** Where the entity opens, or empty. */
    readonly href: string
}

/** One way out of the selected step and whether this run took it. */
export interface RunBranchView {
    readonly id: string
    /** The name of the way out (success, failure, a condition's answer). */
    readonly label: string
    /** The step it leads to. */
    readonly target: string
    readonly isTaken: boolean
}

/** The selected step as the aside draws it: how it went, the params it ran with, what it made and the way out it took. */
export interface RunStepDetailView {
    readonly id: string
    readonly title: string
    /** What kind of step it is (an action, an AI step, a wait). */
    readonly kindLabel: string
    readonly status: RunStepStatus
    readonly statusLabel: string
    readonly statusTone: BadgeTone
    /** When it began and ended, as a clock; empty when it has not. */
    readonly startedLabel: string
    readonly endedLabel: string
    /** The business failure of a failed step, code and words ("handler_threw: ..."), or empty. */
    readonly error: string
    /** The attempt line ("try 2 of 3"), or empty for a step that has not begun. */
    readonly attemptLabel: string
    /** The params the step ran with in this run. */
    readonly inputs: ReadonlyArray<RunParamView>
    /** What the step made. */
    readonly outputs: ReadonlyArray<RunParamView>
    /** The ways out of the step; the one this run took is marked. */
    readonly branches: ReadonlyArray<RunBranchView>
    /** The line under the branches: which one the run took and why it ended there. */
    readonly branchNote: string
    /** The pictures the step sent the customer. */
    readonly sent: ReadonlyArray<string>
    /** The door calls of the step, folded by default. */
    readonly log: ReadonlyArray<RunLogLineView>
    /** Where a person decides a waiting step, or empty. */
    readonly decideHref: string
}

/** The head card of a run. */
export interface RunHeadView {
    readonly id: string
    readonly title: string
    readonly shortId: string
    readonly status: RunStatus
    readonly statusLabel: string
    readonly statusTone: BadgeTone
    readonly meta: string
    /** The name of the workflow the run ran, or empty. */
    readonly workflowName: string
    /** The title of the map card ("Workflow · name"), or empty for a run with no workflow. */
    readonly canvasTitle: string
    /** How many steps the workflow has. */
    readonly stepCount: number
    /** The version of the workflow the run ran, as the chip says it ("Version 3"), or empty. */
    readonly versionLabel: string
    /** Where the workflow opens, or empty for a run with none. */
    readonly workflowHref: string
    readonly canResume: boolean
    /** Another command of the page is the one primary (a decision the run waits on): the retry is then a neutral button. */
    readonly isRetryNeutral: boolean
    /** The run is queued, running or waiting and a person may stop it. */
    readonly canCancel: boolean
}

/** One cell of the summary of a run. */
export interface RunFigureView {
    readonly id: string
    readonly term: string
    readonly value: string
    readonly tone?: BadgeTone
    /** Where the figure leads, or empty. */
    readonly href: string
}

/** A run that is running now, for the quick switch of the head. */
export interface RunSwitchView {
    readonly id: string
    readonly label: string
    readonly href: string
}

/** One node of the graph a run is drawn on: its title and shape, its group, and where it goes next. */
export interface RunGraphNode {
    readonly key: string
    readonly title: string
    readonly kind: "trigger" | "execute" | "condition" | "output"
    readonly shape: "rect" | "round" | "diamond" | "stadium"
    /** The sub-flow the node belongs to, or empty. */
    readonly group: string
    readonly next: ReadonlyArray<string>
    /** What follows each answer of a condition. */
    readonly routes: ReadonlyArray<{ readonly label: string; readonly target: string }>
    /** The params of the node as written in the workflow: fixed values and refs (`{ $ref }`), the settings and the input bindings together. */
    readonly bindings: Readonly<Record<string, unknown>>
}

/** One entry of the key under the map of a run. */
export interface RunLegendItem {
    readonly id: string
    readonly label: string
    readonly tone: BadgeTone
}

/** The map of a run as the card map draws it (`FlowGraph layout="steps"`), with the run overlay. */
export interface RunCanvasView {
    readonly nodes: ReadonlyArray<FlowGraphNode>
    readonly edges: ReadonlyArray<FlowGraphEdge>
    /** The kind legend under the cards. */
    readonly kinds: ReadonlyArray<FlowGraphLegendItem>
    /** The words of the run statuses the cards' accessible names say. */
    readonly statusLabels: Readonly<Record<FlowGraphRunStatus, string>>
    /** The key of the run statuses under the map. */
    readonly legend: ReadonlyArray<RunLegendItem>
    readonly selectedId: string | null
}

/** The decision a run waits on, as the card of the page asks it. */
export interface RunDecisionView {
    /** What is decided. */
    readonly title: string
    /** The positive answer: approve, or retry for work that only wants another try. */
    readonly positive: "approve" | "retry"
}

/** What the page of a run draws. */
export interface RunDetailView {
    readonly head: RunHeadView
    readonly figures: ReadonlyArray<RunFigureView>
    readonly steps: ReadonlyArray<RunStepView>
    readonly canvas: RunCanvasView
    readonly selected: RunStepDetailView | null
    /** The decision the run waits on, or null when it waits on none. */
    readonly decision: RunDecisionView | null
    /** The other runs that are running now, for the quick switch of the head. */
    readonly switches: ReadonlyArray<RunSwitchView>
    /** The node the page selects: the one the person chose, else the step that needs them. */
    readonly selectedKey: string
}

/** The words of the table card of runs. */
export interface RunsTableCopy {
    readonly statusFilter: string
    readonly searchLabel: string
    readonly searchPlaceholder: string
    readonly searchClear: string
    readonly sourceFilter: string
    readonly workflowFilter: string
    readonly run: string
    readonly workflow: string
    readonly started: string
    readonly duration: string
    readonly result: string
    readonly empty: string
    readonly emptyFiltered: string
    readonly pagerLabel: string
    readonly previous: string
    readonly next: string
    readonly pageLabel: (page: number) => string
    readonly summary: (from: number, to: number, total: number) => string
}
