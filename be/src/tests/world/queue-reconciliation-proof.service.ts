import type { ClaimedReconcileJob } from "../fixtures/persistence/queue-reconciliation.rows"
import { CLAIM_DUE_JOBS, CLEAN_RECONCILE_JOBS, SEED_DUE_JOBS } from "../fixtures/persistence/queue-reconciliation.sql"
import type { LiteWorld } from "./lite-world.service"

/** The canonical identity of one seeded outbox row. */
export interface SeededJob {
    readonly id: string
}

/** Seeds due outbox rows of one isolated proof and claims them through the public reconciliation function. */
export const reconciliationProof = (world: LiteWorld) => ({
    seed: (scenario: string, queue: string, count: number): Promise<Array<SeededJob>> => {
        const key = world.key(scenario)
        world.cleanup(async () => {
            await world.db.primary.query(CLEAN_RECONCILE_JOBS, [key])
        })
        return world.db.primary.query<Array<SeededJob>>(SEED_DUE_JOBS, [key, queue, count])
    },
    claim: (size: number): Promise<Array<ClaimedReconcileJob>> =>
        world.db.primary.query<Array<ClaimedReconcileJob>>(CLAIM_DUE_JOBS, [5, 5, size, 60]),
})
