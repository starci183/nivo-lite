/** What the runs of one agent instance take. */
export interface ReadAgentRunsRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their role. */
    readonly workspaceId: string
    /** The agent instance the runs are about. */
    readonly installationId: string
}

/** What one run of an agent instance takes. */
export interface ReadAgentRunRequest extends ReadAgentRunsRequest {
    /** The run. */
    readonly runId: string
}

/**
 * Where a run stands as a person tells it: `queued` and `scheduled` have not begun a step (a scheduled one was woken by the clock), `waiting`
 * holds for a person, `failed` stopped on a step and may be run again from it, `cancelled` was stopped by an owner or manager.
 */
export type RunBoardStatus = "queued" | "scheduled" | "running" | "waiting" | "done" | "failed" | "cancelled"

/** What woke the run. */
export type RunSource = "customer" | "schedule" | "event" | "agent" | "person"

/** One run as the list draws it. */
export interface AgentRunRow {
    /** The run. */
    readonly id: string
    /** Where it stands. */
    readonly status: RunBoardStatus
    /** What woke it. */
    readonly source: RunSource
    /** What it was about (the work item's sentence), or empty when it has none. */
    readonly title: string
    /** The workflow it ran: the graph version it was opened on, or `none`. */
    readonly workflowKey: string
    /** The number of that graph version, or null when the run had no graph. */
    readonly versionNumber: number | null
    /** When it started, ISO 8601. */
    readonly startedAt: string
    /** When it ended, ISO 8601, or null while it has not. */
    readonly endedAt: string | null
    /** How long it took, or has taken so far, milliseconds. */
    readonly durationMs: number
    /** The steps written so far. */
    readonly stepTotal: number
    /** The step it stands on, from one: the first that is not done, or the last when all are. */
    readonly stepNumber: number
    /** Its place in the queue, from one, for a run that has not begun; null otherwise. */
    readonly queuePosition: number | null
    /** Why it stopped, or null. */
    readonly errorCode: string | null
    /** The work item it is about, or null. */
    readonly workItemId: string | null
    /** The credits its model calls consumed, whole credits; 0 when it made none. */
    readonly creditsUsed: number
    /** When an owner or manager cancelled it, ISO 8601, or null. */
    readonly cancelledAt: string | null
}

/** One workflow of the agent with how many runs it has. */
export interface AgentRunWorkflow {
    /** The graph version id, or `none`. */
    readonly key: string
    /** The number of the version, or null. */
    readonly versionNumber: number | null
    /** The runs of it in the list. */
    readonly count: number
}

/** The runs of one agent: the list, the workflows to filter it by, and what is running and queued now. */
export interface AgentRunsBoard {
    /** The newest runs, newest first. */
    readonly runs: ReadonlyArray<AgentRunRow>
    /** The workflows the runs ran, the newest version first. */
    readonly workflows: ReadonlyArray<AgentRunWorkflow>
    /** The runs that are being driven now. */
    readonly runningCount: number
    /** The runs that wait for a place. */
    readonly queuedCount: number
    /** How many runs one process drives at once: the setting of the app, 4 by default. */
    readonly concurrencyLimit: number
    /** The runs using a place now: running and not waiting on a person. */
    readonly activeCount: number
}

/** Where a step stands as a person tells it. */
export type RunStepStatus = "pending" | "running" | "waiting" | "done" | "failed" | "undone"

/** One plain fact of what a step was given or stored. */
export interface AgentRunFact {
    /** What it is. */
    readonly key: string
    /** Its value, as text. */
    readonly value: string
}

/** One door call a step made. */
export interface AgentRunCall {
    /** The tool. */
    readonly tool: string
    /** Whether it worked. */
    readonly ok: boolean
    /** Why it failed, or null. */
    readonly failure: string | null
}

/** One step of a run. */
export interface AgentRunStepLine {
    /** Unique within the run. */
    readonly stepKey: string
    /** The node of the graph it is. */
    readonly nodeKey: string
    /** The place in the run, from one. */
    readonly ordinal: number
    /** Where it stands. */
    readonly status: RunStepStatus
    /** The tries made. */
    readonly attempt: number
    /** The tries it gets. */
    readonly maxAttempts: number
    /** When it began, ISO 8601, or null. */
    readonly startedAt: string | null
    /** How long it took, milliseconds, or null. */
    readonly durationMs: number | null
    /** Why it last failed, or null. */
    readonly errorCode: string | null
    /** The work item it waits on or is about, or null. */
    readonly workItemId: string | null
    /** What it was given. */
    readonly input: ReadonlyArray<AgentRunFact>
    /** What it stored. */
    readonly output: ReadonlyArray<AgentRunFact>
    /** The door calls it made. */
    readonly calls: ReadonlyArray<AgentRunCall>
}

/** The work item a run is about, as the step detail shows it. */
export interface AgentRunItem {
    /** The work item. */
    readonly id: string
    /** Its action key. */
    readonly action: string
    /** What it proposes, or did. */
    readonly summary: string
    /** Where it stands: `queued`, `waiting_decision`, `done`, `rejected` or `failed`. */
    readonly status: string
    /** Why the gate asked a person, or null. */
    readonly reason: string | null
    /** What the proposal carried as evidence. */
    readonly evidence: ReadonlyArray<AgentRunFact>
    /** The failure, or null. */
    readonly error: string | null
}

/** What a person may answer a waiting decision: approve it, retry it (an item that only wants another try) or refuse it. */
export type AgentRunDecisionOption = "approve" | "retry" | "reject"

/** The decision a run waits on, as the run page lets the owner answer it in place. */
export interface AgentRunDecision {
    /** The decision to answer: the open request of the approval road when there is one, else the work item. */
    readonly decisionId: string
    /** The work item that waits. */
    readonly workItemId: string
    /** The step that waits on it, or null when the run is only about the item. */
    readonly stepKey: string | null
    /** What is decided, in one sentence. */
    readonly title: string
    /** The answers offered, the one that goes on first. */
    readonly options: ReadonlyArray<AgentRunDecisionOption>
}

/** One run with its steps and the work item it is about. */
export interface AgentRunDetail {
    /** The run as the list draws it. */
    readonly row: AgentRunRow
    /** The steps in order. */
    readonly steps: ReadonlyArray<AgentRunStepLine>
    /** The work item the run is about, or null. */
    readonly item: AgentRunItem | null
    /** Whether the run stopped on a failed step and may be run again from it. */
    readonly canResume: boolean
    /** Whether the run is queued, running or waiting and so may be cancelled. */
    readonly canCancel: boolean
    /** The decision the run waits on, or null when it waits on none. */
    readonly decision: AgentRunDecision | null
}
