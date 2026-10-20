import { isRecord, ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import { LeadActionsErrorCode } from "./errors/lead-actions.error"
import type { LeadAction, LeadActionInput } from "./lead-actions.contracts"

const ACTIONS: ReadonlySet<string> = new Set([
    "create",
    "refresh-context",
    "suggest-owner",
    "draft-execution",
    "settle-won",
])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu
const EMAIL_PART = /^[^\s@]+$/u
const NAME_MAX = 200
const CHANNEL_MAX = 100
const NEED_MAX = 2000
const PHONE_MAX = 80
const EMAIL_MAX = 320
const EVIDENCE_MAX = 2000

const isAction = (value: unknown): value is LeadAction => typeof value === "string" && ACTIONS.has(value)

/** Checks the email shape in linear scans, with text on both sides of a domain dot. */
const isEmail = (value: string): boolean => {
    const at = value.indexOf("@")
    const local = value.slice(0, at)
    const domain = value.slice(at + 1)
    const dot = domain.indexOf(".", 1)
    return at > 0 && EMAIL_PART.test(local) && EMAIL_PART.test(domain) && dot > 0 && dot < domain.length - 1
}

const textOf = (value: unknown, min: number, max: number): string | undefined => {
    if (typeof value !== "string" || value.length > max) return undefined
    const text = value.trim()
    return text.length >= min ? text : undefined
}

const optionalTextOf = (value: unknown, max: number): string | null | undefined => {
    if (value === undefined || value === null) return null
    const text = textOf(value, 0, max)
    return text === "" ? null : text
}

const uuidOf = (value: unknown): string | undefined => {
    const text = textOf(value, 36, 36)
    return text !== undefined && UUID.test(text) ? text : undefined
}

const createInputOf = (input: Record<string, unknown>): Outcome<LeadActionInput, LeadActionsErrorCode> => {
    const contactName = textOf(input.contactName, 2, NAME_MAX)
    if (contactName === undefined) return refused(LeadActionsErrorCode.InvalidInput, { field: "contactName" })
    const company = textOf(input.company, 2, NAME_MAX)
    if (company === undefined) return refused(LeadActionsErrorCode.InvalidInput, { field: "company" })
    const channel = textOf(input.channel, 1, CHANNEL_MAX)
    if (channel === undefined) return refused(LeadActionsErrorCode.InvalidInput, { field: "channel" })
    const need = textOf(input.need, 5, NEED_MAX)
    if (need === undefined) return refused(LeadActionsErrorCode.InvalidInput, { field: "need" })
    const phone = optionalTextOf(input.phone, PHONE_MAX)
    if (phone === undefined) return refused(LeadActionsErrorCode.InvalidInput, { field: "phone" })
    const email = optionalTextOf(input.email, EMAIL_MAX)
    if (email === undefined || (email !== null && !isEmail(email))) {
        return refused(LeadActionsErrorCode.InvalidInput, { field: "email" })
    }
    return ok({ contactName, company, channel, need, phone, email })
}

const targetInputOf = (
    action: Exclude<LeadAction, "create">,
    input: Record<string, unknown>,
): Outcome<LeadActionInput, LeadActionsErrorCode> => {
    if (action === "draft-execution") {
        const responsibilityId = uuidOf(input.responsibilityId)
        return responsibilityId === undefined
            ? refused(LeadActionsErrorCode.InvalidInput, { field: "responsibilityId" })
            : ok({ responsibilityId })
    }
    const leadId = uuidOf(input.leadId)
    if (leadId === undefined) return refused(LeadActionsErrorCode.InvalidInput, { field: "leadId" })
    if (action === "settle-won") {
        const evidence = optionalTextOf(input.evidence, EVIDENCE_MAX)
        return evidence === undefined
            ? refused(LeadActionsErrorCode.InvalidInput, { field: "evidence" })
            : ok({ leadId, evidence: evidence ?? "" })
    }
    return ok({ leadId })
}

/** Validates both an enqueue request and a persisted job input, retaining only this action's trimmed, bounded fields. */
export const inputOf = (action: unknown, input: unknown): Outcome<LeadActionInput, LeadActionsErrorCode> => {
    if (!isAction(action)) return refused(LeadActionsErrorCode.InvalidInput, { field: "action" })
    if (!isRecord(input) || Array.isArray(input)) return refused(LeadActionsErrorCode.InvalidInput, { field: "input" })
    return action === "create" ? createInputOf(input) : targetInputOf(action, input)
}
