import { invokeJob } from "@nivo-lite/agent-sdk/invoke"
import { ACCOUNTING_SETTINGS_DEFAULTS } from "../../../rules/accounting/settings"
import { orderOf, transactionOf } from "../../../rules/accounting/accounting.fixtures"
import {
    CODE_ISSUED_AT,
    CREDIT_BEFORE_CODE,
    CREDIT_NO_CODE,
    CREDIT_PARTIAL,
    REMATCH_ORDER,
} from "../../../rules/accounting/rematch.fixtures"
import type { OrderRecord, TransactionRecord } from "../../../rules/accounting/accounting.types"
import {
    memoryProvider,
    memoryWorld,
    putOrder,
    putRecord,
    putSettings,
    putTransaction,
    rowsOf,
    withEntity,
} from "../fixtures/accounting.memory"
import type { MemoryWorld } from "../fixtures/accounting.memory"
import { REMATCH_SWEPT, rematchJob } from "./rematch.job"

const CONTEXT = { workspaceId: "w1", attempt: 1, effectKey: (step: string): string => `key:${step}` }
const GIVEN = { orderId: REMATCH_ORDER.id, at: CODE_ISSUED_AT }
const TWIN_ID = "00000000-0000-4000-8000-000000095999"

const worldOf = (credits: ReadonlyArray<TransactionRecord>, order: OrderRecord | null = REMATCH_ORDER): MemoryWorld => {
    const world = memoryWorld()
    if (order !== null) putOrder(world, order)
    for (const credit of credits) putTransaction(world, credit)
    return world
}

const run = (world: MemoryWorld, given: unknown = GIVEN): ReturnType<typeof invokeJob> =>
    invokeJob(rematchJob, memoryProvider(world), given, CONTEXT)

const dataOf = (world: MemoryWorld, entity: string, id: string): Readonly<Record<string, unknown>> | undefined =>
    rowsOf(world, entity).find((row) => row.id === id)?.data

const questionsOf = (world: MemoryWorld): ReadonlyArray<string> =>
    rowsOf(world, "accounting.question").map((row) => String(row.data["source"]))

