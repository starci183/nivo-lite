import { defineAction } from "@nivo-lite/agent-sdk/block"
import type { ActionDefinition, ActionResult } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { MAX_ID } from "../../../bounds"
import { confirmDecision } from "../../../rules/sales/order-confirm"
import { stageAfterConfirm } from "../../../rules/sales/stage"
import { AGENT_NAME, SALES_APPROVE, SALES_MANAGE } from "../constants"
import { salesLeadStore, salesOrderStore, salesRights, salesSettings } from "../ports"
import { CONFLICT, refusedWith, waitsForOwnerResult } from "../refusals"
import { settingsOf } from "../settings-store"

const input: z.ZodObject<{ id: z.ZodString }> = z.object({ id: z.string().min(1).max(MAX_ID) })

/**
 * `sales.confirm-order`: confirms a draft order, once (a repeat changes nothing). An order at the owner threshold the workspace set
 * or above, or one with no total yet when the settings say so, is confirmed only by a member who holds the owner's right; anyone else gets a refusal that says it waits for
 * the owner. Confirming also wins the customer's deal, unless it was lost. Telling the customer is a job after the commit, never
 * part of this transaction.
 */
export const confirmOrderAction: ActionDefinition = defineAction({
    id: "sales.confirm-order",
    permission: SALES_MANAGE,
    label: { key: "action_confirm_order" },
    input,
    ports: { orders: salesOrderStore, leads: salesLeadStore, rights: salesRights, settings: salesSettings },
    transactional: true,
    run: async ({ orders, leads, rights, settings }, { id }, context): Promise<ActionResult> => {
        const order = await orders.get(id)
        if (order === null) return refusedWith("missing")
        const rules = await settingsOf(settings)
        const decision = confirmDecision({
            status: order.status,
            amountVnd: order.amountVnd,
            settings: rules,
            byOwner: await rights.holds(context.memberId, SALES_APPROVE),
        })
        if (decision.kind === "refused") return refusedWith("order_not_confirmable")
        if (decision.kind === "wait_owner") return waitsForOwnerResult(rules.approvalThresholdVnd)
        if (decision.kind === "already") return { ok: true, data: { changed: false } }
        const written = await orders.update(order.id, order.version, {
            status: "confirmed",
            confirmedBy: context.memberId ?? AGENT_NAME,
            confirmedAt: context.now.toISOString(),
        })
        if (!written.ok) return written.reason === "missing" ? refusedWith("missing") : CONFLICT
        const lead = order.leadId === null ? null : await leads.get(order.leadId)
        if (lead !== null) {
            const stage = stageAfterConfirm(lead.stage)
            if (stage !== lead.stage) {
                const won = await leads.update(lead.id, lead.version, { stage, closedReason: null })
                if (!won.ok) return CONFLICT
            }
        }
        return { ok: true, data: { changed: true } }
    },
    refreshes: [
        "sales.orders",
        "sales.order-counts",
        "sales.order",
        "sales.orders-waiting",
        "sales.leads",
        "sales.lead-counts",
        "sales.lead",
    ],
})
