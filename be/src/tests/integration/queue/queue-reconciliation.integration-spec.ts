import assert from "node:assert/strict"
import { LOCK_RECONCILE_JOB } from "../../fixtures/persistence/queue-reconciliation.sql"
import { reconciliationProof } from "../../world/queue-reconciliation-proof.service"
import { useTestWorld } from "../../world/use-test-world"

describe("Queue reconciliation claims (private local Supabase)", () => {
    const world = useTestWorld({ modules: [] })
    const { seed, claim } = reconciliationProof(world)

    it("reaches another queue beyond a waiting backlog and advances every claimed row's next check", async () => {
        await seed("waiting-backlog", "public_api", 60)
        const [lost] = await seed("lost-job", "knowledge", 1)
        assert(lost)
        const first = await claim(5)
        expect(first.map((row) => row.id)).toContain(lost.id)
        expect(first).toHaveLength(5)
        const second = await claim(5)
        expect(second).toHaveLength(5)
        expect(second.every((row) => !first.some((prior) => prior.id === row.id))).toBe(true)
    })

    it("lets replicas claim disjoint batches concurrently", async () => {
        await seed("replica-backlog", "knowledge", 20)
        const [left, right] = await Promise.all([claim(10), claim(10)])
        expect(left).toHaveLength(10)
        expect(right).toHaveLength(10)
        expect(new Set([...left, ...right].map((row) => row.id)).size).toBe(20)
        expect(left.every((row) => row.lease_token.length > 0)).toBe(true)
        expect(right.every((row) => row.lease_token.length > 0)).toBe(true)
    })

    it("skips a row another transaction holds and claims other work immediately", async () => {
        const rows = await seed("locked-backlog", "knowledge", 2)
        const [locked, available] = rows
        assert(locked && available)
        await world.db.primary.transaction(async (tx) => {
            await tx.query(LOCK_RECONCILE_JOB, [locked.id])
            const selected = await claim(500)
            expect(selected.map((row) => row.id)).not.toContain(locked.id)
            expect(selected.map((row) => row.id)).toContain(available.id)
        })
    })
})
