import type { StepJson } from "./agent-runs.contracts"

/** A run as its table holds it: every column, the times as ISO text, `version` the fence of every write. */
export interface StoredRun {
    /** The run id. */
    readonly id: string
    /** The workspace. */
    readonly workspaceId: string
    /** The fence. */
    readonly version: string
    /** The agent. */
    readonly agentId: string
    /** The wake it answers. */
    readonly wakeId: string
    /** The trigger step of the graph. */
    readonly trigger: string
    /** The published graph version it runs on, or null. */
    readonly graphVersionId: string | null
    /** Whether a plan is bound. */
    readonly planning: boolean
    /** Where it stands, as stored. */
    readonly status: string
    /** The engine it is on, as stored. */
    readonly engine: string
    /** The trigger, intact. */
    readonly context: StepJson
    /** Why it stopped, or null. */
    readonly error: StepJson | null
    /** When a person was told, or null. */
    readonly deadLetteredAt: string | null
    /** The build it parked under, or null. */
    readonly parkedBuild: string | null
    /** Why it parked, or null. */
    readonly parkReason: string | null
    /** The times the machine resumed it. */
    readonly resumeAttempts: number
    /** The earliest the machine may resume it again, or null. */
    readonly resumeNotBefore: string | null
    /** When it was last resumed, or null. */
    readonly resumedAt: string | null
    /** Who resumed it, or null. */
    readonly resumedBy: string | null
    /** Why it was resumed, or null. */
    readonly resumeReason: string | null
    /** The work item it waits on, or null. */
    readonly waitWorkItemId: string | null
    /** The deadline of that wait, or null. */
    readonly waitDeadlineAt: string | null
    /** The steps written so far: the next ordinal. */
    readonly stepSeq: number
    /** When it started. */
    readonly startedAt: string
    /** When it ended or parked, or null. */
    readonly endedAt: string | null
    /** When it was cancelled, or null. */
    readonly cancelledAt: string | null
    /** Who cancelled it, or null. */
    readonly cancelledBy: string | null
    /** The workflow it executes, or null for the agent's own graph. */
    readonly workflowId: string | null
    /** The workflow version it executes, or null. */
    readonly workflowVersionId: string | null
    /** The number of that workflow version, or null. */
    readonly workflowVersion: number | null
    /** When the row was written. */
    readonly createdAt: string
    /** When the row last changed. */
    readonly updatedAt: string
}

/** The members of a run a write sets; an absent member is left as it is. */
export interface RunValues extends Partial<
    Omit<StoredRun, "id" | "workspaceId" | "version" | "createdAt" | "updatedAt">
> {}

/** A stored run, or null when there is none (or, under a fence, when the row moved on). */
export type OptionalStoredRun = StoredRun | null

/** A run as it is opened: what a wake names; every other member takes the value given or its default. */
export type RunInsert = Pick<StoredRun, "agentId" | "wakeId" | "trigger" | "graphVersionId" | "context"> &
    RunValues & {
        /** The run's subject (kind and id), written once with the row; absent for a run about no subject. */
        readonly subjectKind?: string | undefined
        /** The id of the subject within its kind, written with `subjectKind`. */
        readonly subjectId?: string | undefined
    }

/** A step as its table holds it: every column, the times as ISO text, `version` the fence of every write. */
export interface StoredStep {
    /** The step id. */
    readonly id: string
    /** The workspace. */
    readonly workspaceId: string
    /** The fence. */
    readonly version: string
    /** The run. */
    readonly runId: string
    /** The place in the run. */
    readonly ordinal: number
    /** Unique within the run. */
    readonly stepKey: string
    /** The node of the published graph. */
    readonly nodeKey: string
    /** The handler kind. */
    readonly kind: string
    /** What it does to the world, as stored. */
    readonly effect: StepJson
    /** All the step needs to run. */
    readonly input: StepJson
    /** The stored result, or null. */
    readonly result: StepJson | null
    /** Where it stands, as stored. */
    readonly status: string
    /** The tries made. */
    readonly attempt: number
    /** The tries it gets. */
    readonly maxAttempts: number
    /** How long one try may run, milliseconds, or null. */
    readonly deadlineMs: number | null
    /** The earliest the next try may start, or null. */
    readonly notBefore: string | null
    /** The work item it waits on, or null. */
    readonly waitItemId: string | null
    /** The work item it is about, or null. */
    readonly workItemId: string | null
    /** Why it last failed, or null. */
    readonly errorCode: string | null
    /** When the claim runs out, or null. */
    readonly claimedUntil: string | null
    /** When this try began, or null. */
    readonly startedAt: string | null
    /** When this try ended, or null. */
    readonly endedAt: string | null
    /** How long it took, milliseconds, or null. */
    readonly durationMs: number | null
    /** The door calls it made, `{ calls: [...] }`. */
    readonly doorCalls: StepJson
    /** The effect key it was sent under, or null. */
    readonly effectKey: string | null
    /** The error it stopped with, or null. */
    readonly error: StepJson | null
    /** When the row was written. */
    readonly createdAt: string
    /** When the row last changed. */
    readonly updatedAt: string
}

