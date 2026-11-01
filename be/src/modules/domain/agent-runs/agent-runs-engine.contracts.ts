import type { AgentRunStatus, AgentStepHandler, StepDecision, AgentStepStatus, StepEffect, StepJson, StepSpec, StepView } from "./agent-runs.contracts"

/** One run as the engine and the trace read it. */
export interface RunView {
    /** The run. */
    readonly id: string
    /** The workspace. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
    /** The wake it answers. */
    readonly wakeId: string
    /** The trigger step of the graph. */
    readonly trigger: string
    /** The published version it runs on, or null. */
    readonly versionId: string | null
    /** Where it stands. */
    readonly status: AgentRunStatus
    /** The trigger, intact. */
    readonly context: StepJson
    /** Why it stopped, or null. */
    readonly errorCode: string | null
    /** Whether a person was told it stopped. */
    readonly spoken: boolean
}

/** The run a write names, with its workspace for the job's limit. */
export interface RunRef {
    /** The run. */
    readonly runId: string
    /** The workspace. */
    readonly workspaceId: string
}

/** What an inline step answers the turn that called it: its stored result, or `waiting` and the work item it waits on. */
export interface InlineResult {
    /** The fields of the result. */
    readonly [key: string]: unknown
}

/** The move of a run from the status it was read in to the one a policy chose. */
export interface RouteMove {
    /** The status the caller read. */
    readonly from: string
    /** The status it chose. */
    readonly to: string
    /** Why. */
    readonly code: string
    /** The done steps to undo, last first. */
    readonly compensate: ReadonlyArray<string>
}

/** The handler of a step kind, or undefined while no capability registered one. */
export type OptionalAgentStepHandler = AgentStepHandler | undefined

/** The trace of a run, or null when the wake wrote none. */
export type OptionalRunTrace = RunTrace | null

/** What a claim answered. */
export type ClaimResult =
    | { readonly kind: "claimed"; readonly step: StepView }
    | { readonly kind: "done"; readonly answer: StepJson | null }
    | { readonly kind: "exhausted"; readonly step: StepView }
    | { readonly kind: "waiting_expired"; readonly step: StepView }
    | { readonly kind: "later"; readonly retryAfterMs: number }
    | { readonly kind: "busy" | "closed" | "idle" | "gone" }

/** What finishes a wait step: its result and the steps that follow. */
export interface WaitAnswer {
    /** What the step stores as its result. */
    readonly result: StepJson
    /** The steps that follow, written with it. */
    readonly next: ReadonlyArray<StepSpec>
}

/** How one try of a step ended, for the caller that drove it. */
export type StepEnd =
    | { readonly kind: "done"; readonly result: StepJson }
    | { readonly kind: "wait"; readonly workItemId: string }
    | { readonly kind: "failed"; readonly code: string }
    | { readonly kind: "fenced" }

/** Where an advance left the run: the run, and how long until a step that is not ready may run, or null. */
export interface RunAdvance {
    /** The run as it stands, or null when it is gone. */
    readonly run: RunView | null
    /** Milliseconds until a step held by its backoff may run, or null when nothing is held. */
    readonly retryAfterMs: number | null
}

/** What a compensation claim answered. */
export type CompensationClaim =
    | { readonly kind: "claimed"; readonly step: StepView }
    | { readonly kind: "busy" | "closed" | "finished" }

/** The outcome of a commit: the step changed, or its fence had moved on and nothing changed. */
export type CommitResult = "ok" | "fenced"

/** The outcome of a compensation commit. */
export type CompensationCommit = CommitResult | "dead"

/** What the commit of a step writes. */
export type StepCommit =
    | { readonly kind: "done"; readonly result: StepJson; readonly next: ReadonlyArray<StepSpec> }
    | { readonly kind: "wait"; readonly workItemId: string; readonly deadlineAt: Date }
    | { readonly kind: "retry"; readonly code: string; readonly afterMs: number }
    | { readonly kind: "failed"; readonly code: string }

/** The step a run row lists, in order, for the trace. */
export interface RunStepView {
    /** The step. */
    readonly stepKey: string
    /** The node of the published graph. */
    readonly nodeKey: string
    /** The handler kind. */
    readonly kind: string
    /** The place in the run. */
    readonly seq: number
    /** Where it stands. */
    readonly status: AgentStepStatus
    /** What it does to the world. */
    readonly effect: StepEffect
    /** The tries made. */
    readonly attempt: number
    /** Why it last failed, or null. */
    readonly errorCode: string | null
    /** The stored result, or null. */
    readonly result: StepJson | null
    /** The work item it waits on, or null. */
    readonly waitItemId: string | null
    /** The fence of its last claim. */
    readonly fence: number
}

/** A run with its steps, for the trace. */
export interface RunTrace {
    /** The run. */
    readonly run: RunView
    /** Its steps, in order. */
    readonly steps: ReadonlyArray<RunStepView>
}

/** One thing the sweep found. */
export interface RunDue {
    /** `expired` (a claim ran out), `ready` (a step nobody picked up), `compensating` (a compensation to continue) or `unspoken` (a stopped run nobody was told of). */
    readonly kind: "expired" | "ready" | "compensating" | "unspoken"
    /** The run. */
    readonly runId: string
    /** The workspace. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
    /** The step, or the empty text for a run. */
    readonly stepKey: string
    /** The fence the step had when it was found. */
    readonly fence: number
    /** The moment that made it due. */
    readonly at: Date
}

/** What one sweep pass did. */
export interface RunSweepReport {
    /** Steps resumed, retried or stopped after a claim ran out. */
    readonly expired: number
    /** Ready steps driven. */
    readonly ready: number
    /** Compensations continued. */
    readonly compensating: number
    /** Stopped runs a person was told about. */
    readonly unspoken: number
    /** Waits whose work item had already closed by a decision, finished with that decision. */
    readonly recovered: number
}

/** What the graph's timeout did with a wait that ran out. */
export type WaitExpiry =
    | { readonly kind: "renewed"; readonly deadlineAt: Date }
    | { readonly kind: "ended" }

/** What the engine asks of the graph: apply the timeout of the branch a work item waits on. The graph owns the answer; the engine writes no timeout. */
export interface AgentRunWaitTimeout {
    /** Applies the branch's timeout to the work item (a backup group, a stop, or silence) and says whether a new wait began. */
    expire(workItemId: string): Promise<WaitExpiry>
}

/** The verdicts already given on work items: the closed item is the durable record of a decision, so a wait is finished from it, never from the clock. */
export interface AgentRunItemVerdicts {
    /** The verdict of each item among `ids` that closed approved or rejected; an item still open has none. */
    verdictsOf(ids: ReadonlyArray<string>): Promise<ReadonlyMap<string, StepDecision>>
}
