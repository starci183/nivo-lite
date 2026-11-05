import { evaluateGate } from "@modules/domain/authority-rules"
import type { OptionalAuthorityRule } from "@modules/domain/authority-rules"
import type { ProposalFieldValue } from "@modules/domain/work-items"

/** What the authority rules say about an action a member started: run it, refuse it, or ask a person first. */
export type AuthorityDecision = "allow" | "deny" | "ask"

/** The payload keys that are numbers or text; the gate reads required fields and amounts from them. */
const fieldsOf = (input: Readonly<Record<string, unknown>>): Readonly<Record<string, ProposalFieldValue>> =>
    Object.fromEntries(
        Object.entries(input).flatMap(([key, value]): Array<readonly [string, ProposalFieldValue]> =>
            typeof value === "string" || typeof value === "number" || value === null ? [[key, value]] : [],
        ),
    )

/** The money an action names in its input (`amount_vnd`), or null. */
const amountVndOf = (input: Readonly<Record<string, unknown>>): number | null => {
    const amount = input.amount_vnd
    return typeof amount === "number" ? amount : null
}

/**
 * The decision for an action. An action the owner set no rule for runs (the default is allow). With a rule, the gate judges the
 * action by the payload as a proposal: "auto" runs, "never" (`not_allowed`) is refused, and any other reason (an amount over the
 * limit, a field still missing, a rule that asks) asks a person.
 */
export const authorityDecisionOf = (
    rule: OptionalAuthorityRule,
    action: string,
    input: Readonly<Record<string, unknown>>,
): AuthorityDecision => {
    if (rule === null) return "allow"
    const verdict = evaluateGate({
        action,
        rule,
        maxMode: null,
        proposal: { summary: action, amount_vnd: amountVndOf(input), fields: fieldsOf(input) },
    })
    if (verdict.verdict === "auto") return "allow"
    return verdict.reason === "not_allowed" ? "deny" : "ask"
}
