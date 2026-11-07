import { defineJob, doorPort, endAfterDoor } from "@nivo-lite/agent-sdk/mutation"
import type { DoorApi, JobDefinition } from "@nivo-lite/agent-sdk/mutation"
import type { EntityApi } from "@nivo-lite/agent-sdk/entity/port"
import type { PortDefinition } from "@nivo-lite/agent-sdk/port"
import { z } from "zod"
import { ledgerLineOf } from "../../../rules/accounting/posting"
import { leadNameById, orderById, transactionById } from "../accounting-data"
import { LEADS, ORDERS, TRANSACTIONS } from "../ports"

/** The door tool that tells whether the workspace has a ledger connected and told where to write. */
export const LEDGER_STATUS_TOOL = "ledger.status"

/** The door tool that writes one line of the business ledger. */
export const LEDGER_APPEND_TOOL = "ledger.append"

/** The name of the job: the outbox enqueues it by this name. */
const JOB_NAME = "accounting.ledger-append"

/** How many times the queue delivers the job before it is parked. */
const ATTEMPTS = 8

const input: z.ZodObject<{ transactionId: z.ZodUUID; orderId: z.ZodUUID }> = z.object({
    transactionId: z.uuid(),
    orderId: z.uuid(),
})

const status: z.ZodObject<{ connected: z.ZodBoolean }> = z.object({ connected: z.boolean() })

/** The port definitions of the job, by the name `run` reaches them by. */
type LedgerAppendPorts = {
    /** The payments. */
    readonly transactions: PortDefinition<EntityApi>
    /** The orders. */
    readonly orders: PortDefinition<EntityApi>
    /** The customers. */
    readonly leads: PortDefinition<EntityApi>
    /** The door out of the system. */
    readonly door: PortDefinition<DoorApi>
}

const ports: LedgerAppendPorts = { transactions: TRANSACTIONS, orders: ORDERS, leads: LEADS, door: doorPort }

/**
 * `accounting.ledger-append`: after a payment settled an order, writes it as one line of the business ledger (the sheet behind the
 * door), in the domain's words (date, order, customer, amount, transaction), never as cells. It is the outbox job `payment.settle`
 * enqueues in its transaction, so the call to the door happens outside it. A workspace with no ledger connected skips the step; a
 * transaction is recorded once, however often the job is delivered (the provider keys the line by the transaction id). A status probe
 * that cannot be asked or read ends through `endAfterDoor` like a failed write: delivered again when the provider was away, parked
 * with one alert otherwise (a ledger that is merely not connected answers `connected: false` and is skipped).
 */
export const ledgerAppendJob: JobDefinition<typeof input, LedgerAppendPorts> = defineJob({
    name: JOB_NAME,
    input,
    ports,
    attempts: ATTEMPTS,
    run: async ({ transactions, orders, leads, door }, given) => {
        const [transaction, order] = await Promise.all([
            transactionById(transactions, given.transactionId),
            orderById(orders, given.orderId),
        ])
        if (transaction === null || order === null) return
        const probe = await door.call(LEDGER_STATUS_TOOL, {})
        // A status that cannot be asked (no tool plays it, forbidden, unreadable) is a defect, not a workspace with no ledger: the job
        // is delivered again when the provider was away, and parked with its alert otherwise, so a payment never goes unwritten unseen.
        endAfterDoor(JOB_NAME, LEDGER_STATUS_TOOL, probe)
        const ledger = status.safeParse(probe.output)
        if (!ledger.success)
            endAfterDoor(JOB_NAME, LEDGER_STATUS_TOOL, { ok: false, reason: "failed", message: "unreadable" })
        if (!ledger.success || !ledger.data.connected) return
        const leadName = order.leadId === null ? null : await leadNameById(leads, order.leadId)
        const written = await door.call(LEDGER_APPEND_TOOL, {
            entry: { ...ledgerLineOf(transaction, order, leadName) },
        })
        endAfterDoor(JOB_NAME, LEDGER_APPEND_TOOL, written)
    },
})
