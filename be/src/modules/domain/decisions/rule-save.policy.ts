import type { AuthorityRuleRecord, RuleChange } from "@modules/domain/authority-rules"

/** True when the saved rule can let an action run alone: it says auto, or it has an auto band under a mode that is not never. */
export const runsAlone = (change: RuleChange): boolean =>
    change.mode === "auto" || (change.mode !== "never" && change.auto_max != null)

/** The line of the evidence log for a saved rule: the mode, the old limit or the bands, and the approval settings it carried. */
export const ruleSummary = (saved: AuthorityRuleRecord, change: RuleChange): string => {
    const limit = change.limit_vnd === null ? "" : ` < ${change.limit_vnd}`
    const banded = change.auto_max != null || change.ask_max != null
    const bands = banded ? ` (${saved.unit}: auto <= ${change.auto_max ?? "-"}, ask <= ${change.ask_max ?? "-"})` : ""
    const policy = change.approval_policy === undefined ? "" : ` ${change.approval_policy}`
    const timeout = change.timeout_minutes === undefined ? "" : ` ${change.timeout_minutes}m`
    return `${saved.department}.${saved.action} -> ${saved.mode}${limit}${bands}${policy}${timeout}`
}
