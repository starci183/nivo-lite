import { defineAction, type ActionDefinition, type ActionResult } from "@nivo-lite/agent-sdk/block"
import type { EntityApi } from "@nivo-lite/agent-sdk/entity/port"
import type { RunContext } from "@nivo-lite/agent-sdk/port"
import { z } from "zod"
import { MAX_ID } from "../../../shared/bounds"
import { confirmDecision } from "../rules/order-confirm"
import { stageAfterConfirm } from "../rules/stage"
import type { RightsDirectory } from "../../../shared/platform/platform.types"
import { rightsPort } from "../../../shared/platform/ports"
import { AGENT_NAME, SALES_APPROVE, SALES_MANAGE } from "../constants"
import { salesLeads, salesOrders, salesSettings } from "../ports"
import { CONFLICT, refusedWith, waitsForOwnerResult, writeRefusal } from "../refusals"
import { LEAD_FIELDS, leadOfContact, leadRowOf, orderRowOf } from "../sales-records"
import type { OrderIdInput } from "../sales.types"
import { settingsOf } from "../settings-store"

const input: z.ZodObject<{ id: z.ZodString }> = z.object({ id: z.string().min(1).max(MAX_ID) })

/** What a confirmation reads and writes: the orders, the customers, the sales settings and the rights of the acting member. */
export interface ConfirmPorts {
    /** The orders. */
    readonly orders: EntityApi
    /** The customers. */
    readonly leads: EntityApi
    /** The sales settings. */
    readonly settings: EntityApi
    /** The rights of the acting member. */
    readonly rights: RightsDirectory
}

/** The confirmation of an order, shared by the action and by the decision of the owner. */
export const confirmOrderRun = async (
    { orders, leads, settings, rights }: ConfirmPorts,
    { id }: OrderIdInput,
    context: RunContext,
): Promise<ActionResult> => {
    const found = await orders.get(id)
    const order = found === null ? null : orderRowOf(found)
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
    if (!written.ok) return writeRefusal(written)
    const record = await leadOfContact(leads, order.contactId, LEAD_FIELDS)
    const lead = record === null ? null : leadRowOf(record)
    if (lead !== null) {
        const stage = stageAfterConfirm(lead.stage)
        if (stage !== lead.stage) {
            const won = await leads.update(lead.id, lead.version, {
                stage,
                closedReason: null,
                orderVnd: order.amountVnd,
            })
            if (!won.ok) return CONFLICT
        }
    }
    return { ok: true, data: { changed: true } }
}

/**
 * `sales.confirm-order`: confirms a draft order, once (a repeat changes nothing). An order at the owner threshold or above, or one
 * with no total when the settings say it waits, is confirmed only by a member who holds the right of the owner; anyone else gets a
 * refusal that says it waits for the owner. Confirming also wins the deal of the customer, unless it was lost. Telling the customer
 * is a job after the commit, never part of this transaction.
 */
export const confirmOrderAction: ActionDefinition = defineAction({
    id: "sales.confirm-order",
    permission: SALES_MANAGE,
    label: { key: "action_confirm_order" },
    input,
    ports: { orders: salesOrders, leads: salesLeads, settings: salesSettings, rights: rightsPort },
    transactional: true,
    run: (ports, given, context) => confirmOrderRun(ports, given, context),
    refreshes: [
        "blocks-core.sales.api.order.list",
        "blocks-core.sales.api.order.counts",
        "blocks-core.sales.api.order.get",
        "blocks-core.sales.api.order.waiting",
        "blocks-core.sales.api.lead.attention",
        "blocks-core.sales.api.order.decisions",
        "blocks-core.sales.api.order.figures",
        "blocks-core.sales.api.lead.list",
        "blocks-core.sales.api.lead.counts",
        "blocks-core.sales.api.lead.get",
    ],
})
