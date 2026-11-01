import { CONTRACT_MIGRATION, EXPAND_MIGRATION, cutoverSandbox } from "../../world/queue-cutover-sandbox.service"
import { useTestWorld } from "../../world/use-test-world"
import {
    seedCutoverOutbox,
    seedCutoverRaw,
    originalCutoverRows,
    cutoverClaims,
    cutoverQueues,
    conflictCutoverIdentity,
    cutoverFunctions,
} from "../../world/queue-cutover-database.service"

describe("Queue cutover guards (private local PostgreSQL)", () => {
    const sandbox = cutoverSandbox()
    const world = useTestWorld({ modules: [], sandbox })
    beforeAll(async () => {
        await seedCutoverOutbox(world.db.primary)
        await seedCutoverRaw(world.db.primary)
    })

    it("refuses contract before expansion and rolls back every adoption when an envelope conflicts", async () => {
        const db = world.db.primary
        const original = await originalCutoverRows(db)
        const claims = await cutoverClaims(db)

        await expect(sandbox.apply(CONTRACT_MIGRATION)).rejects.toThrow(
            "Queue cutover expand migration must run before contract",
        )
        expect(await originalCutoverRows(db)).toEqual(original)

        await conflictCutoverIdentity(db)
        await expect(sandbox.apply(EXPAND_MIGRATION)).rejects.toThrow("Conflicting pgmq cutover identity")

        expect(await originalCutoverRows(db)).toEqual(original)
        expect(await cutoverClaims(db)).toEqual(claims)
        expect(await cutoverQueues(db)).toEqual([{ pending: 6, archived: 2, event_bus: 1 }])
        expect(await cutoverFunctions(db)).toEqual([
            { legacy_read: "job_read(text,integer,integer,integer)", legacy_ack: "job_ack(text,bigint)" },
        ])
    }, 60000)
})
