import { JobRetry } from "@nivo-lite/agent-sdk/mutation"
import type { DoorCallResult } from "@nivo-lite/agent-sdk/mutation"
import { ORDER, TRANSACTION, orderOf, transactionOf } from "../../../rules/accounting/accounting.fixtures"
import type { OrderRecord, TransactionRecord } from "../../../rules/accounting/accounting.types"
import { doorApi, entityApi, memoryWorld, putLead, putOrder, putTransaction } from "../fixtures/accounting.memory"
import type { MemoryWorld } from "../fixtures/accounting.memory"
import { LEDGER_APPEND_TOOL, LEDGER_STATUS_TOOL, ledgerAppendJob } from "./ledger-append.job"

const CONTEXT = { workspaceId: "w1", attempt: 1, effectKey: (step: string): string => `key:${step}` }
const matched = transactionOf({ status: "matched", orderId: ORDER.id })
const LEAD = "00000000-0000-4000-8000-0000000000c1"

interface Options {
    readonly transaction?: TransactionRecord | null
    readonly order?: OrderRecord | null
    readonly lead?: boolean
}

const connected: DoorCallResult = { ok: true, output: { connected: true } }
const written: DoorCallResult = { ok: true, output: { ref: "Ledger!A2:G2" } }

const harness = (answers: Readonly<Record<string, DoorCallResult>>, options: Options = {}) => {
    const world: MemoryWorld = memoryWorld()
    const transaction = options.transaction === undefined ? matched : options.transaction
    const order = options.order === undefined ? ORDER : options.order
    if (transaction !== null) putTransaction(world, transaction)
    if (order !== null) putOrder(world, order)
    if (options.lead ?? true) putLead(world, LEAD, "Bui Nguyen Dinh")
    for (const [tool, answer] of Object.entries(answers)) world.answers.set(tool, answer)
    const run = (): Promise<void> =>
        ledgerAppendJob.run(
            {
                transactions: entityApi(world, "payment.transaction"),
                orders: entityApi(world, "sales.order"),
                leads: entityApi(world, "sales.lead"),
                door: doorApi(world),
            },
            { transactionId: TRANSACTION.id, orderId: ORDER.id },
            CONTEXT,
        )
    return { calls: world.calls, run }
}

const both = { [LEDGER_STATUS_TOOL]: connected, [LEDGER_APPEND_TOOL]: written }

describe("accounting.ledger-append", () => {
    it("declares itself with ids only in its payload", () => {
        expect(ledgerAppendJob.name).toBe("accounting.ledger-append")
        expect(Object.keys(ledgerAppendJob.input.shape)).toEqual(["transactionId", "orderId"])
    })

    it("writes the settled payment as one ledger line, naming the customer by the lead", async () => {
        const { calls, run } = harness(both)
        await run()
        expect(calls.map((call) => call.tool)).toEqual([LEDGER_STATUS_TOOL, LEDGER_APPEND_TOOL])
        expect(calls[1]?.input).toEqual({
            entry: {
                date: "2026-11-04",
                orderNo: "DH-20261104-0001",
                customer: "Bui Nguyen Dinh",
                amountVnd: 5_000_000,
                transactionId: TRANSACTION.id,
                status: "paid",
                note: "",
            },
        })
    })

    it("names the payer when the order has no lead or the lead has no name", async () => {
        const noLead = harness(both, { order: orderOf({ leadId: null }) })
        await noLead.run()
        expect(noLead.calls[1]?.input).toMatchObject({ entry: { customer: "NGUYEN VAN DINH" } })
        const noName = harness(both, { lead: false })
        await noName.run()
        expect(noName.calls[1]?.input).toMatchObject({ entry: { customer: "NGUYEN VAN DINH" } })
    })

    it("writes nothing, and asks the door nothing, when the transaction or the order is gone", async () => {
        const noTransaction = harness({}, { transaction: null })
        await noTransaction.run()
        const noOrder = harness({}, { order: null })
        await noOrder.run()
        expect(noTransaction.calls).toEqual([])
        expect(noOrder.calls).toEqual([])
    })

    it("skips the step only when the ledger answers that none is connected", async () => {
        const { calls, run } = harness({ [LEDGER_STATUS_TOOL]: { ok: true, output: { connected: false } } })
        await run()
        expect(calls.map((call) => call.tool)).toEqual([LEDGER_STATUS_TOOL])
    })

    it("parks the job, never skips it silently, when the status cannot be asked or read", async () => {
        const unknown = harness({ [LEDGER_STATUS_TOOL]: { ok: false, reason: "unknown_tool", message: "no_provider" } })
        const refused = harness({ [LEDGER_STATUS_TOOL]: { ok: false, reason: "forbidden", message: "403" } })
        const unreadable = harness({ [LEDGER_STATUS_TOOL]: { ok: true, output: { unexpected: true } } })
        await expect(unknown.run()).rejects.toThrow("JOB_REFUSED: ledger.status unknown_tool")
        await expect(refused.run()).rejects.toThrow("JOB_REFUSED: ledger.status forbidden")
        await expect(unreadable.run()).rejects.toThrow("JOB_REFUSED: ledger.status failed")
        for (const { calls } of [unknown, refused, unreadable])
            expect(calls.map((call) => call.tool)).toEqual([LEDGER_STATUS_TOOL])
    })

    it("is delivered again when the probe fails for now", async () => {
        const { run } = harness({ [LEDGER_STATUS_TOOL]: { ok: false, reason: "transient", message: "down" } })
        await expect(run()).rejects.toBeInstanceOf(JobRetry)
    })

    it("parks the job when the write is refused, and has it delivered again when the provider was away", async () => {
        const refused = harness({
            [LEDGER_STATUS_TOOL]: connected,
            [LEDGER_APPEND_TOOL]: { ok: false, reason: "forbidden", message: "403" },
        })
        await expect(refused.run()).rejects.toThrow("JOB_REFUSED: ledger.append forbidden")
        const transient = harness({
            [LEDGER_STATUS_TOOL]: connected,
            [LEDGER_APPEND_TOOL]: { ok: false, reason: "transient", message: "503" },
        })
        await expect(transient.run()).rejects.toBeInstanceOf(JobRetry)
    })
})
