import type { AuthorityRule, OptionalAuthorityRule, OptionalOperatingMode } from "./authority-rules.contracts"

const downgraded = (rule: AuthorityRule): AuthorityRule => ({ ...rule, mode: "ask" })

/**
 * What assist leaves as the owner set it: a reply inside the agent's rights, and a lead moved inside the business, which commits
 * nothing to the customer and spends nothing. The handover needs no approval, so the customer is not left waiting on a person.
 */
const ASSIST_KEEPS: ReadonlySet<string> = new Set(["reply_customer", "handoff_lead"])

/** True when assist mode makes this action ask a person although its rule says auto. */
export const assistAsks = (action: string): boolean => !ASSIST_KEEPS.has(action)

/**
 * Assist mode is a gate, not a rewrite of the owner's rules: while a module's operating mode is "assist", every "auto" rule
 * of that module behaves as "ask", except the actions `assistAsks` leaves out. "never" and limits stay untouched; autopilot, or no
 * installation, applies the rule as set.
 */
export const applyOperatingMode = (
    rule: OptionalAuthorityRule,
    operatingMode: OptionalOperatingMode,
): OptionalAuthorityRule =>
    rule !== null && operatingMode === "assist" && rule.mode === "auto" && assistAsks(rule.action)
        ? downgraded(rule)
        : rule
