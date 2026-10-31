import { In } from "typeorm"
import type { EntityManager } from "typeorm"
import { jobsEntities } from "@modules/platform/jobs"
import { messagesEntities } from "@modules/domain/messages"
import { agentWorkEntities } from "../../modules/domain/agent-work"
import type { AgentWakeSource } from "../../modules/domain/agent-work/agent-work.contracts"

const [, AgentWorkStateEntity, AgentWorkLeaseEntity, , , , AgentWakeEntity, AgentTurnEntity] = agentWorkEntities
const [, JobOutboxEntity] = jobsEntities
const [MessageEntity] = messagesEntities

/** The most rows one read of the proofs takes. */
const ROWS_MAX = 20

/** A moment long past: the lease or the retry wait it is written to has lapsed. */
const LONG_AGO = new Date(0)

/** The wake a fact wrote, or a failure when none was written. */
export const wakeOfFact = (manager: EntityManager, agentId: string, source: AgentWakeSource, eventKey: string) =>
    manager.findOneByOrFail(AgentWakeEntity, { agentId, source, eventKey })

/** How many wakes a fact wrote for the agent. */
export const wakesOfFact = (manager: EntityManager, agentId: string, eventKey: string): Promise<number> =>
    manager.countBy(AgentWakeEntity, { agentId, eventKey })

/** The drain jobs the outbox holds under one dedupe key. */
export const drainJobsOf = (manager: EntityManager, dedupeKey: string) =>
    manager.find(JobOutboxEntity, { where: { queue: "agent_turn", dedupeKey }, take: ROWS_MAX })

/** The turns a wake has been run as, newest fence last. */
export const turnsOfWake = (manager: EntityManager, wakeId: string) =>
    manager.find(AgentTurnEntity, { where: { wakeId }, order: { fence: "ASC" }, take: ROWS_MAX })

/** Lets the lease of a scope lapse, the way a worker that died would. */
export const lapseLease = async (manager: EntityManager, agentId: string, scopeKey: string): Promise<void> => {
    await manager.update(AgentWorkLeaseEntity, { agentId, scopeKey }, { leaseUntil: LONG_AGO })
}

/** Ends the retry wait of a wake, so the next drain may take it. */
export const endRetryWait = async (manager: EntityManager, wakeId: string): Promise<void> => {
    await manager.update(AgentWakeEntity, { id: wakeId }, { notBefore: LONG_AGO })
}

/** Leaves the workspace as a proof found it: open wakes skipped, leases free, every agent switched on with no failures. */
export const settleAgentWork = async (manager: EntityManager, workspaceId: string): Promise<void> => {
    await manager.update(
        AgentWakeEntity,
        { workspaceId, status: In(["pending", "held", "running"]) },
        { status: "skipped" },
    )
    await manager.update(AgentWorkLeaseEntity, { workspaceId }, { runningTurnId: null, leaseUntil: null })
    await manager.update(AgentWorkStateEntity, { workspaceId }, { workEnabled: true, failures: 0, breakerUntil: null })
}

/** Removes the drain jobs a workspace's proofs wrote. */
export const removeDrainJobs = async (manager: EntityManager, workspaceId: string): Promise<void> => {
    await manager.delete(JobOutboxEntity, { queue: "agent_turn", workspaceId })
}

/** The lines of the workspace's chat, oldest first. */
export const linesOfWorkspace = (manager: EntityManager, workspaceId: string) =>
    manager.find(MessageEntity, { where: { workspaceId }, order: { createdAt: "ASC" }, take: ROWS_MAX })
