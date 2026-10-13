import type { AuthorityRule, OptionalAuthorityRule, OptionalOperatingMode } from "./authority-rules.contracts"

const downgraded = (rule: AuthorityRule): AuthorityRule => ({ ...rule, mode: "ask" })

/**
 * Assist mode is a gate, not a rewrite of the owner's rules: while a module's operating mode is "assist", every "auto" rule
 * of that module behaves as "ask". "never" and limits stay untouched; autopilot, or no installation, applies the rule as set.
 */
export const applyOperatingMode = (
    rule: OptionalAuthorityRule,
    operatingMode: OptionalOperatingMode,
): OptionalAuthorityRule =>
    rule !== null && operatingMode === "assist" && rule.mode === "auto" ? downgraded(rule) : rule
