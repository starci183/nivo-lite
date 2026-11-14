import { LOCKED_ARGUMENTS, isLockedContextRead } from "@modules/domain/context-sources"
import type { ToolArgument } from "./tools.contracts"

/** The checked arguments of a call. */
export type LockedCallArguments = Readonly<Record<string, ToolArgument>>

/** The run's own subject as its token carries it: the route, the contact and the lead, each null when the run has none. */
export interface LockedSubjectClaims {
    readonly conversationId: string | null
    readonly contactId?: string | null | undefined
    readonly leadId?: string | null | undefined
}

/** The arguments a call runs with after the hard lock of a context read, or why the lock refused it. */
export type LockedArguments =
    | { readonly kind: "ok"; readonly args: LockedCallArguments }
    | { readonly kind: "refused"; readonly reason: "other_conversation" | "other_contact" | "other_lead" }

/**
 * The hard lock of the context reads (`nivo.tool.conversation.*`, `nivo.tool.contact.get`, `nivo.tool.lead.*`): they take no conversation,
 * contact or lead id from the model. A call that names one other than the run's own (from the run token: its conversation, its contact,
 * the sales lead its subject names) is refused here, before the gateway and its executor; the run's own ids are then filled in from the
 * token, never from what the call says: EVERY member of `LOCKED_ARGUMENTS` the token carries, for every locked read (the rule every locked
 * read's schema follows: `lockedArgumentsShape`, ruling R51 item 1). Any other tool runs with its arguments as given.
 */
export const lockedArgumentsOf = (tool: string, claims: LockedSubjectClaims, args: LockedCallArguments): LockedArguments => {
    if (!isLockedContextRead(tool)) return { kind: "ok", args }
    const own = { conversationId: claims.conversationId, contactId: claims.contactId ?? null, leadId: claims.leadId ?? null }
    for (const name of LOCKED_ARGUMENTS) {
        const named = args[name]
        if (named !== undefined && named !== own[name]) {
            return {
                kind: "refused",
                reason: name === "conversationId" ? "other_conversation" : name === "contactId" ? "other_contact" : "other_lead",
            }
        }
    }
    const filled = Object.fromEntries(Object.entries(own).filter((entry): entry is [string, string] => entry[1] !== null))
    return { kind: "ok", args: { ...args, ...filled } }
}
