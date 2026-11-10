import { invokeJob } from "@nivo-lite/agent-sdk/invoke"
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
    putTransaction,
    rowsOf,
    withEntity,
} from "../fixtures/accounting.memory"
import type { MemoryWorld } from "../fixtures/accounting.memory"
import { REMATCH_SWEPT, rematchJob, rematchKeyOf } from "./rematch.job"

const CONTEXT = { workspaceId: "w1", attempt: 1, effectKey: (step: string): string => `key:${step}` }
const GIVEN = { orderId: REMATCH_ORDER.id, at: CODE_ISSUED_AT }

const worldOf = (credits: ReadonlyArray<TransactionRecord>, order: OrderRecord | null = REMATCH_ORDER): MemoryWorld => {
    const world = memoryWorld()
    if (order !== null) putOrder(world, order)
    for (const credit of credits) putTransaction(world, credit)
    return world
}

const run = (world: MemoryWorld, given: unknown = GIVEN): ReturnType<typeof invokeJob> =>
    invokeJob(rematchJob, memoryProvider(world), given, CONTEXT)

/** Every row of the world, so a spec can say the job changed none. */
const snapshotOf = (world: MemoryWorld): string =>
    JSON.stringify(
        ["payment.transaction", "sales.order", "accounting.question"].map((entity) =>
            rowsOf(world, entity).map((row) => row.data),
        ),
    )

describe("payment.rematch", () => {
    it("is a declared job that carries an id and the instant, retried by the queue", () => {
        expect(rematchJob.name).toBe("payment.rematch")
        expect(rematchJob.attempts).toBe(5)
        expect(Object.keys(rematchJob.input.shape)).toEqual(["orderId", "at"])
        expect(REMATCH_SWEPT).toBe(100)
    })

    it("does no business: it pays nothing, asks nothing and enqueues nothing, whatever the amount of the credit", async () => {
        for (const credits of [
            [CREDIT_BEFORE_CODE],
            [CREDIT_PARTIAL],
            [CREDIT_BEFORE_CODE, transactionOf({ ...CREDIT_BEFORE_CODE, id: "twin" })],
        ]) {
            const world = worldOf(credits)
            const before = snapshotOf(world)
            await expect(run(world)).resolves.toEqual({ ok: true })
            expect(snapshotOf(world)).toBe(before)
            expect(world.jobs).toEqual([])
            expect(world.calls).toEqual([])
        }
    })

    it("starts the reconcile workflow once for each credit that names the code, the exact amount or not, keyed by credit and order", async () => {
        const world = worldOf([CREDIT_BEFORE_CODE, CREDIT_PARTIAL, CREDIT_NO_CODE])
        await run(world)
        expect(world.starts).toHaveLength(2)
        expect(world.starts).toEqual(
            expect.arrayContaining(
                [CREDIT_BEFORE_CODE, CREDIT_PARTIAL].map((credit) => ({
                    moduleKey: "accounting",
                    workflow: "reconcile",
                    version: "latest",
                    inputs: { transactionId: credit.id },
                    dedupeKey: `rematch:${credit.id}:${REMATCH_ORDER.id}`,
                })),
            ),
        )
        expect(rematchKeyOf("t", "o")).toBe("rematch:t:o")
    })

    it("hands a credit over once when the queue delivers the job again", async () => {
        const world = worldOf([CREDIT_BEFORE_CODE])
        await run(world)
        await run(world)
        expect(world.starts).toHaveLength(1)
    })

    it("starts nothing when no credit names the code", async () => {
        const world = worldOf([CREDIT_NO_CODE])
        await run(world)
        expect(world.starts).toEqual([])
    })

    it("does nothing for an order that is gone or already paid", async () => {
        for (const order of [null, orderOf({ ...REMATCH_ORDER, status: "paid" })]) {
            const world = worldOf([CREDIT_BEFORE_CODE], order)
            await expect(run(world)).resolves.toEqual({ ok: true })
            expect(world.jobs).toEqual([])
            expect(world.starts).toEqual([])
        }
    })

    it("lets a failed read fail the job so the queue retries it", async () => {
        const failing = withEntity(worldOf([CREDIT_BEFORE_CODE]), "payment.transaction", {
            list: () => Promise.reject(new Error("database away")),
        })
        await expect(invokeJob(rematchJob, failing, GIVEN, CONTEXT)).rejects.toThrow("database away")
    })

    it("refuses a payload that is not an order id with the instant", async () => {
        await expect(run(worldOf([]), { orderId: "x", at: "y" })).resolves.toMatchObject({ ok: false })
        await expect(run(worldOf([]), { orderId: REMATCH_ORDER.id })).resolves.toMatchObject({ ok: false })
    })
})
