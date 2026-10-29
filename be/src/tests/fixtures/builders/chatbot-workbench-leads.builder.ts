import type { LeadAutomationReadService, LeadView } from "@modules/domain/leads"
import { LEAD } from "./chatbot-workbench.builder"

/** The lead as the board reads it, when the overview folds in names and capture dates. */
export const LEAD_VIEW: LeadView = {
    id: "l-1",
    contact_name: "Hoa",
    company: "Hoa Shop",
    channel: "zalo",
    need: "T-shirts",
    stage: "new",
    context_summary: null,
    installation_id: null,
    created_at: "2026-10-12T00:00:00.000Z",
}

/** The lead as an automation executor reads it, the thread's customer facts. */
export const LEAD_READ: NonNullable<Awaited<ReturnType<LeadAutomationReadService["lead"]>>> = {
    ...LEAD,
    channel: "zalo",
}
