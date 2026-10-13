import type { ProposedResponsibility } from "@modules/integrations/deepseek"
import { isRecord, ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import { LeadActionsErrorCode } from "./errors/lead-actions.error"

const TITLE_MAX = 200
const NEXT_ACTION_MAX = 1000
const RATIONALE_MAX = 2000
const HANDLE_MAX = 64
const MAX_DUE_DAYS = 365

const textOf = (value: unknown, min: number, max: number): string | undefined => {
    if (typeof value !== "string" || value.length > max) return undefined
    const text = value.trim()
    return text.length >= min ? text : undefined
}

/** Bounds an AI-generated owner proposal before any responsibility, evidence or message can be written. */
export const ownerProposalOf = (proposal: unknown): Outcome<ProposedResponsibility, LeadActionsErrorCode> => {
    if (!isRecord(proposal) || Array.isArray(proposal)) {
        return refused(LeadActionsErrorCode.InvalidInput, { field: "proposal" })
    }
    const title = textOf(proposal.title, 1, TITLE_MAX)
    if (title === undefined) return refused(LeadActionsErrorCode.InvalidInput, { field: "title" })
    const nextAction = textOf(proposal.next_action, 1, NEXT_ACTION_MAX)
    if (nextAction === undefined) return refused(LeadActionsErrorCode.InvalidInput, { field: "next_action" })
    const rationale = textOf(proposal.rationale, 0, RATIONALE_MAX)
    if (rationale === undefined) return refused(LeadActionsErrorCode.InvalidInput, { field: "rationale" })
    const kind = proposal.owner_kind
    if (kind !== "human" && kind !== "agent") {
        return refused(LeadActionsErrorCode.InvalidInput, { field: "owner_kind" })
    }
    const handle = proposal.owner_handle === null ? null : textOf(proposal.owner_handle, 0, HANDLE_MAX)
    if (handle === undefined || (kind === "agent" && (handle === null || handle === ""))) {
        return refused(LeadActionsErrorCode.InvalidInput, { field: "owner_handle" })
    }
    const dueDays = proposal.due_in_days
    if (typeof dueDays !== "number" || !Number.isFinite(dueDays) || dueDays < 0 || dueDays > MAX_DUE_DAYS) {
        return refused(LeadActionsErrorCode.InvalidInput, { field: "due_in_days" })
    }
    return ok({
        title,
        owner_kind: kind,
        owner_handle: kind === "human" ? null : handle,
        next_action: nextAction,
        due_in_days: dueDays,
        rationale,
    })
}
