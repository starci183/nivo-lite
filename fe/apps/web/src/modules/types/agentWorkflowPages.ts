import type { BadgeTone } from "@starci/grammar/common"

/** One chip on a row: a value bound at run time (pink, "= order.id") or a fixed one (grey). */
export interface WorkflowChipView {
    readonly label: string
    readonly isDynamic: boolean
}

/** One workflow as a row of the table of workflows. */
export interface WorkflowTableRowView {
    readonly id: string
    readonly href: string
    readonly name: string
    readonly provenance: string
    /** What starts it, as chips; empty while the list read does not carry the triggers. */
    readonly starts: ReadonlyArray<string>
    /** What it ends with and calls next, as chips; empty while the list read does not carry the outcomes. */
    readonly ends: ReadonlyArray<string>
    /** Who may call it; empty while the list read does not carry the entry rule. */
    readonly entry: string
    readonly versionLabel: string
    /** Runs of the last 7 days; null while the list read does not carry the count. */
    readonly runs7d: number | null
    readonly statusLabel: string
    readonly statusTone: BadgeTone
}

/** One row of a card of the overview: a title, one muted line, chips, and a note under them. */
export interface WorkflowOverviewRowView {
    readonly id: string
    readonly title: string
    readonly line: string
    readonly chips: ReadonlyArray<WorkflowChipView>
    readonly end: string
}

/** One required input of the workflow. */
export interface WorkflowInputView {
    readonly name: string
    readonly label: string
    readonly isRequired: boolean
}

/** One param a call hands over: its name, the value (pink when bound) and where it is taken from. */
export interface WorkflowCallParamView {
    readonly name: string
    readonly chip: WorkflowChipView
    readonly source: string
}

/** One call of another workflow with the params it hands over. */
export interface WorkflowCallView {
    readonly id: string
    readonly target: string
    readonly version: string
    readonly params: ReadonlyArray<WorkflowCallParamView>
}

/** The cards of the overview of a workflow. */
export interface WorkflowOverviewView {
    readonly triggers: ReadonlyArray<WorkflowOverviewRowView>
    readonly inputs: ReadonlyArray<WorkflowInputView>
    readonly entry: string
    readonly outcomes: ReadonlyArray<WorkflowOverviewRowView>
    readonly calls: ReadonlyArray<WorkflowCallView>
}
