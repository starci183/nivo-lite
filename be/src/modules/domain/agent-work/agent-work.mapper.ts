import type {
    AgentGoalRecord,
    AgentTaskRecord,
    AgentTriggerRecord,
    AgentTurnRecord,
    AgentWakeStatus,
    AgentWorkSettingsRecord,
    AgentWorkState,
    AgentWakeSource,
} from "./agent-work.contracts"
import type {
    AgentGoalEntity,
    AgentTaskEntity,
    AgentTriggerEntity,
    AgentTurnEntity,
    AgentWorkSettingsEntity,
    AgentWorkStateEntity,
} from "./persistence/entities"

/** The settings of a workspace that has no row yet: work on, the legacy road, the default cap. */
export const defaultSettings = (workspaceId: string): AgentWorkSettingsRecord => ({
    workspaceId,
    workEnabled: true,
    road: "legacy",
    backgroundDailyCap: 200,
})

/** The state of an agent that has no row yet: work on, no failures, nothing counted. */
export const defaultState = (agentId: string): AgentWorkState => ({
    agentId,
    workEnabled: true,
    failures: 0,
    breakerUntil: null,
    lastTurnAt: null,
    backgroundDay: null,
    backgroundTurns: 0,
})

/** The settings row as the capability's record. */
export const toSettingsRecord = (row: AgentWorkSettingsEntity): AgentWorkSettingsRecord => ({
    workspaceId: row.workspaceId,
    workEnabled: row.workEnabled,
    road: row.road,
    backgroundDailyCap: row.backgroundDailyCap,
})

/** The state row as the capability's record. */
export const toStateRecord = (row: AgentWorkStateEntity): AgentWorkState => ({
    agentId: row.agentId,
    workEnabled: row.workEnabled,
    failures: row.failures,
    breakerUntil: row.breakerUntil,
    lastTurnAt: row.lastTurnAt,
    backgroundDay: row.backgroundDay,
    backgroundTurns: row.backgroundTurns,
})

/** The goal row as the capability's record. */
export const toGoalRecord = (row: AgentGoalEntity): AgentGoalRecord => ({
    id: row.id,
    agentId: row.agentId,
    title: row.title,
    detail: row.detail,
    status: row.status,
    source: row.source,
    dueAt: row.dueAt,
    reviewedAt: row.reviewedAt,
})

/** The task row as the capability's record. */
export const toTaskRecord = (row: AgentTaskEntity): AgentTaskRecord => ({
    id: row.id,
    agentId: row.agentId,
    goalId: row.goalId,
    dedupeKey: row.dedupeKey,
    title: row.title,
    detail: row.detail,
    status: row.status,
    waitingOn: row.waitingOn,
    nextActionAt: row.nextActionAt,
    workItemId: row.workItemId,
})

/** The trigger row as the capability's record; the time of day loses its seconds. */
export const toTriggerRecord = (row: AgentTriggerEntity): AgentTriggerRecord => ({
    id: row.id,
    agentId: row.agentId,
    kind: row.kind,
    preset: row.preset,
    atTime: row.atTime === null ? null : row.atTime.slice(0, 5),
    timeZone: row.timeZone,
    eventName: row.eventName,
    probeKey: row.probeKey,
    enabled: row.enabled,
    nextRunAt: row.nextRunAt,
    lastFiredAt: row.lastFiredAt,
})

/** What the wake behind a listed turn says: its source, how it ended and why. */
export interface TurnWake {
    /** What woke the agent. */
    readonly source: AgentWakeSource
    /** How the wake stands. */
    readonly status: AgentWakeStatus
    /** Why it was skipped, held or failed. */
    readonly reason: string | null
    /** When it was written. */
    readonly createdAt: Date
}

/** The turn row with its wake as the work tab lists it: no prompt, no proposal, no customer words. */
export const toTurnRecord = (row: AgentTurnEntity, wake: TurnWake): AgentTurnRecord => ({
    id: row.id,
    source: wake.source,
    wakeStatus: wake.status,
    reason: wake.reason,
    status: row.status,
    model: row.model,
    promptTokens: row.promptTokens,
    completionTokens: row.completionTokens,
    cost: row.cost === null ? null : Number(row.cost),
    durationMs: row.durationMs,
    wokeAt: wake.createdAt,
})
