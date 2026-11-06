import type { ReadDefinition, ReadRunResult } from "@nivo-lite/agent-sdk/block"
import { ACCOUNTANT_CONTEXT, memoryProvider, memoryWorld } from "../fixtures/accounting.memory"
import type { MemoryWorld } from "../fixtures/accounting.memory"

const run = (read: ReadDefinition, world: MemoryWorld, raw: unknown = {}): Promise<ReadRunResult> =>
    read.execute?.(memoryProvider(world), raw, ACCOUNTANT_CONTEXT) ?? Promise.resolve({ ok: false, problems: [] })
import { putBookEntry } from "../fixtures/accounting.memory"
import { ledgerRead } from "./ledger.read"

const entry = (id: string, kind: "income" | "expense" | "invoice", entryDate: string, amountVnd: number) => ({
    id,
    version: "1",
    kind,
    sourceEntity: "payment.transaction",
    sourceId: id,
    entryDate,
    amountVnd,
    note: id,
    counterparty: null,
    status: kind === "income" ? ("paid" as const) : kind === "expense" ? ("expense" as const) : ("open" as const),
})

const worldOf = (): MemoryWorld => {
    const world = memoryWorld()
    putBookEntry(world, entry("e0", "income", "2026-10-15", 12_000_000))
    putBookEntry(world, entry("e1", "expense", "2026-11-02", 1_280_000))
    putBookEntry(world, entry("e2", "income", "2026-11-03", 1_950_000))
    putBookEntry(world, entry("e3", "income", "2026-11-04", 3_500_000))
    putBookEntry(world, entry("e4", "invoice", "2026-11-04", 99_000_000))
    return world
}

describe("the accounting.ledger read", () => {
    it("opens with everything before the period and lists the entries that moved money by day", async () => {
        const result = await run(ledgerRead, worldOf())
        expect(result).toMatchObject({
            ok: true,
            data: {
                periodKey: "this",
                fromDay: "2026-11-01",
                openingVnd: 12_000_000,
                inVnd: 5_450_000,
                outVnd: 1_280_000,
                closingVnd: 16_170_000,
            },
        })
        expect(result.ok && result.data).toMatchObject({
            days: [{ day: "2026-11-02" }, { day: "2026-11-03" }, { day: "2026-11-04" }],
        })
    })

    it("asks for last month when told to, and is read with the view permission", async () => {
        await expect(run(ledgerRead, worldOf(), { period: "last" })).resolves.toMatchObject({
            ok: true,
            data: { periodKey: "last", openingVnd: 0, inVnd: 12_000_000, closingVnd: 12_000_000 },
        })
        expect(ledgerRead.permission).toBe("accounting.view")
    })
})
