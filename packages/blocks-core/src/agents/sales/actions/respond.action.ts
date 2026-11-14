import { defineAction, type ActionDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { MAX_ID } from "../../../shared/bounds"
import { SALES_MANAGE } from "../constants"
import { salesLeads } from "../ports"
import { refusedWith, writeRefusal } from "../refusals"
import { leadRowOf } from "../sales-records"

const input: z.ZodObject<{ id: z.ZodString }> = z.object({ id: z.string().min(1).max(MAX_ID) })

/**
 * `sales.respond`: the owner takes up a customer who waits for an answer; the customer stops waiting, so the row leaves the
 * attention list. A customer who is not waiting is refused as data. Written under the version the lead was read at.
 */
export const respondAction: ActionDefinition = defineAction({
    id: "sales.respond",
    permission: SALES_MANAGE,
    label: { key: "action_respond" },
    input,
    ports: { leads: salesLeads },
    transactional: true,
    run: async ({ leads }, { id }) => {
        const record = await leads.get(id)
        const lead = record === null ? null : leadRowOf(record)
        if (lead === null) return refusedWith("missing")
        if (lead.awaitingSince === null) return refusedWith("not_awaiting")
        const written = await leads.update(lead.id, lead.version, { awaitingSince: null })
        return written.ok ? { ok: true } : writeRefusal(written)
    },
    refreshes: ["blocks-core.sales.api.lead.awaiting-reply", "blocks-core.sales.api.lead.attention", "blocks-core.sales.api.lead.list", "blocks-core.sales.api.lead.get"],
})
