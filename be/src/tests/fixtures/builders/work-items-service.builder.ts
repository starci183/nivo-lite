import { AT, proposal } from "./work-items.builder"

/** The columns closing the shipped quote as done on the automatic path writes, the SQL expressions shown as their text. */
export const AUTO_DONE_COLUMNS = {
    status: "done",
    decidedPath: "auto",
    proposal,
    result: { summary: "Sent", href: "/q/1" },
    evidenceState: "captured",
    completedAt: AT,
    leasedAt: AT,
    error: null,
    leadId: "COALESCE(CAST(:leadId AS uuid), lead_id)",
    reason: "CASE WHEN CAST(:path AS text) = 'auto' THEN 'routine' ELSE reason END",
    reasons: "CASE WHEN CAST(:path AS text) = 'auto' THEN ARRAY['routine'] ELSE reasons END",
    missingFields: [],
}

/** The columns putting an item back to waiting for a decision while the field `need` is still missing writes. */
export const STILL_WAITING_COLUMNS = {
    status: "waiting_decision",
    proposal,
    missingFields: ["need"],
    reason: "missing_data",
    reasons: ["missing_data"],
    leasedAt: AT,
}
