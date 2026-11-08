import type { EntityManager } from "typeorm"
import { EntityEngineService, entityEngineEntities, type ScopedTx } from "@modules/domain/entity-engine"
import { jobsEntities } from "@modules/platform/jobs"
import { eachInOrder } from "@modules/platform/primitives"
import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import type { MutationValues } from "@nivo-lite/agent-sdk/mutation"
import { AgentRunRecordsService } from "../../modules/domain/agent-runs/agent-run-records.service"
import type { AgentStepStatus } from "../../modules/domain/agent-runs/agent-runs.contracts"
import type { StepRecord } from "../../modules/domain/agent-runs/agent-runs-records.contracts"
import type { LiteWorld } from "./lite-world.service"
import { TestWorldError, TestWorldErrorCode } from "./test-world.error"

const JobOutboxEntity: (typeof jobsEntities)[1] = jobsEntities[1]
type JobOutboxEntity = InstanceType<typeof JobOutboxEntity>

const [RecordEntity, RecordLinkEntity] = entityEngineEntities

/** The most rows one read of the proofs takes. */
const ROWS_MAX = 50

/** A moment long past: a claim or a backoff written to it has lapsed. */
const LONG_AGO = new Date(0).toISOString()

/** The entity of a run. */
const RUN = "agent.run"

/** The entity of a step. */
const STEP = "agent.run-step"

/** The declared fields of a run record, as the engine answers them. */
export type RunData = RecordRow["data"]

/** Removes the advance jobs a workspace's proofs wrote. */
export const removeStepJobs = async (manager: EntityManager, workspaceId: string): Promise<void> => {
    await manager.delete(JobOutboxEntity, { queue: "agent_step", workspaceId })
}

/** The advance jobs the outbox holds for a workspace. */
export const stepJobsOf = async (manager: EntityManager, workspaceId: string): Promise<Array<JobOutboxEntity>> =>
    await manager.find(JobOutboxEntity, { where: { queue: "agent_step", workspaceId }, take: ROWS_MAX })

/**
 * Removes every run and step record of a workspace, as the world's superuser: the links first (a step's link to its run restricts the
 * run's removal), then the steps, then the runs.
 */
export const removeRunRecords = async (manager: EntityManager, workspaceId: string): Promise<void> => {
    await manager.delete(RecordLinkEntity, { workspaceId, fromEntity: STEP })
    await manager.delete(RecordEntity, { workspaceId, entity: STEP })
    await manager.delete(RecordEntity, { workspaceId, entity: RUN })
}

/** The steps of a run, read through the engine in the scope of the workspace the way the capability reads them. */
export const stepRecordsOf = (
    world: LiteWorld,
    workspaceId: string,
    runId: string,
): Promise<ReadonlyArray<StepRecord>> =>
    world
        .resolve(EntityEngineService)
        .scoped(workspaceId, (scoped) => world.resolve(AgentRunRecordsService).stepsOf(scoped, runId))

/** The steps of a run inside a transaction that is not the engine's own: the scope is entered on it and left again. */
export const stepRecordsIn = (
    world: LiteWorld,
    tx: EntityManager,
    workspaceId: string,
    runId: string,
): Promise<ReadonlyArray<StepRecord>> =>
    world
        .resolve(EntityEngineService)
        .within(tx, workspaceId, (scoped) => world.resolve(AgentRunRecordsService).stepsOf(scoped, runId))

/** The steps of a run of one kind, read the same way. */
export const stepRecordsOfKind = async (
    world: LiteWorld,
    workspaceId: string,
    runId: string,
    kind: string,
): Promise<ReadonlyArray<StepRecord>> =>
    (await stepRecordsOf(world, workspaceId, runId)).filter((step) => step.kind === kind)

/** The declared fields of a run record, or null when the workspace has no such run. */
export const runDataOf = (world: LiteWorld, workspaceId: string, runId: string): Promise<RunData | null> =>
    world.resolve(EntityEngineService).scoped(workspaceId, async (scoped: ScopedTx) => {
        const row = await world.resolve(EntityEngineService).get(scoped, RUN, runId)
        return row === null ? null : row.data
    })

/** Writes `values` to every step of the run that stands in `status`, each under the version it was read in. */
const patchSteps = (
    world: LiteWorld,
    workspaceId: string,
    runId: string,
    status: AgentStepStatus,
    values: MutationValues,
): Promise<void> =>
    world.resolve(EntityEngineService).scoped(workspaceId, async (scoped) => {
        const records = world.resolve(AgentRunRecordsService)
        const held = (await records.stepsOf(scoped, runId)).filter((step) => step.status === status)
        await eachInOrder(held, async (step) => {
            await records.patchStep(scoped, step, values)
        })
    })

/** Lets every claim of the run lapse, the way a worker that was killed leaves them. */
export const lapseClaims = (world: LiteWorld, workspaceId: string, runId: string): Promise<void> =>
    patchSteps(world, workspaceId, runId, "running", { claimedUntil: LONG_AGO })

/** Ends the backoff of the pending steps of the run, so the next advance may try them. */
export const endBackoff = (world: LiteWorld, workspaceId: string, runId: string): Promise<void> =>
    patchSteps(world, workspaceId, runId, "pending", { notBefore: LONG_AGO })

/** The one step of a run of a kind; a run that holds none or several of that kind is a failed proof. */
export const soleStepOfKind = async (
    world: LiteWorld,
    workspaceId: string,
    runId: string,
    kind: string,
): Promise<StepRecord> => {
    const steps = await stepRecordsOfKind(world, workspaceId, runId, kind)
    const [only, ...rest] = steps
    if (only === undefined || rest.length > 0) throw new TestWorldError({ code: TestWorldErrorCode.RowMissing })
    return only
}
