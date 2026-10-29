import type { EntityManager } from "typeorm"
import { jobsEntities } from "@modules/platform/jobs"

const [, JobOutboxEntity] = jobsEntities

/** The canonical identity of one seeded outbox row. */
export interface SeededJob {
    /** The outbox row id. */
    readonly id: string
}

/** The start of the old era the seeded rows are due since, so the reconciliation sweep always finds them. */
const LONG_DUE = Date.UTC(2000, 0, 1)

/** Seeds sent, due durable rows without contacting either broker; the proof key tags them so cleanup removes only these. */
export const seedDueJobs = async (
    manager: EntityManager,
    key: string,
    queue: string,
    count: number,
): Promise<Array<SeededJob>> => {
    const rows = Array.from({ length: count }, (_, index) => ({
        queue,
        name: queue,
        payload: { proofId: key },
        dedupeKey: `${key}:${index + 1}`,
        sentAt: () => "now()",
        createdAt: new Date(LONG_DUE + (index + 1) * 1000),
        reconcileAt: new Date(LONG_DUE),
    }))
    const result = await manager.insert(JobOutboxEntity, rows)
    return result.identifiers.map(({ id }) => ({ id: String(id) }))
}
