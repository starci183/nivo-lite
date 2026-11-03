import type { EntityManager } from "typeorm"
import { jobsEntities } from "@modules/platform/jobs"
import { AgentRunStepEntity } from "../../modules/domain/agent-runs/persistence/entities"

const JobOutboxEntity: (typeof jobsEntities)[1] = jobsEntities[1]
type JobOutboxEntity = InstanceType<typeof JobOutboxEntity>

/** The most rows one read of the proofs takes. */
const ROWS_MAX = 50

/** A moment long past: a claim or a backoff written to it has lapsed. */
const LONG_AGO = new Date(0)

/** Removes the advance jobs a workspace's proofs wrote. */
export const removeStepJobs = async (manager: EntityManager, workspaceId: string): Promise<void> => {
    await manager.delete(JobOutboxEntity, { queue: "agent_step", workspaceId })
}

/** The advance jobs the outbox holds for a workspace. */
export const stepJobsOf = (manager: EntityManager, workspaceId: string): Promise<Array<JobOutboxEntity>> =>
    manager.find(JobOutboxEntity, { where: { queue: "agent_step", workspaceId }, take: ROWS_MAX })

/** Lets every claim of the run lapse, the way a worker that was killed leaves them. */
export const lapseClaims = async (manager: EntityManager, runId: string): Promise<void> => {
    await manager.update(AgentRunStepEntity, { runId, status: "running" }, { claimUntil: LONG_AGO })
}

/** Ends the backoff of the pending steps of the run, so the next advance may try them. */
export const endBackoff = async (manager: EntityManager, runId: string): Promise<void> => {
    await manager.update(AgentRunStepEntity, { runId, status: "pending" }, { notBefore: LONG_AGO })
}
