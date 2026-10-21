import type { AgentHandoffRequest, ApprovalRequest, LeadDraft, ToolArgs } from "./agent-tools.contracts"
import { AgentToolsError, AgentToolsErrorCode } from "./errors/agent-tools.error"

/** A trimmed text clipped to `max` characters; empty when the value is not a text. */
export const clipText = (value: unknown, max: number): string =>
    typeof value === "string" ? value.trim().slice(0, max) : ""

/** A clipped text that must not be empty; throws ArgumentMissing naming the field. */
const requiredText = (args: ToolArgs, field: string, max: number): string => {
    const value = clipText(args[field], max)
    if (value === "") throw new AgentToolsError({ code: AgentToolsErrorCode.ArgumentMissing, params: { field } })
    return value
}

/** The knowledge query of a call. */
export const queryOf = (args: ToolArgs): string => requiredText(args, "query", 400)

/** The lead of a call: name and need are required, the contact is the phone else the email. */
export const leadOf = (args: ToolArgs): LeadDraft => {
    const contactName = requiredText(args, "contact_name", 120)
    const need = requiredText(args, "need", 600)
    const company = clipText(args.company, 120)
    const contact = clipText(args.phone, 40) || clipText(args.email, 120)
    return { contactName, need, company: company || null, contact: contact || null }
}

/** The approval request of a call: only an explicit unclear_outcome keeps that reason, anything else is over_authority. */
export const approvalOf = (args: ToolArgs): ApprovalRequest => {
    const question = requiredText(args, "question", 500)
    const proposed = clipText(args.proposed_answer, 1500)
    return {
        question,
        proposedAnswer: proposed || null,
        reason: args.reason === "unclear_outcome" ? "unclear_outcome" : "over_authority",
    }
}

/** The handoff reason of a call; may be empty. */
export const handoffReasonOf = (args: ToolArgs): string => clipText(args.reason, 300)

/** The agent hand-off of a call: both the target agent and the note are required. */
export const agentHandoffOf = (args: ToolArgs): AgentHandoffRequest => ({
    to: requiredText(args, "to", 120),
    note: requiredText(args, "note", 400),
})
