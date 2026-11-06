import { defineNode } from "@nivo-lite/agent-sdk/node"
import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import type { RightsGrant } from "@nivo-lite/agent-sdk/rights"
import { z } from "zod"
import type { LedgerRef } from "../../vocabulary"
import type { NodeSchema } from "../node-schema.types"
import { MAX_ID, MAX_LINE } from "../../bounds"
import { bilingualOf, messageOf } from "../../messages/catalog"
import { LEAD_DINH, ORDER_DINH, STORE_REAL_CASE, TRANSACTION_DINH } from "../payment/payment.fixtures"
import { READ_LEADS, READ_ORDERS, READ_TRANSACTIONS } from "../payment/payment.rights"
import type { LeadRow, OrderRow, TransactionRow } from "../payment/payment.schemas"
import { entryOf, isConnectionRefused, isRecordable } from "./ledger.policy"
import type { LedgerResult } from "./ledger.policy"

/** The settlement to write down: the transaction, the order it paid and how it came out. */
interface LedgerAppendInput {
    readonly transactionId: string
    readonly orderId: string | null
    readonly result: LedgerResult
}

/** What came of it: `recorded` an entry was written, `voided` an earlier one was taken back, `skipped` there was nothing to write. */
interface LedgerAppendOutput {
    readonly status: "recorded" | "voided" | "skipped"
    readonly ref: string | null
}

/** The words of the item the owner is asked to act on when the provider refused the connection. */
interface LedgerAppendParams {
    readonly reconnectTitle: string
}

const APPEND_TOOL = "ledger.append" as const
const VOID_TOOL = "ledger.void" as const

const params: NodeSchema<LedgerAppendParams> = z.object({ reconnectTitle: z.string().min(1).max(MAX_LINE) })
const input: NodeSchema<LedgerAppendInput> = z.object({
    transactionId: z.string().min(1).max(MAX_ID),
    orderId: z.string().max(MAX_ID).nullable(),
    result: z.enum(["paid", "already-paid", "raised", "voided"]),
})
const output: NodeSchema<LedgerAppendOutput> = z.object({
    status: z.enum(["recorded", "voided", "skipped"]),
    ref: z.string().max(MAX_LINE).nullable(),
})

const SKIPPED: LedgerAppendOutput = { status: "skipped", ref: null }
const SETTINGS: LedgerAppendParams = { reconnectTitle: messageOf("vi", "accountingLedgerReconnectTitle") }

/** The agent grant the examples run under: the node own rights and its tools. */
const GRANT: RightsGrant = { rights: [READ_TRANSACTIONS, READ_ORDERS, READ_LEADS], tools: [APPEND_TOOL, VOID_TOOL] }

/**
 * `accounting.post-payment`: writes a settled payment into the business ledger as one entry, in the domain's words (date, order, customer,
 * amount, transaction, status), never as cells: where the ledger lives and how an entry is laid out belongs to the provider behind the
 * `ledger.append` tool. The ledger is a copy: NIVO's data stays the truth, nothing is read back, and an entry is never changed or removed;
 * taking one back (`voided`) adds a void entry through `ledger.void`. A transaction is recorded once, however often it is asked (the
 * provider keys it `ledger:<transactionId>`). A failure the provider can cure by itself is left to the run to try again; a refused
 * connection (a missing scope, a 403) is something only the owner can cure, so the owner gets ONE item and the failure goes on.
 */
export const accountingPostPaymentNode: NodeDefinition<
    NodeSchema<LedgerAppendInput>,
    NodeSchema<LedgerAppendOutput>,
    NodeSchema<LedgerAppendParams>
