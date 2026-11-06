import type { ReadDefinition, ReadRunResult } from "@nivo-lite/agent-sdk/block"
import type { RunContext } from "@nivo-lite/agent-sdk/port"
import { INVOICE, ORDER, TRANSACTION, claimOf, transactionOf } from "../../../rules/accounting/accounting.fixtures"
import {
    memoryProvider,
    memoryWorld,
    putBookEntry,
    putClaim,
    putInvoice,
    putTransaction,
} from "../fixtures/accounting.memory"
import type { MemoryWorld } from "../fixtures/accounting.memory"
import { closeCheckRead } from "./close-check.read"
import { figuresRead } from "./figures.read"

const CONTEXT: RunContext = {
    workspaceId: "w1",
    memberId: "m1",
    now: new Date("2026-11-04T11:30:00.000Z"),
    timeZone: "Asia/Ho_Chi_Minh",
}

const SOURCE = "payment.transaction"

/** A world with the books of this month, `unmatched` payments of 300,000 VND waiting in October, and `waiting` escalated claims. */
const worldOf = (unmatched: number, waiting: number): MemoryWorld => {
    const world = memoryWorld()
    putBookEntry(world, {
        id: "e1",
        version: "1",
        kind: "income",
        sourceEntity: SOURCE,
        sourceId: TRANSACTION.id,
        entryDate: "2026-11-02",
        amountVnd: 5_000_000,
        note: null,
        counterparty: null,
        status: "paid",
    })
    putBookEntry(world, {
        id: "e2",
        version: "1",
        kind: "invoice",
        sourceEntity: "accounting.invoice",
        sourceId: INVOICE.id,
        entryDate: "2026-11-03",
        amountVnd: 2_000_000,
        note: null,
        counterparty: null,
        status: "paid",
    })
    putInvoice(world, INVOICE)
    for (let n = 0; n < unmatched; n += 1) {
        putTransaction(
            world,
            transactionOf({
                id: `00000000-0000-4000-8000-00000000011${n}`,
                amountVnd: 300_000,
                occurredAt: "2026-10-20T03:00:00.000Z",
                status: n % 2 === 0 ? "unmatched" : "needs_review",
            }),
        )
    }
    for (let n = 0; n < waiting; n += 1) {
        putClaim(
            world,
            claimOf({ id: `00000000-0000-4000-8000-00000000012${n}`, status: "escalated", orderId: ORDER.id }),
        )
    }
    return world
}

const run = (read: ReadDefinition, raw: unknown, world: MemoryWorld): Promise<ReadRunResult> =>
    read.execute?.(memoryProvider(world), raw, CONTEXT) ?? Promise.resolve({ ok: false, problems: [] })

describe("accounting.figures", () => {
    it("adds up this month by default: entries by kind, unmatched payments and the open invoices", async () => {
        const world = worldOf(0, 0)
        putTransaction(
            world,
            transactionOf({ id: "00000000-0000-4000-8000-000000000199", amountVnd: 300_000, status: "unmatched" }),
        )
        await expect(run(figuresRead, {}, world)).resolves.toMatchObject({
            ok: true,
            data: {
                periodKey: "this",
                fromDay: "2026-11-01",
                toDay: "2026-12-01",
                income: { vnd: 5_000_000, count: 1 },
                invoiced: { vnd: 2_000_000, count: 1 },
                adjustments: { vnd: 0, count: 0 },
                unmatched: { vnd: 300_000, count: 1 },
                receivable: { vnd: 2_000_000, count: 1 },
            },
        })
    })

    it("adds up last month when asked", async () => {
        await expect(run(figuresRead, { period: "last" }, worldOf(0, 0))).resolves.toMatchObject({
            ok: true,
            data: { periodKey: "last", fromDay: "2026-10-01", toDay: "2026-11-01" },
        })
    })

    it("refuses a period it does not know", async () => {
        await expect(run(figuresRead, { period: "next" }, worldOf(0, 0))).resolves.toMatchObject({ ok: false })
    })
})

describe("accounting.close-check", () => {
    it("checks last month by default and lists what stops it", async () => {
        await expect(run(closeCheckRead, {}, worldOf(2, 1))).resolves.toEqual({
            ok: true,
            data: {
                periodKey: "last",
                fromDay: "2026-10-01",
                toDay: "2026-11-01",
                canClose: false,
                blockers: ["unmatched_payments", "waiting_questions"],
            },
        })
    })

    it("lets last month close when nothing stops it, and keeps this month open", async () => {
        await expect(run(closeCheckRead, {}, worldOf(0, 0))).resolves.toMatchObject({
            ok: true,
            data: { canClose: true, blockers: [] },
        })
        await expect(run(closeCheckRead, { period: "this" }, worldOf(0, 0))).resolves.toMatchObject({
            ok: true,
            data: { canClose: false, blockers: ["period_open"] },
        })
    })
})
