import type { EntityManager } from "typeorm"
import { jobsEntities } from "@modules/platform/jobs"
import { callDbFunction } from "@modules/platform/database"
import { seedDueJobs } from "../fixtures/builders/queue-reconciliation.builder"
import type { SeededJob } from "../fixtures/builders/queue-reconciliation.builder"
import type { AdmittedQueueRun, ClaimedReconcileJob } from "../fixtures/persistence/queue-reconciliation.rows"
import type { LiteWorld } from "./lite-world.service"

const [, JobOutboxEntity] = jobsEntities

/** How long ago the modeled lost process's lease ended. */
const LAPSED_MS = 1000

/** The single column a settlement function answers, named after the function. */
type SettlementRow = Readonly<Record<string, boolean>>

const settled = async (manager: EntityManager, name: string, args: ReadonlyArray<unknown>): Promise<boolean> => {
    const [row] = await callDbFunction<SettlementRow>(manager, name, args)
    return Object.values(row ?? {})[0] === true
}

/** Attempts worker admission using the public backend function. */
export const startQueueRun = async (
    manager: EntityManager,
    queue: string,
    id: string,
    attempts: number,
    leaseSeconds: number,
): Promise<AdmittedQueueRun | undefined> => {
    const [row] = await callDbFunction<AdmittedQueueRun>(manager, "public.job_start", [
        queue,
        id,
        attempts,
        leaseSeconds,
    ])
    return row === undefined ? undefined : { outcome: row.outcome, attempt: row.attempt, run_token: row.run_token }
}

/** Fenced success settlement. */
export const completeQueueRun = (manager: EntityManager, id: string, runToken: string): Promise<boolean> =>
    settled(manager, "public.job_done", [id, runToken])

/** Fenced retry settlement. */
export const retryQueueRun = (manager: EntityManager, id: string, reason: string, runToken: string): Promise<boolean> =>
    settled(manager, "public.job_retry", [id, reason, runToken])

/** Fenced permanent failure settlement. */
export const failQueueRun = (manager: EntityManager, id: string, reason: string, runToken: string): Promise<boolean> =>
    settled(manager, "public.job_dead", [id, reason, runToken])

/** Fenced lease renewal. */
export const renewQueueRun = (
    manager: EntityManager,
    id: string,
    seconds: number,
    runToken: string,
): Promise<boolean> => settled(manager, "public.job_lease", [id, seconds, runToken])

/** Fenced shutdown handback. */
export const returnQueueRun = (manager: EntityManager, id: string, runToken: string): Promise<boolean> =>
    settled(manager, "public.job_handback", [id, runToken])

/** Expires one current run lease, modeling a lost process without waiting for wall-clock time. */
export const expireQueueRun = async (manager: EntityManager, id: string): Promise<void> => {
    await manager.update(JobOutboxEntity, { id }, { runLeaseUntil: new Date(Date.now() - LAPSED_MS) })
}

/** Requests an operator retry of a failed durable job. */
export const requeueProofJob = async (manager: EntityManager, id: string): Promise<void> => {
    await callDbFunction(manager, "public.job_reopen", [id])
}

/** Holds one row until the manager's transaction ends, to prove a second replica skips its lock. */
export const lockReconcileJob = async (manager: EntityManager, id: string): Promise<void> => {
    await manager.findOne(JobOutboxEntity, { where: { id }, select: { id: true }, lock: { mode: "pessimistic_write" } })
}

/** Seeds due outbox rows of one isolated proof and claims them through the public reconciliation function. */
export const reconciliationProof = (world: LiteWorld) => ({
    seed: (scenario: string, queue: string, count: number): Promise<Array<SeededJob>> => {
        const key = world.key(scenario)
        world.cleanup(async () => {
            await world.db.primary
                .createQueryBuilder(JobOutboxEntity, "o")
                .delete()
                .where("payload->>'proofId' = :key", { key })
                .execute()
        })
        return seedDueJobs(world.db.primary, key, queue, count)
    },
    claim: async (size: number): Promise<Array<ClaimedReconcileJob>> => {
        const rows = await callDbFunction<ClaimedReconcileJob>(world.db.primary, "public.job_reconcile", [
            5,
            5,
            size,
            60,
        ])
        return rows.slice(0, size).map((row) => ({ id: row.id, lease_token: row.lease_token }))
    },
})
