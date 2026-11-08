import { defineAction, type ActionDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { MAX_ID, MAX_LINE } from "../../../bounds"
import { contactParts } from "../../../rules/sales/contact"
import { SALES_MANAGE } from "../constants"
import { salesLeads } from "../ports"
import { CONFLICT, refusedWith } from "../refusals"
import { leadRowOf } from "../sales-records"

const input: z.ZodObject<{ id: z.ZodString; phone: z.ZodOptional<z.ZodNullable<z.ZodString>> }> = z.object({
    id: z.string().min(1).max(MAX_ID),
    phone: z.string().max(MAX_LINE).nullable().optional(),
})

/**
 * `sales.reply`: the owner answers what the assistant still needs to know about a customer: their phone number. The phone is
 * normalised and saved, and the question is cleared, so the row leaves the attention list. A number that is no phone is refused as
 * data, and so is one that belongs to another customer.
 */
export const replyAction: ActionDefinition = defineAction({
    id: "sales.reply",
    permission: SALES_MANAGE,
    label: { key: "action_reply" },
    input,
    ports: { leads: salesLeads },
    transactional: true,
    run: async ({ leads }, { id, phone }) => {
        const record = await leads.get(id)
        const lead = record === null ? null : leadRowOf(record)
        if (lead === null) return refusedWith("missing")
        const given = contactParts(phone).phone
        if (given === null) return refusedWith("phone_required")
        const written = await leads.update(lead.id, lead.version, { phone: given, needs: null })
        if (written.ok) return { ok: true }
        if (written.reason === "taken") return refusedWith("phone_taken")
        return written.reason === "missing" ? refusedWith("missing") : CONFLICT
    },
    refreshes: ["sales.attention", "sales.leads", "sales.lead"],
})
