import { defineAction, type ActionDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { MAX_ID } from "../../../bounds"
import { LEAD_STAGES, MAX_REASON_CHARS, planMove } from "../../../rules/sales/stage"
import { SALES_APPROVE, SALES_MANAGE } from "../constants"
import { rightsPort } from "../../platform/ports"
import { salesLeads, salesSettings } from "../ports"
import { refusedWith, writeRefusal } from "../refusals"
import { leadRowOf } from "../sales-records"
import { settingsOf } from "../settings-store"

const input: z.ZodObject<{
    id: z.ZodString
    to: z.ZodEnum<{ readonly [K in (typeof LEAD_STAGES)[number]]: K }>
    reason: z.ZodOptional<z.ZodNullable<z.ZodString>>
}> = z.object({
    id: z.string().min(1).max(MAX_ID),
    to: z.enum(LEAD_STAGES),
    reason: z.string().max(MAX_REASON_CHARS).nullable().optional(),
})

/**
 * `sales.move-stage`: moves a deal to another stage. Closing it (won or lost) takes a reason, which the lead keeps; the move is
 * refused as data when the flow does not allow it. Written under the version the lead was read at, so two people never overwrite
 * each other.
 */
export const moveStageAction: ActionDefinition = defineAction({
    id: "sales.move-stage",
    permission: SALES_MANAGE,
    label: { key: "action_move_stage" },
    input,
    ports: { leads: salesLeads, settings: salesSettings, rights: rightsPort },
    transactional: true,
    run: async ({ leads, settings, rights }, { id, to, reason }, context) => {
        const record = await leads.get(id)
        const lead = record === null ? null : leadRowOf(record)
        if (lead === null) return refusedWith("missing")
        const plan = planMove(
            lead.stage,
            to,
            reason ?? null,
            await settingsOf(settings),
            await rights.holds(context.memberId, SALES_APPROVE),
        )
        if (plan.kind === "refused") return refusedWith(plan.reason)
        const written = await leads.update(lead.id, lead.version, {
            stage: plan.stage,
            closedReason: plan.closedReason,
        })
        return written.ok ? { ok: true, data: { stage: plan.stage } } : writeRefusal(written)
    },
    refreshes: ["sales.leads", "sales.lead-counts", "sales.lead"],
    optimistic: true,
})
