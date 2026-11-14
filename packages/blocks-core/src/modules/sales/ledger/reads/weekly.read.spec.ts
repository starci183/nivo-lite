import type { ReadDefinition, ReadRunResult } from "@nivo-lite/agent-sdk/block"
import { ACCOUNTANT_CONTEXT, memoryProvider, memoryWorld } from "../fixtures/accounting.memory"
import type { MemoryWorld } from "../fixtures/accounting.memory"

const run = (read: ReadDefinition, world: MemoryWorld, raw: unknown = {}): Promise<ReadRunResult> =>
    read.execute?.(memoryProvider(world), raw, ACCOUNTANT_CONTEXT) ?? Promise.resolve({ ok: false, problems: [] })
import { putBookEntry } from "../fixtures/accounting.memory"
import { weeklyRead } from "./weekly.read"

const entry = (id: string, kind: "income" | "invoice", entryDate: string, amountVnd: number) => ({
    id,
    version: "1",
    kind,
    sourceEntity: "blocks-core.sales.transaction",
    sourceId: id,
    entryDate,
    amountVnd,
    note: null,
    counterparty: null,
    status: kind === "income" ? ("paid" as const) : ("open" as const),
})

describe("the sales.weekly read", () => {
    it("adds the income entries of this month by week and leaves the rest out", async () => {
        const world = memoryWorld()
        putBookEntry(world, entry("e1", "income", "2026-11-03", 5_000_000))
        putBookEntry(world, entry("e2", "income", "2026-11-10", 300))
        putBookEntry(world, entry("e3", "invoice", "2026-11-03", 9_000))
        putBookEntry(world, entry("e4", "income", "2026-10-30", 7))
        await expect(run(weeklyRead, world)).resolves.toEqual({
            ok: true,
            data: { periodKey: "this", fromDay: "2026-11-01", w1: 5_000_000, w2: 300, w3: 0, w4: 0, w5: 0 },
        })
    })

    it("asks for last month when told to", async () => {
        const world = memoryWorld()
        putBookEntry(world, entry("e4", "income", "2026-10-30", 7))
        await expect(run(weeklyRead, world, { period: "last" })).resolves.toEqual({
            ok: true,
            data: { periodKey: "last", fromDay: "2026-10-01", w1: 0, w2: 0, w3: 0, w4: 0, w5: 7 },
        })
    })

    it("is read with the view permission", () => {
        expect(weeklyRead.permission).toBe("sales.view")
    })
})
