import { isRecord } from "@modules/platform/primitives"

/** The queue name: the contract between the producers and the processor of the agent-turn drain job (the durable queue name). */
export const AGENT_TURN_QUEUE = "agent_turn"

/** The jobs of the agent-turn queue; the value is the job name inside the queue. */
export enum AgentTurnJob {
    /** Says one agent has work in one scope: the processor drains it, one turn at a time, until the scope has none due. */
    Drain = "agent-turn.drain",
    /** The minute tick of the sweep: it drives the scopes stuck without a job, writes the wakes that are due and keeps the schedulers true to their rows. */
    Sweep = "agent-turn.sweep",
}

/** The payload of a drain job: ids only. The job never names a wake; the database chooses which one runs. */
export interface AgentTurnDrainPayload {
    /** The workspace: its concurrency limit is keyed on it. */
    readonly workspaceId: string
    /** The agent that has work. */
    readonly agentId: string
    /** The lock scope: `agent`, or `conversation:<id>` for a customer conversation. */
    readonly scopeKey: string
}

/** True when a job payload is the payload of a drain job. */
export const isAgentTurnDrainPayload = (value: unknown): value is AgentTurnDrainPayload =>
    isRecord(value) &&
    typeof value.workspaceId === "string" &&
    typeof value.agentId === "string" &&
    typeof value.scopeKey === "string"

const KEY_PREFIX = "agent-turn"

/** The dedupe key of the drain a new wake starts: one job per fact, so a redelivered webhook or a replayed event adds none. */
export const agentTurnWakeKey = (agentId: string, source: string, eventKey: string): string =>
    `${KEY_PREFIX}:${agentId}:${source}:${eventKey}`

/** The dedupe key of the drain a finished turn starts when more work is due in its scope. */
export const agentTurnNextKey = (agentId: string, turnId: string): string => `${KEY_PREFIX}:${agentId}:next:${turnId}`

const MINUTE_MS = 60_000

/** The dedupe key of a drain the minute sweep starts: one per scope and minute. */
export const agentTurnSweepKey = (agentId: string, scopeKey: string, at: Date): string =>
    `${KEY_PREFIX}:${agentId}:sweep:${scopeKey}:${String(Math.floor(at.getTime() / MINUTE_MS))}`

/** The queue the job schedulers of the agents' triggers fire into: no outbox row stands behind a job of it. */
export const AGENT_SCHEDULE_FIRE_QUEUE = "agent_schedule_fire"

/** The only job of the fire queue: one slot of one trigger came up. */
export const AGENT_SCHEDULE_FIRE_JOB = "agent-schedule.fire"

/** The payload a scheduler's template carries: ids only. */
export interface AgentScheduleTemplatePayload {
    /** The workspace of the agent. */
    readonly workspaceId: string
    /** The agent the trigger belongs to. */
    readonly agentId: string
    /** The trigger whose slot comes up. */
    readonly triggerId: string
}

/** The payload of a fire job: the template's ids, and the slot the broker adds from the job id at every firing. */
export interface AgentScheduleFirePayload extends AgentScheduleTemplatePayload {
    /** The slot that came up, epoch ms as text. */
    readonly slot: string
}

/** True when a job payload is the payload of a fire job. */
export const isAgentScheduleFirePayload = (value: unknown): value is AgentScheduleFirePayload =>
    isRecord(value) &&
    typeof value.workspaceId === "string" &&
    typeof value.agentId === "string" &&
    typeof value.triggerId === "string" &&
    typeof value.slot === "string"

const SCHEDULER_PREFIX = "agent-trigger:"

/** The id of the scheduler that belongs to a trigger: written with the row, removed with it. */
export const agentTriggerSchedulerId = (triggerId: string): string => `${SCHEDULER_PREFIX}${triggerId}`
