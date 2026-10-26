import type { RuleChange } from "@modules/domain/authority-rules"
import type { OptionalActionRecord, OptionalRuleRefusal } from "./authority-actions.contracts"

/** True when the rule can let an action run alone: it says auto, or it has an auto band under a mode that is not never. */
export const runsAlone = (change: RuleChange): boolean =>
    change.mode === "auto" || (change.mode !== "never" && change.auto_max != null)

/**
 * The catalogue has the last word on a rule, whichever door it came through (the Authority page or the setup chat): the action must
 * be in the registry under the rule's department, and a rule that runs alone is refused for an action that can never run by itself.
 */
export const ruleRefusalOf = (record: OptionalActionRecord, change: RuleChange): OptionalRuleRefusal => {
    if (record?.module_key !== change.department) return "unknown_action"
    return runsAlone(change) && record.max_mode !== null ? "mode_capped" : null
}
