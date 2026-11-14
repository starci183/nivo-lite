import type { AgentRunQuery, AgentRunsQuery } from "@/modules/api"

/** The workflow a run is pinned to: its name, which the pin read adds to the row the runs query answers. */
interface PinnedName {
    readonly workflowName?: string | null | undefined
}

/** The runs of an agent as the back end answers them, each workflow of the rail and each run carrying the name of its real workflow. */
export type AgentRunsWire = Omit<AgentRunsQuery["agentRuns"], "runs" | "workflows"> & {
    readonly runs: ReadonlyArray<AgentRunsQuery["agentRuns"]["runs"][number] & PinnedName>
    readonly workflows: ReadonlyArray<AgentRunsQuery["agentRuns"]["workflows"][number] & { readonly name?: string | null | undefined }>
}

/** One run of the list as the back end answers it. */
export type AgentRunRowWire = AgentRunsWire["runs"][number]

/** One run with its steps as the back end answers it. */
export type AgentRunWire = Omit<NonNullable<AgentRunQuery["agentRun"]>, "row"> & {
    readonly row: NonNullable<AgentRunQuery["agentRun"]>["row"] & PinnedName
}

/** One step of a run as the back end answers it. */
export type AgentRunStepWire = AgentRunWire["steps"][number]

/** What woke a run. */
export type RunSource = "customer" | "schedule" | "event" | "agent" | "person"

/** The translator of the words of the runs: a key and the values it embeds. */
export type RunWords = (key: string, values?: Readonly<Record<string, string | number>>) => string

/** What the views need beyond the wire: the words, and the clock of a moment and of a length of time. */
export interface RunContext {
    readonly t: RunWords
    readonly has: (key: string) => boolean
    readonly timeOf: (iso: string) => string
    /** The clock of a moment to the second. */
    readonly clockOf: (iso: string) => string
    /** Where the run opens, for a run id. */
    readonly hrefOf: (runId: string) => string
    /** Where the chat of the agent opens, for the customer and the conversation a run was woken by. */
    readonly chatHref?: string
    /** The words and the place of an entity a value names by its id (a customer, an order, a conversation), or null when this read does not know it. */
    readonly entityOf?: (key: string, value: string) => { readonly label: string; readonly href: string } | null
}
export type {
    RunBranchView,
    RunChipView,
    RunDecisionView,
    RunFigureView,
    RunHeadView,
    RunLogLineView,
    RunParamView,
    RunRowView,
    RunStatus,
    RunStepDetailView,
    RunStepStatus,
    RunStepView,
    RunSwitchView,
    RunTab,
    RunWorkflowView,
    RunsFilter,
    RunsView,
} from "@/modules/types"
