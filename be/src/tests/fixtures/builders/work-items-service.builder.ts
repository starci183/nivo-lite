import type { Proposal } from "@modules/domain/work-items"
import { AT, proposal } from "./work-items.builder"

type AutoDoneColumnsResultShape = {
    summary: string
    href: string
}

type AutoDoneColumnsShape = {
    status: string
    decidedPath: string
    proposal: Proposal
    result: AutoDoneColumnsResultShape
    evidenceState: string
    completedAt: Date
    leasedAt: Date
    error: null
    leadId: string
    reason: string
    reasons: string
    missingFields: Array<never>
}

/** The columns closing the shipped quote as done on the automatic path writes, the SQL expressions shown as their text. */
export const AUTO_DONE_COLUMNS: AutoDoneColumnsShape = {
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

type StillWaitingColumnsShape = {
    status: string
    proposal: Proposal
    missingFields: Array<string>
    reason: string
    reasons: Array<string>
    leasedAt: Date
}

/** The columns putting an item back to waiting for a decision while the field `need` is still missing writes. */
export const STILL_WAITING_COLUMNS: StillWaitingColumnsShape = {
    status: "waiting_decision",
    proposal,
    missingFields: ["need"],
    reason: "missing_data",
    reasons: ["missing_data"],
    leasedAt: AT,
}
