import type { ReadDefinition, ReadRunResult } from "@nivo-lite/agent-sdk/block"
import { ACCOUNTANT_CONTEXT, memoryProvider, memoryWorld } from "../fixtures/accounting.memory"
import type { MemoryWorld } from "../fixtures/accounting.memory"

const run = (read: ReadDefinition, world: MemoryWorld, raw: unknown = {}): Promise<ReadRunResult> =>
    read.execute?.(memoryProvider(world), raw, ACCOUNTANT_CONTEXT) ?? Promise.resolve({ ok: false, problems: [] })
import { TRANSACTION, transactionOf } from "../../../rules/accounting/accounting.fixtures"
import { putTransaction } from "../fixtures/accounting.memory"
import { UNMATCHED_SHOWN, decisionsRead } from "./decisions.read"

describe("the accounting.decisions read", () => {
    it("lists this month's payments nobody tied to an invoice and counts them all", async () => {
        const world = memoryWorld()
        putTransaction(world, TRANSACTION)
        putTransaction(world, transactionOf({ id: "00000000-0000-4000-8000-0000000000a8", status: "needs_review" }))
        putTransaction(world, transactionOf({ id: "00000000-0000-4000-8000-0000000000a7", status: "matched" }))
        const result = await run(decisionsRead, world)
        expect(result).toMatchObject({ ok: true, data: { count: "2" } })
        expect(result.ok && result.data).toMatchObject({
            rows: [{ id: expect.any(String) }, { id: expect.any(String) }],
        })
    })

    it("has no count when every payment is tied", async () => {
        const world = memoryWorld()
        putTransaction(world, transactionOf({ status: "matched" }))
        await expect(run(decisionsRead, world)).resolves.toMatchObject({ ok: true, data: { count: null, rows: [] } })
    })

    it("shows at most five and is read with the view permission", () => {
        expect(UNMATCHED_SHOWN).toBe(5)
        expect(decisionsRead.permission).toBe("accounting.view")
    })
})
