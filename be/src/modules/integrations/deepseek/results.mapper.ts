import type {
    AuthorityChange,
    AuthorityGoals,
    AuthorityRuleChange,
    Classification,
    DesignedModule,
    ExtractedOrder,
    ProposedResponsibility,
} from "./deepseek.contracts"
import {
    numberMember,
    optionalStringMember,
    recordListMember,
    recordMember,
    stringListMember,
    stringMember,
} from "./json.mapper"
import type { JsonRecord } from "./json.mapper"

const STAGES: ReadonlyArray<Classification["stage"]> = ["new", "qualified", "proposal", "won", "lost"]
const MODES = ["auto", "ask", "never"] as const
const CONFIDENCE_FALLBACK = 0.5

const stageOf = (value: string | null): Classification["stage"] => STAGES.find((stage) => stage === value) ?? "new"

/** Reads the model's classification: an unknown stage is `new`, the confidence is clamped to 0..1. */
export const classificationOf = (record: JsonRecord): Classification => ({
    stage: stageOf(optionalStringMember(record, "stage")),
    confidence: Math.max(0, Math.min(1, numberMember(record, "confidence", CONFIDENCE_FALLBACK))),
    next_action: stringMember(record, "next_action", ""),
    missing: stringListMember(record, "missing"),
    context: stringMember(record, "context", ""),
})

/** Reads an order out of free text: a total that is not a non-negative finite number is null, never guessed. */
export const extractedOrderOf = (record: JsonRecord): ExtractedOrder => {
    const amount = numberMember(record, "amount_vnd", -1)
    return {
        items: stringMember(record, "items", ""),
        amount_vnd: amount >= 0 ? Math.round(amount) : null,
        confidence: numberMember(record, "confidence", CONFIDENCE_FALLBACK),
    }
}

/** Reads the responsibility the model proposed. */
export const responsibilityOf = (record: JsonRecord): ProposedResponsibility => ({
    title: stringMember(record, "title", ""),
    owner_kind: record["owner_kind"] === "agent" ? "agent" : "human",
    owner_handle: optionalStringMember(record, "owner_handle"),
    next_action: stringMember(record, "next_action", ""),
    due_in_days: numberMember(record, "due_in_days", 1),
    rationale: stringMember(record, "rationale", ""),
})

/** Reads the agent definition the model designed. */
export const designedModuleOf = (record: JsonRecord): DesignedModule => ({
    name: stringMember(record, "name", ""),
    handle: stringMember(record, "handle", ""),
    role: stringMember(record, "role", ""),
    instructions: stringMember(record, "instructions", ""),
})

const optionalNumber = (record: JsonRecord, key: string): number | null => {
    const value = numberMember(record, key, Number.NaN)
    return Number.isNaN(value) ? null : value
}

const goalsOf = (record: JsonRecord): AuthorityGoals => ({
    revenue_vnd: optionalNumber(record, "revenue_vnd"),
    new_customers: optionalNumber(record, "new_customers"),
    first_reply_minutes: optionalNumber(record, "first_reply_minutes"),
    note: optionalStringMember(record, "note"),
})

const ruleChangeOf = (record: JsonRecord): AuthorityRuleChange => ({
    action: stringMember(record, "action", ""),
    mode: MODES.find((mode) => mode === optionalStringMember(record, "mode")) ?? null,
    limit_vnd: optionalNumber(record, "limit_vnd"),
})

/** Reads the owner's grant of authority out of the model's answer; only rules that name an action are kept. */
export const authorityChangeOf = (record: JsonRecord): AuthorityChange => ({
    goals: goalsOf(recordMember(record, "goals")),
    policies_add: stringListMember(record, "policies_add").filter((policy) => policy !== ""),
    reply_style: optionalStringMember(record, "reply_style"),
    brand_voice: optionalStringMember(record, "brand_voice"),
    limits_note_add: optionalStringMember(record, "limits_note_add"),
    rules: recordListMember(record, "rules")
        .map(ruleChangeOf)
        .filter((rule) => rule.action !== ""),
    understood: record["understood"] !== false,
})
