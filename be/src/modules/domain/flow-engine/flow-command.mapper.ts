import type { AuthorityPatch } from "@modules/domain/authority"
import type { RuleChange } from "@modules/domain/authority-rules"
import type { DecisionVerdict, FieldValue, WireEdits } from "@modules/domain/decisions"
import type { FlowPayload } from "@modules/domain/flows"
import type { InboxSimulationInput } from "@modules/domain/inbox-simulation"
import type { StaffWrite } from "@modules/domain/staff"
import type { Locale } from "@modules/platform/i18n"
import { RULE_MODES } from "./authority-chat.policy"
import { FlowEngineError, FlowEngineErrorCode } from "./errors/flow-engine.error"

const CHANNELS: ReadonlyArray<InboxSimulationInput["channel"]> = [
    "zalo",
    "facebook",
    "email",
    "phone",
    "bank",
    "manual",
]
const SIMULATED_KINDS: ReadonlyArray<InboxSimulationInput["kind"]> = ["message", "order", "payment"]
const VERDICTS: ReadonlyArray<DecisionVerdict> = ["approved", "rejected"]
const TEXT_FIELDS = ["policies", "reply_style", "brand_voice", "limits_note", "goal_note"] as const
const GOAL_FIELDS = ["goal_revenue_vnd", "goal_new_customers", "goal_first_reply_minutes"] as const

const invalid = (field: string): FlowEngineError =>
    new FlowEngineError({ code: FlowEngineErrorCode.InvalidPayload, params: { field } })

const isRecord = (value: unknown): value is FlowPayload =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** The first present value among the names (camelCase or the old snake_case). */
const pick = (payload: FlowPayload, names: ReadonlyArray<string>): unknown =>
    names.map((name) => payload[name]).find((value) => value !== undefined)

const optionalText = (payload: FlowPayload, ...names: Array<string>): string | null => {
    const value = pick(payload, names)
    if (value === undefined || value === null) return null
    if (typeof value !== "string") throw invalid(names[0] ?? "")
    return value
}

const text = (payload: FlowPayload, ...names: [string, ...Array<string>]): string => {
    const value = optionalText(payload, ...names)
    if (value === null) throw invalid(names[0])
    return value
}

const optionalNumber = (payload: FlowPayload, ...names: [string, ...Array<string>]): number | null => {
    const value = pick(payload, names)
    if (value === undefined || value === null) return null
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw invalid(names[0])
    return value
}

const optionalBoolean = (payload: FlowPayload, ...names: [string, ...Array<string>]): boolean | null => {
    const value = pick(payload, names)
    if (value === undefined || value === null) return null
    if (typeof value !== "boolean") throw invalid(names[0])
    return value
}

const oneOf = <T extends string>(
    payload: FlowPayload,
    allowed: ReadonlyArray<T>,
    ...names: [string, ...Array<string>]
): T => {
    const value = pick(payload, names)
    const found = allowed.find((option) => option === value)
    if (found === undefined) throw invalid(names[0])
    return found
}

/** The language of the generated text: the payload's `locale`, Vietnamese when it names none. */
export const localeOf = (payload: FlowPayload): Locale => (payload.locale === "en" ? "en" : "vi")

/** The text of an Office message. */
export const chatTextOf = (payload: FlowPayload): string => text(payload, "text", "body")

/** The authority sheet fields the payload sets; omitted fields stay. */
export const authorityPatchOf = (payload: FlowPayload): AuthorityPatch => {
    const patch: Record<string, string | number | null> = {}
    for (const field of TEXT_FIELDS) {
        if (payload[field] === undefined) continue
        patch[field] = text(payload, field)
    }
    for (const field of GOAL_FIELDS) {
        if (payload[field] === undefined) continue
        const value = optionalNumber(payload, field)
        patch[field] = value === null ? null : Math.round(value)
    }
    return patch
}

