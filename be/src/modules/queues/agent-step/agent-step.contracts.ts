import { isRecord } from "@modules/platform/primitives"

/** The queue name: the contract between the producers and the processor of the agent-step job (the durable queue name). */
export const AGENT_STEP_QUEUE = "agent_step"

/** The jobs of the agent-step queue; the value is the job name inside the queue. */
export enum AgentStepJob {
    /** Says a run has a step ready: the processor drives the run until it waits or ends. */
    Advance = "agent-step.advance",
}

/** The payload of an advance job: ids only. The job never names the step that runs; the database chooses which one. */
export interface AgentStepPayload {
    /** The workspace: its concurrency limit is keyed on it. */
    readonly workspaceId: string
    /** The run to drive. */
    readonly runId: string
}

/** True when a job payload is the payload of an advance job. */
export const isAgentStepPayload = (value: unknown): value is AgentStepPayload =>
    isRecord(value) && typeof value.workspaceId === "string" && typeof value.runId === "string"

const KEY_PREFIX = "agent-step"

/** The dedupe key of the advance a committed step starts: one per run, step and mark, so a replayed commit adds no second job. */
export const agentStepKey = (runId: string, stepKey: string, mark: string): string =>
    `${KEY_PREFIX}:${runId}:${stepKey}:${mark}`

const MINUTE_MS = 60_000

/** The dedupe key of an advance the minute sweep starts: one per run and minute. */
export const agentStepSweepKey = (runId: string, at: Date): string =>
    `${KEY_PREFIX}:${runId}:sweep:${String(Math.floor(at.getTime() / MINUTE_MS))}`
