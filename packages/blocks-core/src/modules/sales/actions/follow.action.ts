import { defineAction } from "@nivo-lite/agent-sdk/block"
import type { ActionDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { MAX_ID } from "../../../bounds"
import { dueAfter } from "../../../rules/sales/follow"
import { isOpenStage } from "../../../rules/sales/stage"
import { SALES_MANAGE } from "../constants"
import { salesLeads } from "../ports"
import { refusedWith, writeRefusal } from "../refusals"
import { leadRowOf } from "../sales-records"

const input: z.ZodObject<{ id: z.ZodString; days: z.ZodOptional<z.ZodNumber> }> = z.object({
    id: z.string().min(1).max(MAX_ID),
    days: z.number().int().min(1).max(30).optional(),
})

/**
 * `sales.follow`: the owner follows up a deal whose next step is overdue; the step is due again after `days` days (two by default),
 * so the row leaves the attention list until it is late again. A deal that is closed has no next step and is refused as data.
 */
export const followAction: ActionDefinition = defineAction({
    id: "sales.follow",
    permission: SALES_MANAGE,
    label: { key: "action_follow" },
    input,
    ports: { leads: salesLeads },
    transactional: true,
    run: async ({ leads }, { id, days }, context) => {
        const record = await leads.get(id)
        const lead = record === null ? null : leadRowOf(record)
        if (lead === null) return refusedWith("missing")
        if (!isOpenStage(lead.stage)) return refusedWith("stage_not_allowed")
        const written = await leads.update(lead.id, lead.version, { nextDueAt: dueAfter(context.now, days) })
        return written.ok ? { ok: true } : writeRefusal(written)
    },
    refreshes: ["sales.attention", "sales.leads", "sales.lead"],
})