/** The rule of one action the payload saves. */
export const ruleChangeOf = (payload: FlowPayload): RuleChange => {
    const limit = optionalNumber(payload, "limit_vnd", "limitVnd")
    const required = pick(payload, ["required_fields", "requiredFields"]) ?? []
    if (!Array.isArray(required) || !required.every((field) => typeof field === "string"))
        throw invalid("required_fields")
    return {
        action: text(payload, "action"),
        department: text(payload, "department"),
        mode: oneOf(payload, RULE_MODES, "mode"),
        limit_vnd: limit === null ? null : Math.round(limit),
        required_fields: required.map(String),
        note: optionalText(payload, "note"),
    }
}

/** The staff row the payload adds or replaces. */
export const staffWriteOf = (workspaceId: string, payload: FlowPayload): StaffWrite => ({
    workspaceId,
    id: optionalText(payload, "id"),
    name: text(payload, "name"),
    role: optionalText(payload, "role") ?? "",
    email: optionalText(payload, "email"),
    active: optionalBoolean(payload, "active"),
})

/** The waiting item the payload names. */
export const workItemIdOf = (payload: FlowPayload): string => text(payload, "workItemId", "work_item_id")

/** The verdict the payload gives. */
export const verdictOf = (payload: FlowPayload): DecisionVerdict => oneOf(payload, VERDICTS, "decision")

/** What the person changed before approving, as the payload carries it. */
export const editsOf = (payload: FlowPayload): WireEdits => {
    const edits = payload.edits
    if (edits === undefined || edits === null) return {}
    if (!isRecord(edits)) throw invalid("edits")
    const draft = optionalText(edits, "draft")
    const candidateId = optionalText(edits, "candidateId", "candidate_id")
    const fields = edits.fields
    return {
        ...(draft === null ? {} : { draft }),
        ...(edits.amount_vnd === undefined ? {} : { amount_vnd: optionalNumber(edits, "amount_vnd") }),
        ...(candidateId === null ? {} : { candidateId }),
        ...(fields === undefined || fields === null ? {} : { fields: fieldValuesOf(fields) }),
    }
}

/** The name and value pairs of fields in the wire list form or the old record form; a malformed entry has no string name. */
const entriesOf = (fields: unknown): Array<[unknown, unknown]> => {
    if (Array.isArray(fields))
        return fields.map((field): [unknown, unknown] =>
            isRecord(field) ? [field.name, field.text ?? field.number] : [null, null],
        )
    return isRecord(fields) ? Object.entries(fields) : []
}

/** Named fields as a list (the wire form), or the old record form turned into one. */
const fieldValuesOf = (fields: unknown): Array<FieldValue> => {
    return entriesOf(fields).map(([name, value]) => {
        if (typeof name !== "string") throw invalid("edits.fields")
        if (typeof value === "string") return { name, text: value }
        if (typeof value === "number" && Number.isFinite(value)) return { name, number: value }
        throw invalid(`edits.fields.${name}`)
    })
}

/** A note, or nothing. */
export const noteOf = (payload: FlowPayload, name: string): string | undefined =>
    optionalText(payload, name) ?? undefined

/** The staff member to give the item to, or null to take it back. */
export const staffIdOf = (payload: FlowPayload): string | null => optionalText(payload, "staffId", "staff_id")

/** The simulated input the payload describes. */
export const simulationOf = (payload: FlowPayload): InboxSimulationInput => ({
    channel: oneOf(payload, CHANNELS, "channel"),
    kind: oneOf(payload, SIMULATED_KINDS, "kind"),
    senderName: optionalText(payload, "senderName", "sender_name") ?? "",
    senderContact: optionalText(payload, "senderContact", "sender_contact"),
    body: optionalText(payload, "body"),
    amountVnd: optionalNumber(payload, "amountVnd", "amount_vnd"),
    externalRef: optionalText(payload, "externalRef", "external_ref"),
    items: optionalText(payload, "items"),
    eventId: optionalText(payload, "eventId", "event_id"),
    locale: localeOf(payload),
})

/** The customer conversation the payload names. */
export const conversationIdOf = (payload: FlowPayload): string => text(payload, "conversationId", "conversation_id")

/** True to take the conversation over, false to hand it back to the AI. */
export const takeOf = (payload: FlowPayload): boolean => optionalBoolean(payload, "take", "takeOver") ?? true
