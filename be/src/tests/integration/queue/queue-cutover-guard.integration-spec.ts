import type {
    CutoverClaim,
    CutoverFunctions,
    CutoverQueues,
    CutoverRow,
} from "../../fixtures/persistence/queue-cutover.rows"
import * as statements from "../../fixtures/persistence/queue-cutover.sql"
import { CONTRACT_MIGRATION, EXPAND_MIGRATION, cutoverSandbox } from "../../world/queue-cutover-sandbox.service"
import { useTestWorld } from "../../world/use-test-world"

describe("Queue cutover guards (private local Supabase)", () => {
    const sandbox = cutoverSandbox()
    const world = useTestWorld({ modules: [], sandbox })
    beforeAll(async () => {
        await world.db.primary.query(statements.SEED_CUTOVER_OUTBOX)
        await world.db.primary.query(statements.SEED_CUTOVER_RAW)
    })

    it("refuses contract before expansion and rolls back every adoption when an envelope conflicts", async () => {
        const db = world.db.primary
        const original = await db.query<Array<CutoverRow>>(statements.ORIGINAL_CUTOVER_ROWS)
        const claims = await db.query<Array<CutoverClaim>>(statements.CUTOVER_CLAIMS)

        await expect(sandbox.apply(CONTRACT_MIGRATION)).rejects.toThrow(
            "Queue cutover expand migration must run before contract",
        )
        expect(await db.query<Array<CutoverRow>>(statements.ORIGINAL_CUTOVER_ROWS)).toEqual(original)

        await db.query(statements.CONFLICT_CUTOVER_IDENTITY)
        await expect(sandbox.apply(EXPAND_MIGRATION)).rejects.toThrow("Conflicting pgmq cutover identity")

        expect(await db.query<Array<CutoverRow>>(statements.ORIGINAL_CUTOVER_ROWS)).toEqual(original)
        expect(await db.query<Array<CutoverClaim>>(statements.CUTOVER_CLAIMS)).toEqual(claims)
        expect(await db.query<Array<CutoverQueues>>(statements.CUTOVER_PGMQ)).toEqual([
            { pending: 6, archived: 2, event_bus: 1 },
        ])
        expect(await db.query<Array<CutoverFunctions>>(statements.CUTOVER_FUNCTIONS)).toEqual([
            { legacy_read: "job_read(text,integer,integer,integer)", legacy_ack: "job_ack(text,bigint)" },
        ])
    }, 60000)
})
