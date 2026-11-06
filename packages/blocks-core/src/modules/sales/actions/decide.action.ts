import { defineAction } from "@nivo-lite/agent-sdk/block"
import type { ActionDefinition, ActionResult } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { MAX_ID } from "../../../bounds"
import { SALES_DECISION_COMMANDS } from "../../../rules/sales/decisions"
import { SALES_APPROVE } from "../constants"
import { rightsPort } from "../../platform/ports"
import { salesClaims, salesInvoices, salesLeads, salesOrders, salesSettings, salesTransactions } from "../ports"
import { cancelOrderRun } from "./cancel-order.action"
import { confirmOrderRun } from "./confirm-order.action"

const input: z.ZodObject<{ id: z.ZodString; command: z.ZodEnum<{ approve: "approve"; reject: "reject" }> }> = z.object({
    id: z.string().min(1).max(MAX_ID),
    command: z.enum([SALES_DECISION_COMMANDS.approve, SALES_DECISION_COMMANDS.reject]),
})

/**
 * `sales.decide`: the owner's answer to an order that waits: approve confirms it, reject cancels it. It runs the same code as the
 * two order actions, so a decision and a click on the order itself never differ.
 */
export const decideAction: ActionDefinition = defineAction({
    id: "sales.decide",
    permission: SALES_APPROVE,
    label: { key: "action_decide" },
    input,
    ports: {
        orders: salesOrders,
        leads: salesLeads,
        rights: rightsPort,
        settings: salesSettings,
        transactions: salesTransactions,
        invoices: salesInvoices,
        claims: salesClaims,
    },
    transactional: true,
    run: (stores, { id, command }, context): Promise<ActionResult> =>
        command === SALES_DECISION_COMMANDS.approve
            ? confirmOrderRun(stores, { id }, context)
            : cancelOrderRun(stores, { id }),
    refreshes: [
        "sales.orders",
        "sales.order-counts",
        "sales.order",
        "sales.orders-waiting",
        "sales.attention",
        "sales.decisions",
        "sales.figures",
        "sales.leads",
        "sales.lead-counts",
        "sales.lead",
    ],
})
