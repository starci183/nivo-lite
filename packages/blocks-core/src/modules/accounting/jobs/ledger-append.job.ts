import type { PortDefinition } from "@nivo-lite/agent-sdk/port"
import { z } from "zod"
import { ledgerLineOf } from "../../../rules/accounting/posting"
import type { Door, LeadNames, OrderStore, TransactionStore } from "../accounting.types"
import { doorPort, leadsPort, ordersPort, transactionsPort } from "../ports"
import { DONE, defineJob, resultOf } from "./job"
import type { JobDefinition } from "./job"

/** The door tool that tells whether the workspace has a ledger connected and told where to write. */
export const LEDGER_STATUS_TOOL = "ledger.status"

/** The door tool that writes one line of the business ledger. */
export const LEDGER_APPEND_TOOL = "ledger.append"

const input: z.ZodObject<{ transactionId: z.ZodUUID; orderId: z.ZodUUID }> = z.object({
    transactionId: z.uuid(),
    orderId: z.uuid(),
})

const status: z.ZodObject<{ connected: z.ZodBoolean }> = z.object({ connected: z.boolean() })

type LedgerAppendPorts = {
    readonly transactions: PortDefinition<TransactionStore>
    readonly orders: PortDefinition<OrderStore>
    readonly leads: PortDefinition<LeadNames>
    readonly door: PortDefinition<Door>
}

const ports: LedgerAppendPorts = {
    transactions: transactionsPort,
    orders: ordersPort,
    leads: leadsPort,
    door: doorPort,
}

/**
 * `accounting.ledger-append`: after a payment settled an order, writes it as one line of the business ledger (the Google Sheet behind
 * the door), in the domain's words (date, order, customer, amount, transaction), never as cells. It is the outbox job `payment.settle`
 * enqueues in its transaction, so the call to the door happens outside it. A workspace with no ledger connected skips the step; a
 * transaction is recorded once, however often the job is delivered (the provider keys the line by the transaction id). A status probe
 * that fails for good (no such tool, forbidden) counts as no ledger; one that fails for now is a transient failure the runner
 * delivers again. A failed write is a failure result: transient is delivered again, anything else is parked with one alert.
 */
export const ledgerAppendJob: JobDefinition<typeof input, LedgerAppendPorts> = defineJob({
    name: "accounting.ledger-append",
    input,
    ports,
    attempts: 8,
    run: async ({ transactions, orders, leads, door }, given) => {
        const [transaction, order] = await Promise.all([
            transactions.get(given.transactionId),
            orders.get(given.orderId),
        ])
        if (transaction === null || order === null) return DONE
        const probe = await door.call(LEDGER_STATUS_TOOL, {})
        if (!probe.ok && probe.reason === "transient") return resultOf(LEDGER_STATUS_TOOL, probe)
        const ledger = probe.ok ? status.safeParse(probe.output) : null
        if (ledger === null || !ledger.success || !ledger.data.connected) return DONE
        const leadName = order.leadId === null ? null : await leads.nameOf(order.leadId)
        const written = await door.call(LEDGER_APPEND_TOOL, {
            entry: { ...ledgerLineOf(transaction, order, leadName) },
        })
        return resultOf(LEDGER_APPEND_TOOL, written)
    },
})
