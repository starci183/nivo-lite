import type { ConversationLeadsGate, NativeCaller } from "../tools.contracts"

/** The argument an effect names a customer conversation in. */
const CONVERSATION_ARG = "conversationId"
/** The argument an effect names a lead in. */
const LEAD_ARG = "leadId"

/** Why a call was refused for reaching outside its run: a conversation or a lead that is not the run's, or one that cannot be checked. */
export type PinRefusal = "conversation_mismatch" | "lead_mismatch" | "conversation_unverified"

const textOf = (args: Readonly<Record<string, unknown>>, name: string): string | null => {
    const value = args[name]
    return typeof value === "string" && value !== "" ? value : null
}

/** The lead of a conversation, or undefined when no gate is bound to say. */
const leadOf = (
    gate: ConversationLeadsGate | null,
    workspaceId: string,
    conversationId: string,
): Promise<string | null | undefined> =>
    gate === null ? Promise.resolve(undefined) : gate.leadOf(workspaceId, conversationId)

/**
 * Whether an effect call stays inside its run. A run that serves a conversation reaches only that conversation, and only its lead when
 * the gate says which lead that is. A run with no conversation of its own but a lead (a workflow call, a timer) reaches only that lead and
 * the conversations of that lead; one the gate cannot check is refused. A run with neither (the system's own) is not pinned. Null when the
 * call may run.
 */
export const pinRefusalOf = async (
    gate: ConversationLeadsGate | null,
    workspaceId: string,
    caller: NativeCaller,
    args: Readonly<Record<string, unknown>>,
): Promise<PinRefusal | null> => {
    const conversationId = textOf(args, CONVERSATION_ARG)
    const leadId = textOf(args, LEAD_ARG)
    const runLead = caller.run?.leadId ?? null
    if (caller.conversationId !== null) {
        if (conversationId !== null && conversationId !== caller.conversationId) return "conversation_mismatch"
        if (leadId === null) return null
        const owner = await leadOf(gate, workspaceId, caller.conversationId)
        return owner === undefined || owner === leadId ? null : "lead_mismatch"
    }
    if (runLead === null) return null
    if (leadId !== null && leadId !== runLead) return "lead_mismatch"
    if (conversationId === null) return null
    const owner = await leadOf(gate, workspaceId, conversationId)
    if (owner === undefined) return "conversation_unverified"
    return owner === runLead ? null : "conversation_mismatch"
}
