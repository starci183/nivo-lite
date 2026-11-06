import type { EntityManager } from "typeorm"
import type {
    AgentRunStatus,
    AgentStepHandler,
    StepDecision,
    AgentStepStatus,
    StepEffect,
    StepJson,
    StepSpec,
    StepView,
} from "./agent-runs.contracts"

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

/** The run, or null when there is none. */
export type OptionalRunView = RunView | null

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
    { readonly kind: "claimed"; readonly step: StepView } | { readonly kind: "busy" | "closed" | "finished" }

/** The outcome of a commit: the step changed, or its fence had moved on and nothing changed. */
export type CommitResult = "ok" | "fenced"

/** The outcome of a compensation commit. */
export type CompensationCommit = CommitResult | "dead"

/** What the commit of a step writes. */
export type StepCommit =
    | {
          readonly kind: "done"
          readonly result: StepJson
          readonly next: ReadonlyArray<StepSpec>
          readonly continues?: boolean
      }
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
    /** Parked runs put back on their failed step. */
    readonly parked: number
}

/** What the graph's timeout did with a wait that ran out. */
export type WaitExpiry = { readonly kind: "renewed"; readonly deadlineAt: Date } | { readonly kind: "ended" }

/** What the engine asks of the graph: apply the timeout of the branch a work item waits on. The graph owns the answer; the engine writes no timeout. */
export interface AgentRunWaitTimeout {
    /** Applies the branch's timeout to the work item (a backup group, a stop, or silence) and says whether a new wait began. */
    expire(workItemId: string, manager?: EntityManager): Promise<WaitExpiry>
}

/** The verdicts already given on work items: the closed item is the durable record of a decision, so a wait is finished from it, never from the clock. */
export interface AgentRunItemVerdicts {
    /** Locks the work-item decision owner before applying a deadline policy in this transaction. */
    claimTimeout(manager: EntityManager, workspaceId: string, itemId: string): Promise<RunTimeoutClaim>
    /** The verdict of each item among `ids` that closed approved or rejected; an item still open has none. */
    verdictsOf(ids: ReadonlyArray<string>): Promise<ReadonlyMap<string, StepDecision>>
}

/** The owner's locked decision state before the clock can change a wait. */
export type RunTimeoutClaim =
    { readonly kind: "busy" } | { readonly kind: "open" } | { readonly kind: "closed"; readonly decision: StepDecision }

/** Who asks to run a parked run again and why; recorded on the run. */
export interface ResumeRequest {
    /** The workspace of the run. */
    readonly workspaceId: string
    /** The run. */
    readonly runId: string
    /** A member id for a person, `build` or `sweep` for the machine. */
    readonly actor: string
    /** The reason in a few words. */
    readonly reason: string
}

/** An owner's or manager's request to run a parked run again, as their door receives it. */
export interface OwnerResumeRequest {
    /** The Auth account asking. */
    readonly principalId: string
    /** The workspace the request is made in; the run must be one of its runs. */
    readonly workspaceId: string
    /** The run. */
    readonly runId: string
    /** Why, in a few words, kept on the run. */
    readonly reason: string
}

/** What the owner's door answers: "resumed" with the step the run goes on from, or why it was not resumed with no step. */
export interface OwnerResumeAnswer {
    /** "resumed", or not_found, compensated, not_parked, no_failed_step, exhausted or outcome_unknown. */
    readonly kind: ResumeResult["kind"]
    /** The step the run goes on from, when it was resumed. */
    readonly stepKey: string | null
}

/** What a resume did. */
export type ResumeResult =
    | { readonly kind: "resumed"; readonly stepKey: string; readonly workspaceId: string }
    | {
          readonly kind: "not_found" | "compensated" | "not_parked" | "no_failed_step" | "exhausted" | "outcome_unknown"
      }

/** What a pass over the parked runs did. */
export interface ParkedPassReport {
    /** The runs put back on their failed step. */
    readonly resumed: number
    /** The runs looked at. */
    readonly looked: number
}

/** The answer of the resume function, before the engine adds what it knows. */
export type ResumeAnswer =
    | {
          readonly kind: "resumed"
          readonly stepKey: string
          readonly workspaceId: string
          readonly errorCode: string | null
          readonly at: number
      }
    | { readonly kind: "not_found" | "compensated" | "not_parked" | "no_failed_step" | "exhausted" }

/** A parked run a pass may run again. */
export interface ParkedRef {
    /** The run. */
    readonly runId: string
    /** Its workspace. */
    readonly workspaceId: string
}

/** What the resume function is asked. */
export interface ResumeWrite {
    /** The workspace of the run. */
    readonly workspaceId: string
    /** The run. */
    readonly runId: string
    /** Who. */
    readonly actor: string
    /** Why. */
    readonly reason: string
    /** The failed step's new input, or absent to keep it. */
    readonly input?: StepJson | undefined
    /** Whether the machine asks (bounded) rather than a person. */
    readonly auto: boolean
    /** The most machine resumes of one run. */
    readonly max: number
    /** The first spacing between machine resumes, seconds; it doubles with each. */
    readonly backoffSeconds: number
}

/** Which parked runs a pass may take. */
export interface ParkedQuery {
    /** The workspace to look in. */
    readonly workspaceId: string
    /** The most runs. */
    readonly limit: number
    /** The running build. */
    readonly build: string
    /** Only runs parked under another build. */
    readonly byBuild: boolean
    /** How long a run has been parked, at least, seconds. */
    readonly minAgeSeconds: number
    /** The cap of machine resumes. */
    readonly max: number
    /** Failure codes that stay with a person. */
    readonly exclude: ReadonlyArray<string>
}