/** The members of a step a write sets; an absent member is left as it is. */
export interface StepValues extends Partial<
    Omit<StoredStep, "id" | "workspaceId" | "version" | "runId" | "stepKey" | "createdAt" | "updatedAt">
> {}

/** A stored step, or null when there is none (or, under a fence, when the row moved on). */
export type OptionalStoredStep = StoredStep | null

/** A step as it is first written: its run, its place and its key; every other member takes the value given or its default. */
export type StepInsert = Pick<StoredStep, "runId" | "ordinal" | "stepKey" | "nodeKey" | "kind" | "effect" | "input"> &
    StepValues

/** Which runs a list reads (every member that is named narrows it) and in which order. */
export interface RunListFilter {
    /** The runs of one agent. */
    readonly agentId?: string
    /** The runs among these ids. */
    readonly ids?: ReadonlyArray<string>
    /** The runs in these statuses. */
    readonly statuses?: ReadonlyArray<string>
    /** The runs on this engine. */
    readonly engine?: string
    /** The runs of this workflow. */
    readonly workflowId?: string
    /** The runs of this subject (exact, through the subject index). */
    readonly subject?: { readonly kind: string; readonly id: string } | undefined
    /** true: only the runs that carry a wait mark (`wait_match` set: parked at a `wait`, whatever their status). */
    readonly waitMarked?: true
    /**
     * The runs whose REPORTED status (`reportedStatusOf`: a `running` run with a wait mark reads `waiting`) is one of these: what a reader
     * that shows runs narrows by. Named with `statuses`, both hold.
     */
    readonly reported?: ReadonlyArray<string>
    /** `started`: newest start first; `ended`: newest end first; `resume`: earliest resume first. */
    readonly order: "started" | "ended" | "resume"
    /** How many runs of the order to pass over first (a page after the first). */
    readonly skip?: number
}

/** The wait a run parks on, as the keys an event finds it by (`wait_match`) and when it began waiting (`wait_since`, ISO). */
export interface RunWaitMark {
    /** The lookup keys of the wait (agent-threads/wait-match.policy.ts), at least one. */
    readonly match: ReadonlyArray<string>
    /** When the run parked on it (ISO). */
    readonly since: string
}

/** Which parked runs one event is asked of: the agents' runs whose wait keys the event's probe names (none is read by a page). */
export interface RunWaiterFilter {
    /** The runs of these agents (every agent the event reaches). */
    readonly agentIds: ReadonlyArray<string>
    /** The runs in these statuses. */
    readonly statuses: ReadonlyArray<string>
    /** The runs on this engine. */
    readonly engine: string
    /** The keys the event names exactly: a run holding one of them is asked. */
    readonly exact: ReadonlyArray<string>
    /** The `contains` markers the event names: a run holding one is asked when one of its parts lies in the event's text of that prefix. */
    readonly markers: ReadonlyArray<string>
    /** The event's texts by the key prefix of the parts they are searched for (`strpos`). */
    readonly texts: Readonly<Record<string, string>>
}

/** A run an event is asked of: its id, its trigger intact and when it began waiting. */
export interface StoredWaiter {
    /** The run. */
    readonly id: string
    /** The agent of the run. */
    readonly agentId: string
    /** The trigger, intact (it names the call that made the run, if one did). */
    readonly context: StepJson
    /** When it parked on its wait (ISO), or null. */
    readonly waitSince: string | null
}

/** A window of instants as ISO text: `from` inclusive, `to` exclusive. */
export interface RunWindow {
    /** The first instant in. */
    readonly from: string
    /** The first instant out. */
    readonly to: string
}

/** Which runs a count reads: every member that is named narrows it. */
export interface RunCountFilter {
    /** The runs of one agent. */
    readonly agentId?: string
    /** The runs in these statuses. */
    readonly statuses?: ReadonlyArray<string>
    /** true: only the runs that carry a wait mark (`wait_match` set), so a reader can report the ones parked at a `wait`. */
    readonly waitMarked?: true
    /** The runs that started in this window. */
    readonly started?: RunWindow
    /** The runs that ended in this window. */
    readonly ended?: RunWindow
}

/** How many runs of one agent stand in one status. */
export interface RunCount {
    /** The agent. */
    readonly agentId: string
    /** The status. */
    readonly status: string
    /** How many. */
    readonly count: number
}

/** How far the steps of one run have come. */
export interface StepCounts {
    /** The run. */
    readonly runId: string
    /** Every step. */
    readonly total: number
    /** The steps done. */
    readonly done: number
    /** The steps that have begun. */
    readonly begun: number
    /** The steps that failed. */
    readonly failed: number
}

/** A work item the steps of a run are about. */
export interface RunWorkItem {
    /** The run. */
    readonly runId: string
    /** The work item. */
    readonly workItemId: string
}

/** The workflow version a run executes, as the run open pins it. */
export interface RunPinValues {
    /** The workflow. */
    readonly workflowId: string
    /** The workflow version id. */
    readonly workflowVersionId: string
    /** The workflow version number. */
    readonly workflowVersion: number
}
