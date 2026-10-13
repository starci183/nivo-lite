"use server"
import "server-only"

import { revalidatePath } from "next/cache"
import { runWork } from "@/lib/engine"
import { drainAfter, engineCtx } from "@/lib/flow-ctx"
import { emitEvent } from "@/lib/outbound-events"
import type { Outcome } from "@/lib/types"

/**
 * Wave-3 shim: what still runs inside the Next app after the back end recorded a won deal (the stage, the evidence line, the team-chat
 * line and the hand-over responsibility are the back end own). The invoice step goes through the authority gate and the automations hear
 * "deal.won". The lead is read again from the workspace, so a forged id changes nothing.
 */
export const settleWonDeal = async (leadId: string, evidence: string): Promise<Outcome<null>> => {
    try {
        const c = await engineCtx()
        const { data: lead } = await c.db
            .from("leads")
            .select("*")
            .eq("id", leadId)
            .eq("workspace_id", c.ws)
            .maybeSingle()
        if (!lead || lead.stage !== "won") return { ok: false, error: "not won" }
        await runWork(c, {
            action: "issue_invoice",
            subject_type: "lead",
            subject_id: leadId,
            lead_id: leadId,
            origin: lead.origin === "simulated" ? "simulated" : "live",
            dedupeKey: `issue_invoice:lead:${leadId}`,
            seed: { amount_vnd: null, fields: {} },
        })
        drainAfter(c)
        await emitEvent(
            c.ws,
            "deal.won",
            {
                lead_id: leadId,
                name: lead.contact_name,
                company: lead.company,
                channel: lead.channel,
                need: lead.need,
                evidence: evidence || null,
            },
            `deal.won:${leadId}`,
        )
        revalidatePath("/", "layout")
        return { ok: true, data: null }
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
}
