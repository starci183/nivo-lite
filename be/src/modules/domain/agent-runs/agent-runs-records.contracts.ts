import type { AgentRunStatus, AgentStepStatus, StepEffect, StepJson } from "./agent-runs.contracts"

/** A run record as the engine returns it, its declared fields read. */
export interface RunRecord {
    /** The record id, which is the run id. */
    readonly id: string
    /** The workspace. */
    readonly workspaceId: string
    /** The record version: the fence of every write to the run. */
    readonly version: string
    /** The agent. */
    readonly agentId: string
    /** The wake it answers. */
    readonly wakeId: string
    /** The trigger step of the graph. */
    readonly trigger: string
    /** The published version it runs on, or null. */
    readonly graphVersionId: string | null
    /** Whether a plan is bound. */
    readonly planning: boolean
    /** Where it stands. */
    readonly status: AgentRunStatus
    /**
     * The engine the run started on: `legacy` (the old step engine) or `langgraph` (a thread whose progress is projected into the rows).
     * Absent reads as `legacy` (a record built by hand). Only the old engine's own paths may advance, resume or sweep a `legacy` run.
     */
    readonly engine?: "legacy" | "langgraph"
    /** The trigger, intact. */
    readonly context: StepJson
    /** Why it stopped, or null. */
    readonly errorCode: string | null
    /** When a person was told, or null. */
    readonly deadLetteredAt: Date | null
    /** The build it parked under, or null. */
    readonly parkedBuild: string | null
    /** The times the machine resumed it. */
    readonly resumeAttempts: number
    /** The earliest the machine may resume it again, or null. */
    readonly resumeNotBefore: Date | null
    /** When the run ended or parked, or null. */
    readonly endedAt: Date | null
    /** When the run started, or null for a record that holds none. */
    readonly startedAt: Date | null
    /** The steps written so far: the next ordinal. */
    readonly stepSeq: number
    /** When an owner or manager cancelled the run, or null. */
    readonly cancelledAt: Date | null
    /** The member who cancelled the run, or null. */
    readonly cancelledBy: string | null
}

/** A step record as the engine returns it, its declared fields read. */
export interface StepRecord {
    /** The record id. */
    readonly id: string
    /** The record version: the fence of the step. */
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
    /** What it does to the world. */
    readonly effect: StepEffect
    /** All the step needs to run. */
    readonly input: StepJson
    /** The stored result, or null. */
    readonly result: StepJson | null
    /** Where it stands. */
    readonly status: AgentStepStatus
    /** The tries made. */
    readonly attempt: number
    /** The tries it gets. */
    readonly maxAttempts: number
    /** How long one try may run, milliseconds. */
    readonly deadlineMs: number
    /** When the claim runs out, or null. */
    readonly claimedUntil: Date | null
    /** The earliest the next try may start, or null. */
    readonly notBefore: Date | null
    /** The work item it waits on, or null. */
    readonly waitItemId: string | null
    /** The work item it is about, kept after the wait, or null. */
    readonly workItemId: string | null
    /** The compensation tries made. */
    readonly compAttempts: number
    /** Why it last failed, or null. */
    readonly errorCode: string | null
}

/** A run record, or null when there is none (or, under a fence, when the row moved on). */
export type OptionalRunRecord = RunRecord | null

/** A step record, or null when there is none (or, under a fence, when the row moved on). */
export type OptionalStepRecord = StepRecord | null
