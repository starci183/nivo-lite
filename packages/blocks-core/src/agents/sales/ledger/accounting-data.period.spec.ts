import { ACCOUNTING_SETTINGS_DEFAULTS } from "./rules/settings"
import {
    PERIOD_ENTRIES_MAX,
    answerQuestion,
    cashEntries,
    incomeEntries,
    openQuestionCount,
    saveWorkspaceSettings,
    unmatchedPayments,
    waitingQuestions,
    workspaceSettings,
} from "./accounting-data"
import {
    entriesList,
    entityApi,
    memoryWorld,
    putQuestion,
    putRecord,
    putSettings,
    rowsOf,
} from "./fixtures/accounting.memory"
import type { MemoryWorld } from "./fixtures/accounting.memory"

const DAYS = { fromDay: "2026-11-01", toDay: "2026-12-01" }
const RANGE = { fromIso: "2026-11-01T00:00:00.000Z", toIso: "2026-12-01T00:00:00.000Z" }

const entryData = (kind: string, entryDate: string, amountVnd: number) => ({
    kind,
    sourceEntity: "blocks-core.sales.transaction",
    sourceId: "t1",
    entryDate,
    amountVnd,
    note: null,
    counterparty: null,
    status: kind === "income" ? "paid" : "expense",
})

const idOf = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`

describe("the entries of a period", () => {
    it("reads every page of the entries that moved money, oldest first, and skips a record that is no entry", async () => {
        const world = memoryWorld()
        Array.from({ length: 130 }, (_, n) => n).forEach((n) =>
            putRecord(world, "blocks-core.sales.ledger-entry", idOf(n + 1), entryData("income", "2026-11-03", 1)),
        )
        putRecord(world, "blocks-core.sales.ledger-entry", idOf(900), entryData("expense", "2026-11-02", 5))
        putRecord(world, "blocks-core.sales.ledger-entry", idOf(901), entryData("invoice", "2026-11-02", 7))
        putRecord(world, "blocks-core.sales.ledger-entry", idOf(902), { kind: "income", entryDate: "2026-11-03" })
        const entries = await cashEntries(entityApi(world, "blocks-core.sales.ledger-entry"), DAYS)
        expect(entries).toHaveLength(131)
        expect(entries[0]?.kind).toBe("expense")
        expect(PERIOD_ENTRIES_MAX).toBe(1_000)
    })

    it("reads the income entries of a period, newest first, and skips what is no entry", async () => {
        const world = memoryWorld()
        putRecord(world, "blocks-core.sales.ledger-entry", idOf(1), entryData("income", "2026-11-02", 5))
        putRecord(world, "blocks-core.sales.ledger-entry", idOf(2), entryData("income", "2026-11-09", 7))
        putRecord(world, "blocks-core.sales.ledger-entry", idOf(3), entryData("expense", "2026-11-09", 9))
        putRecord(world, "blocks-core.sales.ledger-entry", idOf(4), { kind: "income", entryDate: "2026-11-05" })
        const entries = await incomeEntries(entityApi(world, "blocks-core.sales.ledger-entry"), DAYS)
        expect(entries.map((entry) => entry.amountVnd)).toEqual([7, 5])
    })

    it("lists the entries of the books with the fields a row draws, and skips a record that is no entry", async () => {
        const world = memoryWorld()
        putRecord(world, "blocks-core.sales.ledger-entry", idOf(1), entryData("income", "2026-11-02", 5))
        putRecord(world, "blocks-core.sales.ledger-entry", idOf(2), { kind: "tip" })
        const shape = { sort: {}, page: { size: 10 }, row: { id: "id", title: "note" } }
        const query = { q: null, filters: {}, sort: "recent", cursor: null, size: 10 }
        const { rows } = await entriesList(world).page(shape, query)
        expect(rows).toEqual([
            {
                id: idOf(1),
                note: null,
                entryDate: "2026-11-02",
                kind: "income",
                amountVnd: 5,
                status: "paid",
                counterparty: null,
            },
        ])
    })
})

describe("the unmatched payments of a period", () => {
    it("lists the ones nobody tied, newest first, and skips a record that is no payment", async () => {
        const world = memoryWorld()
        const data = (status: string, occurredAt: string) => ({
            direction: "credit",
            amountVnd: 300,
            reference: "ck",
            payer: null,
            orderId: null,
            occurredAt,
            status,
        })
        putRecord(world, "blocks-core.sales.transaction", idOf(1), data("unmatched", "2026-11-02T01:00:00.000Z"))
        putRecord(world, "blocks-core.sales.transaction", idOf(2), data("needs_review", "2026-11-03T01:00:00.000Z"))
        putRecord(world, "blocks-core.sales.transaction", idOf(3), data("matched", "2026-11-03T02:00:00.000Z"))
        putRecord(world, "blocks-core.sales.transaction", idOf(4), {
            status: "unmatched",
            occurredAt: "2026-11-04T01:00:00.000Z",
        })
        const payments = await unmatchedPayments(entityApi(world, "blocks-core.sales.transaction"), RANGE, 5)
        expect(payments.map((payment) => payment.id)).toEqual([idOf(2), idOf(1)])
    })
})

describe("the questions", () => {
    const worldOf = (): MemoryWorld => {
        const world = memoryWorld()
        putQuestion(world, idOf(1), { text: "First", source: "HD-1" }, "2026-11-02T01:00:00.000Z")
        putQuestion(world, idOf(2), { text: "Answered", source: null, status: "answered" }, "2026-11-01T01:00:00.000Z")
        putRecord(world, "blocks-core.sales.ledger-question", idOf(3), { status: "open" })
        return world
    }

    it("counts and lists the ones that wait, skipping a record that is no question", async () => {
        const world = worldOf()
        const api = entityApi(world, "blocks-core.sales.ledger-question")
        await expect(openQuestionCount(api)).resolves.toBe(2)
        await expect(waitingQuestions(api, 5)).resolves.toEqual([
            { id: idOf(1), text: "First", source: "HD-1", askedAt: "2026-11-02T01:00:00.000Z" },
        ])
    })

    it("answers an open question once, and refuses one that is gone or answered", async () => {
        const world = worldOf()
        const api = entityApi(world, "blocks-core.sales.ledger-question")
        await expect(answerQuestion(api, idOf(1), "HD-1", "Lan")).resolves.toEqual({ ok: true })
        expect(rowsOf(world, "blocks-core.sales.ledger-question")[0]?.data).toMatchObject({ status: "answered", answeredBy: "Lan" })
        await expect(answerQuestion(api, idOf(1), "again", "Lan")).resolves.toEqual({ ok: false })
        await expect(answerQuestion(api, idOf(77), "x", "Lan")).resolves.toEqual({ ok: false })
    })
})

describe("the settings of the workspace", () => {
    it("are the defaults until saved, then what was saved, written to one row", async () => {
        const world = memoryWorld()
        const api = entityApi(world, "blocks-core.sales.ledger-settings")
        await expect(workspaceSettings(api)).resolves.toEqual(ACCOUNTING_SETTINGS_DEFAULTS)
        await saveWorkspaceSettings(api, { ...ACCOUNTING_SETTINGS_DEFAULTS, vatPeriod: "monthly" })
        await saveWorkspaceSettings(api, {
            ...ACCOUNTING_SETTINGS_DEFAULTS,
            vatPeriod: "quarterly",
            postUnmatched: true,
        })
        expect(rowsOf(world, "blocks-core.sales.ledger-settings")).toHaveLength(1)
        await expect(workspaceSettings(api)).resolves.toEqual({
            ...ACCOUNTING_SETTINGS_DEFAULTS,
            vatPeriod: "quarterly",
            postUnmatched: true,
        })
    })

    it("fall back to the defaults when the row holds something else", async () => {
        const world = memoryWorld()
        putSettings(world, { postExpenses: "yes" })
        await expect(workspaceSettings(entityApi(world, "blocks-core.sales.ledger-settings"))).resolves.toEqual(
            ACCOUNTING_SETTINGS_DEFAULTS,
        )
    })
})
