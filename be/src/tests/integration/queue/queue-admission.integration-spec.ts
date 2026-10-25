import assert from "node:assert/strict"
import type { AdmittedQueueRun } from "../../fixtures/persistence/queue-reconciliation.rows"
import {
    COMPLETE_QUEUE_RUN,
    EXPIRE_QUEUE_RUN,
    FAIL_QUEUE_RUN,
    RENEW_QUEUE_RUN,
    REQUEUE_PROOF_JOB,
    RETRY_QUEUE_RUN,
    RETURN_QUEUE_RUN,
    START_QUEUE_RUN,
} from "../../fixtures/persistence/queue-reconciliation.sql"
import { reconciliationProof } from "../../world/queue-reconciliation-proof.service"
import { useTestWorld } from "../../world/use-test-world"

describe("Queue admission fences (private local Supabase)", () => {
    const world = useTestWorld({ modules: [] })
    const { seed } = reconciliationProof(world)
    const start = async (id: string): Promise<AdmittedQueueRun> => {
        const [admitted] = await world.db.primary.query<Array<AdmittedQueueRun>>(START_QUEUE_RUN, [
            "knowledge",
            id,
            2,
            5,
        ])
        assert(admitted)
        return admitted
    }
    const fenced = async (id: string, first: AdmittedQueueRun): Promise<void> => {
        const stale = world.db.primary
        expect(await stale.query(COMPLETE_QUEUE_RUN, [id, first.run_token])).toEqual([{ done: false }])
        expect(await stale.query(RETRY_QUEUE_RUN, [id, "stale", first.run_token])).toEqual([{ retried: false }])
        expect(await stale.query(FAIL_QUEUE_RUN, [id, "stale", first.run_token])).toEqual([{ dead: false }])
        expect(await stale.query(RENEW_QUEUE_RUN, [id, 5, first.run_token])).toEqual([{ leased: false }])
        expect(await stale.query(RETURN_QUEUE_RUN, [id, first.run_token])).toEqual([{ handed_back: false }])
    }

    it("readmits an expired running lease and rejects every stale settle or renewal, including retry attempt reuse", async () => {
        const [row] = await seed("run-fence", "knowledge", 1)
        assert(row)
        const first = await start(row.id)
        expect(first).toMatchObject({ outcome: "started", attempt: 1 })
        expect((await start(row.id)).outcome).toBe("busy")
        await world.db.primary.query(EXPIRE_QUEUE_RUN, [row.id])
        const second = await start(row.id)
        expect(second).toMatchObject({ outcome: "started", attempt: 2 })
        expect(second.run_token).not.toBe(first.run_token)
        await fenced(row.id, first)
        expect(await world.db.primary.query(FAIL_QUEUE_RUN, [row.id, "operator retry", second.run_token])).toEqual([
            { dead: true },
        ])
        await world.db.primary.query(REQUEUE_PROOF_JOB, [row.id])
        const retried = await start(row.id)
        expect(retried).toMatchObject({ outcome: "started", attempt: 1 })
        expect(retried.run_token).not.toBe(first.run_token)
        expect(await world.db.primary.query(COMPLETE_QUEUE_RUN, [row.id, first.run_token])).toEqual([{ done: false }])
        expect(await world.db.primary.query(RETURN_QUEUE_RUN, [row.id, retried.run_token])).toEqual([
            { handed_back: true },
        ])
        expect(await world.db.primary.query(COMPLETE_QUEUE_RUN, [row.id, retried.run_token])).toEqual([{ done: false }])
        const returned = await start(row.id)
        expect(returned).toMatchObject({ outcome: "started", attempt: 1 })
        expect(returned.run_token).not.toBe(retried.run_token)
        expect(await world.db.primary.query(COMPLETE_QUEUE_RUN, [row.id, returned.run_token])).toEqual([{ done: true }])
    })
})
