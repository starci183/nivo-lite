import { builder } from "@starci/jest-preset"
import type { EntityManager } from "typeorm"
import {
    agentWorkEntities,
    type AgentTriggerWrite,
    type AgentTurnView,
    type AgentWake,
    type AgentWakeView,
} from "@modules/domain/agent-work"

const AgentWorkSettingsEntity: (typeof agentWorkEntities)[0] = agentWorkEntities[0]
const AgentWorkStateEntity: (typeof agentWorkEntities)[1] = agentWorkEntities[1]
const AgentTaskEntity: (typeof agentWorkEntities)[3] = agentWorkEntities[3]
const AgentTriggerEntity: (typeof agentWorkEntities)[4] = agentWorkEntities[4]
const AgentWakeEntity: (typeof agentWorkEntities)[5] = agentWorkEntities[5]
const AgentTurnEntity: (typeof agentWorkEntities)[6] = agentWorkEntities[6]
type AgentWorkSettingsEntity = InstanceType<typeof AgentWorkSettingsEntity>
type AgentWorkStateEntity = InstanceType<typeof AgentWorkStateEntity>
type AgentTaskEntity = InstanceType<typeof AgentTaskEntity>
type AgentTriggerEntity = InstanceType<typeof AgentTriggerEntity>
type AgentWakeEntity = InstanceType<typeof AgentWakeEntity>
type AgentTurnEntity = InstanceType<typeof AgentTurnEntity>

const WHEN = new Date("2026-11-10T03:00:00.000Z")

/** The agent work settings row of workspace ws-1: work on, the core road, a cap of 50. */
export const agentWorkSettingsRowOf: (overrides?: Partial<AgentWorkSettingsEntity>) => AgentWorkSettingsEntity =
    builder<AgentWorkSettingsEntity>({
        workspaceId: "ws-1",
        workEnabled: true,
        road: "core",
        backgroundDailyCap: 50,
        pausedBy: null,
        pausedAt: null,
        createdAt: WHEN,
        updatedAt: WHEN,
    })

/** The work state row of agent-1: two failures and four background turns counted on the day. */
export const agentWorkStateRowOf: (overrides?: Partial<AgentWorkStateEntity>) => AgentWorkStateEntity =
    builder<AgentWorkStateEntity>({
        agentId: "agent-1",
        workspaceId: "ws-1",
        workEnabled: true,
        pausedBy: null,
        pausedAt: null,
        failures: 2,
        breakerUntil: null,
        lastTurnAt: null,
        backgroundDay: "2026-11-10",
        backgroundTurns: 4,
        createdAt: WHEN,
        updatedAt: WHEN,
    })

/** An open task row of agent-1 that wants to be woken in an hour. */
export const agentTaskRowOf: (overrides?: Partial<AgentTaskEntity>) => AgentTaskEntity = builder<AgentTaskEntity>({
    id: "task-1",
    workspaceId: "ws-1",
    agentId: "agent-1",
    dedupeKey: "chase-invoice",
    title: "Chase invoice 12",
    detail: "",
    status: "open",
    waitingOn: null,
    nextActionAt: new Date("2026-11-10T04:00:00.000Z"),
    workItemId: null,
    originWakeId: null,
    doneAt: null,
    data: null,
    createdAt: WHEN,
    updatedAt: WHEN,
})

/** A daily trigger row of agent-1 at 08:30 that checks the invoices that are due. */
export const agentTriggerRowOf: (overrides?: Partial<AgentTriggerEntity>) => AgentTriggerEntity =
    builder<AgentTriggerEntity>({
        id: "trigger-1",
        workspaceId: "ws-1",
        agentId: "agent-1",
        kind: "schedule",
        preset: "daily_at",
        atTime: "08:30:00",
        timeZone: "Asia/Ho_Chi_Minh",
        eventName: null,
        enabled: true,
        sources: [],
        seedKey: null,
        nextRunAt: null,
        lastFiredAt: null,
        reconciledAt: null,
        createdAt: WHEN,
        updatedAt: WHEN,
    })

/** A wake row that a switch held: a customer's message in conversation conv-1, written at 01:00 on the day. */
export const agentWakeRowOf: (overrides?: Partial<AgentWakeEntity>) => AgentWakeEntity = builder<AgentWakeEntity>({
    id: "wake-1",
    workspaceId: "ws-1",
    agentId: "agent-1",
    source: "trigger",
    eventKey: "wake-1",
    scopeKey: "conversation:conv-1",
    priority: 10,
    maxAttempts: 2,
    background: false,
    context: {},
    burstWindowMs: null,
    burstMaxMs: null,
    actorMemberId: null,
    status: "held",
    reason: "killed",
    attempts: 0,
    notBefore: WHEN,
    startedAt: null,
    finishedAt: null,
    createdAt: new Date("2026-11-10T01:00:00.000Z"),
    updatedAt: WHEN,
})

/** A settled turn row of agent-1 with its usage, whose proposal holds words the work tab must never show. */
export const agentTurnRowOf: (overrides?: Partial<AgentTurnEntity>) => AgentTurnEntity = builder<AgentTurnEntity>({
    id: "turn-1",
    workspaceId: "ws-1",
    agentId: "agent-1",
    wakeId: "wake-1",
    fence: 1,
    runner: "nivo",
    runtimeAgentId: null,
    threadKey: null,
    status: "settled",
    proposal: { reply: "private words" },
    outcome: null,
    model: "p/m",
    promptTokens: 3,
    completionTokens: 2,
    cost: "0.010000",
    durationMs: 500,
    errorCode: null,
    createdAt: WHEN,
    updatedAt: WHEN,
})