> = defineNode({
    id: "accounting.post-payment",
    role: "output",
    title: bilingualOf("nodeAccountingPostPaymentTitle"),
    params,
    input,
    output,
    rights: [READ_TRANSACTIONS, READ_ORDERS, READ_LEADS],
    effects: ["work-item.raise"],
    tools: [APPEND_TOOL, VOID_TOOL],
    run: async (given, context) => {
        if (given.result === "raised") return SKIPPED
        try {
            if (given.result === "voided") {
                const voided = await context.tools.call<LedgerRef>(VOID_TOOL, { transactionId: given.transactionId })
                return { status: "voided", ref: voided.ref }
            }
            const [transaction] = await context.data.read<TransactionRow>("bank-transaction", {
                where: { id: given.transactionId },
                fields: READ_TRANSACTIONS.fields,
                limit: 1,
            })
            const [order] =
                given.orderId === null || !isRecordable(given.result)
                    ? []
                    : await context.data.read<OrderRow>("order", {
                          where: { id: given.orderId },
                          fields: READ_ORDERS.fields,
                          limit: 1,
                      })
            if (transaction === undefined || order === undefined) return SKIPPED
            const [lead] = await context.data.read<LeadRow>("sales-lead", {
                where: { id: order.leadId },
                fields: READ_LEADS.fields,
                limit: 1,
            })
            const written = await context.tools.call<LedgerRef>(APPEND_TOOL, {
                entry: entryOf(transaction, order, lead?.contactName ?? null),
            })
            return { status: "recorded", ref: written.ref }
        } catch (error) {
            if (isConnectionRefused(error)) {
                await context.effect(
                    "work-item.raise",
                    {
                        action: "connect_ledger",
                        title: context.params.reconnectTitle,
                        payload: { transactionId: given.transactionId },
                    },
                    { dedupeKey: "ledger-reconnect" },
                )
            }
            throw error
        }
    },
    examples: [
        {
            name: "writes the 5,000 transaction that paid Dinh's order as one entry",
            params: SETTINGS,
            input: { transactionId: TRANSACTION_DINH.id, orderId: ORDER_DINH.id, result: "paid" },
            output: { status: "recorded", ref: "Ledger!A2:G2" },
            effects: [],
            store: STORE_REAL_CASE,
            grant: GRANT,
            tools: [{ ref: "Ledger!A2:G2" }],
        },
        {
            name: "names the payer on the transfer when the customer has no lead row",
            params: SETTINGS,
            input: { transactionId: "tx-named", orderId: "order-2", result: "already-paid" },
            output: { status: "recorded", ref: "Ledger!A3:G3" },
            effects: [],
            store: {
                ...STORE_REAL_CASE,
                "bank-transaction": [
                    {
                        ...TRANSACTION_DINH,
                        id: "tx-named",
                        amountVnd: 7000,
                        payer: "Nguyen Van A",
                        occurredAt: "2026-11-04T18:30:00.000Z",
                    },
                ],
                order: [{ ...ORDER_DINH, id: "order-2", orderNo: "SO-0002", leadId: "lead-gone", amountVnd: 7000 }],
                "sales-lead": [LEAD_DINH],
            },
            grant: GRANT,
            tools: [{ ref: "Ledger!A3:G3" }],
        },
        {
            name: "takes an entry back by asking for a void entry, which adds one and changes nothing written",
            params: SETTINGS,
            input: { transactionId: TRANSACTION_DINH.id, orderId: null, result: "voided" },
            output: { status: "voided", ref: "Ledger!A4:G4" },
            effects: [],
            grant: GRANT,
            tools: [{ ref: "Ledger!A4:G4" }],
        },
        {
            name: "writes nothing for a settlement that was only raised to the owner",
            params: SETTINGS,
            input: { transactionId: TRANSACTION_DINH.id, orderId: null, result: "raised" },
            output: SKIPPED,
            effects: [],
            grant: GRANT,
        },
        {
            name: "writes nothing when the transaction is not found",
            params: SETTINGS,
            input: { transactionId: "ghost", orderId: ORDER_DINH.id, result: "paid" },
            output: SKIPPED,
            effects: [],
            store: STORE_REAL_CASE,
            grant: GRANT,
        },
        {
            name: "writes nothing when no order is named",
            params: SETTINGS,
            input: { transactionId: TRANSACTION_DINH.id, orderId: null, result: "paid" },
            output: SKIPPED,
            effects: [],
            store: STORE_REAL_CASE,
            grant: GRANT,
        },
    ],
})
