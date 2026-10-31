import type { EntityManager } from "typeorm"
import { jobsEntities } from "@modules/platform/jobs"
import { agentWorkEntities } from "../../modules/domain/agent-work"
import type { AgentWakeSource } from "../../modules/domain/agent-work/agent-work.contracts"

const [, JobOutboxEntity] = jobsEntities
const [, , , , , AgentTriggerEntity, AgentWakeEntity] = agentWorkEntities

const MINUTE_MS = 60_000

/** Makes the slot a trigger remembers late by `minutes`, the way a scheduler lost from Redis leaves it. */
export const lateTrigger = async (manager: EntityManager, triggerId: string, minutes: number): Promise<void> => {
    await manager.update(AgentTriggerEntity, { id: triggerId }, { nextRunAt: new Date(Date.now() - minutes * MINUTE_MS) })
}

/** How many wakes of one source the agent has. */
export const wakesOfSource = (manager: EntityManager, agentId: string, source: AgentWakeSource): Promise<number> =>
    manager.countBy(AgentWakeEntity, { agentId, source })

/** The drains the minute sweep started for the scope of an agent, whatever minute it ran in. */
export const sweepDrainsOf = async (manager: EntityManager, workspaceId: string, agentId: string, scopeKey: string) => {
    const rows = await manager.find(JobOutboxEntity, { where: { queue: "agent_turn", workspaceId }, take: 100 })
    return rows.filter((row) => row.dedupeKey?.startsWith(`agent-turn:${agentId}:sweep:${scopeKey}:`) === true)
}