describe("payment.rematch", () => {
    it("is a declared job that carries an id and the instant, retried by the queue", () => {
        expect(rematchJob.name).toBe("payment.rematch")
        expect(rematchJob.attempts).toBe(5)
        expect(Object.keys(rematchJob.input.shape)).toEqual(["orderId", "at"])
        expect(REMATCH_SWEPT).toBe(100)
    })

    it("settles a credit that arrived before the payment code, through the path of an arrival", async () => {
        const world = worldOf([CREDIT_BEFORE_CODE])
        await expect(run(world)).resolves.toEqual({ ok: true })
        expect(dataOf(world, "payment.transaction", CREDIT_BEFORE_CODE.id)).toMatchObject({
            status: "matched",
            orderId: REMATCH_ORDER.id,
        })
        expect(dataOf(world, "sales.order", REMATCH_ORDER.id)).toMatchObject({ status: "paid" })
        expect(world.jobs.map((job) => job.job)).toEqual([
            "accounting.ledger-append",
            "accounting.book-project",
            "payment.confirm-notice",
        ])
        expect(questionsOf(world)).toEqual([])
    })

    it("leaves a credit that arrives after the code to the arrival path: nothing is waiting, nothing changes", async () => {
        const world = worldOf([])
        await expect(run(world)).resolves.toEqual({ ok: true })
        expect(dataOf(world, "sales.order", REMATCH_ORDER.id)).toMatchObject({ status: "confirmed" })
        expect(world.jobs).toEqual([])
        expect(questionsOf(world)).toEqual([])
    })

    it("asks the owner about a credit with another amount and settles nothing", async () => {
        const world = worldOf([CREDIT_PARTIAL])
        await run(world)
        expect(dataOf(world, "payment.transaction", CREDIT_PARTIAL.id)).toMatchObject({ status: "unmatched" })
        expect(dataOf(world, "sales.order", REMATCH_ORDER.id)).toMatchObject({ status: "confirmed" })
        expect(questionsOf(world)).toEqual([`rematch:amount:${CREDIT_PARTIAL.id}`])
        expect(String(rowsOf(world, "accounting.question")[0]?.data["text"])).toContain("DH-20261106-0001")
        expect(world.jobs).toEqual([])
    })

    it("says the sender is unknown when a partial credit carries no name", async () => {
        const world = worldOf([transactionOf({ ...CREDIT_PARTIAL, payer: null })])
        await run(world)
        expect(String(rowsOf(world, "accounting.question")[0]?.data["text"])).toContain(
            "kh\u00f4ng r\u00f5 ng\u01b0\u1eddi g\u1eedi",
        )
    })

    it("settles none and asks once when two credits name the code with the amount due", async () => {
        const twin = transactionOf({ ...CREDIT_BEFORE_CODE, id: TWIN_ID })
        const world = worldOf([CREDIT_BEFORE_CODE, twin])
        await run(world)
        await run(world)
        expect(dataOf(world, "sales.order", REMATCH_ORDER.id)).toMatchObject({ status: "confirmed" })
        expect(rowsOf(world, "payment.transaction").map((row) => row.data["status"])).toEqual([
            "unmatched",
            "unmatched",
        ])
        expect(questionsOf(world)).toEqual([`rematch:many:${REMATCH_ORDER.id}`])
        expect(world.jobs).toEqual([])
    })

    it("ignores a credit that names no code and one that is already matched", async () => {
        const matched = transactionOf({ ...CREDIT_BEFORE_CODE, id: TWIN_ID, status: "matched" })
        const world = worldOf([CREDIT_NO_CODE, matched])
        await run(world)
        expect(dataOf(world, "sales.order", REMATCH_ORDER.id)).toMatchObject({ status: "confirmed" })
        expect(world.jobs).toEqual([])
        expect(questionsOf(world)).toEqual([])
    })

    it("settles once however often it runs, and a second payment code changes nothing", async () => {
        const world = worldOf([CREDIT_BEFORE_CODE])
        await run(world)
        await run(world)
        await run(world, { orderId: REMATCH_ORDER.id, at: "2026-11-06T10:00:00.000Z" })
        expect(world.jobs).toHaveLength(3)
        expect(dataOf(world, "sales.order", REMATCH_ORDER.id)).toMatchObject({ status: "paid" })
    })

    it("looks back only as many days as the workspace chose", async () => {
        const old = transactionOf({ ...CREDIT_BEFORE_CODE, occurredAt: "2026-11-03T14:00:00.000Z" })
        const narrow = worldOf([old])
        putSettings(narrow, { ...ACCOUNTING_SETTINGS_DEFAULTS, rematchDays: 2 })
        await run(narrow)
        expect(dataOf(narrow, "payment.transaction", old.id)).toMatchObject({ status: "unmatched" })
        const wide = worldOf([old])
        putSettings(wide, { ...ACCOUNTING_SETTINGS_DEFAULTS, rematchDays: 4 })
        await run(wide)
        expect(dataOf(wide, "payment.transaction", old.id)).toMatchObject({ status: "matched" })
    })

    it("does nothing for an order that is gone, already paid or not priced", async () => {
        const orders = [
            null,
            orderOf({ ...REMATCH_ORDER, status: "paid" }),
            orderOf({ ...REMATCH_ORDER, amountVnd: null }),
        ]
        for (const order of orders) {
            const world = worldOf([CREDIT_BEFORE_CODE], order)
            await expect(run(world)).resolves.toEqual({ ok: true })
            expect(dataOf(world, "payment.transaction", CREDIT_BEFORE_CODE.id)).toMatchObject({ status: "unmatched" })
            expect(world.jobs).toEqual([])
        }
    })

    it("lets a failed write fail the job so the queue retries it", async () => {
        const world = worldOf([CREDIT_BEFORE_CODE])
        const failing = withEntity(world, "payment.transaction", {
            update: () => Promise.reject(new Error("database away")),
        })
        await expect(invokeJob(rematchJob, failing, GIVEN, CONTEXT)).rejects.toThrow("database away")
    })

    it("asks again later when the question could not be written, and does not settle for it", async () => {
        const world = worldOf([CREDIT_PARTIAL])
        const failing = withEntity(world, "accounting.question", {
            insert: () => Promise.resolve({ ok: false, reason: "missing" }),
        })
        await expect(invokeJob(rematchJob, failing, GIVEN, CONTEXT)).resolves.toEqual({ ok: true })
        expect(questionsOf(world)).toEqual([])
        await run(world)
        expect(questionsOf(world)).toEqual([`rematch:amount:${CREDIT_PARTIAL.id}`])
    })

    it("leaves out a row whose fields are not those of a payment", async () => {
        const world = worldOf([CREDIT_BEFORE_CODE])
        putRecord(world, "payment.transaction", "00000000-0000-4000-8000-000000095000", {
            direction: "credit",
            status: "unmatched",
            occurredAt: "2026-11-05T13:00:00.000Z",
            amountVnd: "five thousand",
        })
        await expect(run(world)).resolves.toEqual({ ok: true })
        expect(dataOf(world, "sales.order", REMATCH_ORDER.id)).toMatchObject({ status: "paid" })
    })

    it("refuses a payload that is not an order id with the instant", async () => {
        await expect(run(worldOf([]), { orderId: "x", at: "y" })).resolves.toMatchObject({ ok: false })
        await expect(run(worldOf([]), { orderId: REMATCH_ORDER.id })).resolves.toMatchObject({ ok: false })
    })
})
