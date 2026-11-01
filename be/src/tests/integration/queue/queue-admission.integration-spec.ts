import assert from "node:assert/strict"
import type { AdmittedQueueRun } from "../../fixtures/persistence/queue-reconciliation.rows"
import {
    reconciliationProof,
    startQueueRun,
    completeQueueRun,
    retryQueueRun,
    failQueueRun,
    renewQueueRun,
    returnQueueRun,
    expireQueueRun,
    requeueProofJob,
} from "../../world/queue-reconciliation-proof.service"
import { useTestWorld } from "../../world/use-test-world"

describe("Queue admission fences (private local PostgreSQL)", () => {
    const world = useTestWorld({ modules: [] })
    const { seed } = reconciliationProof(world)
    const start = async (id: string): Promise<AdmittedQueueRun> => {
        const admitted = await startQueueRun(world.db.primary, "knowledge", id, 2, 5)
        assert(admitted)
        return admitted
    }
    const fenced = async (id: string, first: AdmittedQueueRun): Promise<void> => {
        const stale = world.db.primary
        expect(await completeQueueRun(stale, id, first.run_token)).toBe(false)
        expect(await retryQueueRun(stale, id, "stale", first.run_token)).toBe(false)
        expect(await failQueueRun(stale, id, "stale", first.run_token)).toBe(false)
        expect(await renewQueueRun(stale, id, 5, first.run_token)).toBe(false)
        expect(await returnQueueRun(stale, id, first.run_token)).toBe(false)
    }

    it("readmits an expired running lease and rejects every stale settle or renewal, including retry attempt reuse", async () => {
        const [row] = await seed("run-fence", "knowledge", 1)
        assert(row)
        const first = await start(row.id)
        expect(first).toMatchObject({ outcome: "started", attempt: 1 })
        expect((await start(row.id)).outcome).toBe("busy")
        await expireQueueRun(world.db.primary, row.id)
        const second = await start(row.id)
        expect(second).toMatchObject({ outcome: "started", attempt: 2 })
        expect(second.run_token).not.toBe(first.run_token)
        await fenced(row.id, first)
        expect(await failQueueRun(world.db.primary, row.id, "operator retry", second.run_token)).toBe(true)
        await requeueProofJob(world.db.primary, row.id)
        const retried = await start(row.id)
        expect(retried).toMatchObject({ outcome: "started", attempt: 1 })
        expect(retried.run_token).not.toBe(first.run_token)
        expect(await completeQueueRun(world.db.primary, row.id, first.run_token)).toBe(false)
        expect(await returnQueueRun(world.db.primary, row.id, retried.run_token)).toBe(true)
        expect(await completeQueueRun(world.db.primary, row.id, retried.run_token)).toBe(false)
        const returned = await start(row.id)
        expect(returned).toMatchObject({ outcome: "started", attempt: 1 })
        expect(returned.run_token).not.toBe(retried.run_token)
        expect(await completeQueueRun(world.db.primary, row.id, returned.run_token)).toBe(true)
    })
})
