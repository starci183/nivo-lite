import type { TransactionRecord } from "../../../rules/accounting/accounting.types"
import { ORDER, TRANSACTION, orderOf, transactionOf } from "../../../rules/accounting/accounting.fixtures"
import type { OrderRecord } from "../../../rules/accounting/accounting.types"
import { leadNames, orderStore, scriptedDoor, transactionStore } from "../accounting.doubles"
import type { DoorCallResult } from "../accounting.types"
import type { JobContext } from "./job"
import { LEDGER_APPEND_TOOL, LEDGER_STATUS_TOOL, ledgerAppendJob } from "./ledger-append.job"

const CONTEXT: JobContext = { workspaceId: "w1", attempt: 1, effectKey: (step) => `key:${step}` }
const matched = transactionOf({ status: "matched", orderId: ORDER.id })

interface Options {
    readonly transaction?: TransactionRecord | null
    readonly order?: OrderRecord | null
    readonly lead?: string | null
}

const harness = (answers: Readonly<Record<string, DoorCallResult>>, options: Options = {}) => {
    const { door, calls } = scriptedDoor(answers)
    const transaction = options.transaction === undefined ? matched : options.transaction
    const order = options.order === undefined ? ORDER : options.order
    const lead = options.lead === undefined ? "Bui Nguyen Dinh" : options.lead
    const ports = {
        transactions: transactionStore({ get: () => Promise.resolve(transaction) }),
        orders: orderStore({ get: () => Promise.resolve(order) }),
        leads: leadNames({ nameOf: () => Promise.resolve(lead) }),
        door,
    }
    return { calls, run: () => ledgerAppendJob.run(ports, { transactionId: matched.id, orderId: ORDER.id }, CONTEXT) }
}

const connected: DoorCallResult = { ok: true, output: { connected: true } }
const written: DoorCallResult = { ok: true, output: { ref: "Ledger!A2:G2" } }
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
        const noName = harness(both, { lead: null })
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

    it("skips the step when no ledger is connected, the probe is refused for good, or it answers something unreadable", async () => {
        const notConnected = harness({ [LEDGER_STATUS_TOOL]: { ok: true, output: { connected: false } } })
        const refused = harness({ [LEDGER_STATUS_TOOL]: { ok: false, reason: "forbidden", message: "403" } })
        const unreadable = harness({ [LEDGER_STATUS_TOOL]: { ok: true, output: { unexpected: true } } })
        for (const { calls, run } of [notConnected, refused, unreadable]) {
            await run()
            expect(calls.map((call) => call.tool)).toEqual([LEDGER_STATUS_TOOL])
        }
    })

    it("is delivered again when the probe fails for now", async () => {
        const { run } = harness({ [LEDGER_STATUS_TOOL]: { ok: false, reason: "transient", message: "down" } })
        await expect(run()).resolves.toMatchObject({ ok: false, tool: LEDGER_STATUS_TOOL, transient: true })
    })

    it("answers the door's verdict when the write fails: parked for a refused connection, tried again for a transient one", async () => {
        const refused = harness({
            [LEDGER_STATUS_TOOL]: connected,
            [LEDGER_APPEND_TOOL]: { ok: false, reason: "forbidden", message: "403" },
        })
        await expect(refused.run()).resolves.toMatchObject({ ok: false, tool: LEDGER_APPEND_TOOL, transient: false })
        const transient = harness({
            [LEDGER_STATUS_TOOL]: connected,
            [LEDGER_APPEND_TOOL]: { ok: false, reason: "transient", message: "503" },
        })
        await expect(transient.run()).resolves.toMatchObject({ ok: false, tool: LEDGER_APPEND_TOOL, transient: true })
    })
})