/** The turn a worker begun for a customer wake of conversation conv-1, on its first of two attempts. */
export const agentTurnViewOf: (overrides?: Partial<AgentTurnView>) => AgentTurnView = builder<AgentTurnView>({
    workspaceId: "ws-1",
    agentId: "agent-1",
    scopeKey: "conversation:conv-1",
    fence: 3,
    turnId: "turn-1",
    wakeId: "wake-1",
    source: "trigger",
    eventKey: "msg-1",
    context: {},
    actorMemberId: null,
    attempts: 1,
    maxAttempts: 2,
    wakeCreatedAt: WHEN,
    proposal: null,
})

/** The customer wake of conversation conv-1 as a handler sees it when `begin` ended it with no turn. */
export const agentWakeViewOf: (overrides?: Partial<AgentWakeView>) => AgentWakeView = builder<AgentWakeView>({
    workspaceId: "ws-1",
    agentId: "agent-1",
    scopeKey: "conversation:conv-1",
    wakeId: "wake-2",
    source: "trigger",
    eventKey: "msg-2",
    context: {},
    actorMemberId: null,
    attempts: 2,
    maxAttempts: 2,
    wakeCreatedAt: WHEN,
})

/** A tag of agent-1 in the sales room by member-1. */
export const agentWakeOf: (overrides?: Partial<AgentWake>) => AgentWake = builder<AgentWake>({
    workspaceId: "ws-1",
    agentId: "agent-1",
    source: "tag",
    eventKey: "msg-1",
    context: { messageId: "msg-1", room: "sales" },
    actorMemberId: "member-1",
})

/** What an owner writes for a new daily trigger of agent-1 at 08:30. */
export const agentTriggerWriteOf: (overrides?: Partial<AgentTriggerWrite>) => AgentTriggerWrite =
    builder<AgentTriggerWrite>({
        workspaceId: "ws-1",
        agentId: "agent-1",
        triggerId: null,
        kind: "schedule",
        preset: "daily_at",
        atTime: "08:30",
        timeZone: null,
        eventName: null,
        enabled: true,
    })

/** A trigger row of agent-1 that fires on the event of a bank credit, with no clock. */
export const eventTriggerRowOf = (): AgentTriggerEntity =>
    agentTriggerRowOf({ kind: "event", preset: null, atTime: null, eventName: "bank_credit_booked" })

/** A trigger row of agent-1 that is switched off. */
export const disabledTriggerRowOf = (): AgentTriggerEntity => agentTriggerRowOf({ enabled: false })

/** A turn row of agent-1 whose cost nobody measured. */
export const unmeteredTurnRowOf = (): AgentTurnEntity => agentTurnRowOf({ cost: null })

/** A turn row of agent-1 that is running on runtime agent runtime-1, in the session of conversation conv-1. */
export const runningTurnRowOf = (): AgentTurnEntity =>
    agentTurnRowOf({ runtimeAgentId: "runtime-1", threadKey: "agent:runtime-1:conv-1", status: "running" })

/** A turn row running on runtime-1 whose session was never recorded. */
export const sessionlessTurnRowOf = (): AgentTurnEntity =>
    agentTurnRowOf({ id: "turn-a", runtimeAgentId: "runtime-1", threadKey: null, status: "running" })

/** A turn row running on runtime-1 whose wake no longer exists. */
export const orphanTurnRowOf = (): AgentTurnEntity =>
    agentTurnRowOf({
        id: "turn-b",
        wakeId: "wake-gone",
        runtimeAgentId: "runtime-1",
        threadKey: "k",
        status: "running",
    })

/** A trigger row a module seeded under the key `morning`. */
export const seededTriggerRowOf = (): AgentTriggerEntity => agentTriggerRowOf({ seedKey: "morning" })

/** A wake row of agent-1 whose turn is running. */
export const runningWakeRowOf = (id: string): AgentWakeEntity => agentWakeRowOf({ id, status: "running" })

/** A wake row a switch held: a customer's message of conversation conv-1. */
export const heldCustomerWakeRowOf = (id: string): AgentWakeEntity => agentWakeRowOf({ id, eventKey: id })

/** A wake row a switch held: a tag for agent-2. */
export const heldTagWakeRowOf = (id: string): AgentWakeEntity =>
    agentWakeRowOf({ id, eventKey: id, source: "tag", scopeKey: "agent", agentId: "agent-2" })

/** A wake row a switch held more than a day ago: a customer's message. */
export const heldOldWakeRowOf = (id: string): AgentWakeEntity =>
    agentWakeRowOf({ id, eventKey: id, createdAt: new Date("2026-11-08T01:00:00.000Z") })

/** A wake row a switch held: a schedule of agent-1. */
export const heldScheduleWakeRowOf = (id: string): AgentWakeEntity =>
    agentWakeRowOf({ id, eventKey: id, source: "schedule", scopeKey: "agent" })

/** A wake row a switch held: the internal wake of task task-1 that fell due. */
export const heldTaskWakeRowOf = (id: string): AgentWakeEntity =>
    agentWakeRowOf({ id, eventKey: id, source: "internal", scopeKey: "agent", context: { taskId: "task-1" } })

/** Moves a workspace to a road: the data statement that moves one workspace is this upsert of its settings row. */
export const persistRoad = async (
    manager: EntityManager,
    workspaceId: string,
    road: AgentWorkSettingsEntity["road"],
): Promise<void> => {
    await manager.upsert(AgentWorkSettingsEntity, { workspaceId, road }, ["workspaceId"])
}
