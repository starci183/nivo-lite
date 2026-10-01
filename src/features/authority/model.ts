import type { AuthorityRule, Department, FlowAction, RuleMode } from "@/lib/flow-types"

/** Departments and the actions each one can be granted, in display order. */
export const RULE_MATRIX: ReadonlyArray<{ readonly department: Department; readonly actions: ReadonlyArray<FlowAction> }> = [
  { department: "chatbot", actions: ["reply_customer", "handoff_lead"] },
  { department: "sales", actions: ["classify_lead", "send_follow_up", "send_quote", "confirm_order", "send_care"] },
  { department: "accounting", actions: ["issue_invoice", "reconcile_payment"] },
]

/** Actions where a VND limit is meaningful. */
export const AMOUNT_ACTIONS: ReadonlyArray<FlowAction> = ["send_quote", "confirm_order", "issue_invoice", "reconcile_payment"]

/** Details an action can require before NIVO acts alone. */
export const FIELD_KEYS = ["contact_name", "need", "contact", "customer", "items", "amount_vnd"] as const

/** The three modes, in display order. */
export const MODES: ReadonlyArray<RuleMode> = ["auto", "ask", "never"]

/** Editable slice of a rule. */
export type RuleDraft = { readonly mode: RuleMode; readonly limit: number | null; readonly required: ReadonlyArray<string> }

/** Key of a rule in draft maps. */
export const ruleKey = (department: Department, action: FlowAction): string => `${department}.${action}`

/** Draft map from stored rules; an action without a stored rule starts as "ask first". */
export const draftsFrom = (rules: ReadonlyArray<AuthorityRule>): Record<string, RuleDraft> => {
  const out: Record<string, RuleDraft> = {}
  for (const group of RULE_MATRIX) {
    for (const action of group.actions) {
      const rule = rules.find((r) => r.department === group.department && r.action === action)
      out[ruleKey(group.department, action)] = { mode: rule?.mode ?? "ask", limit: rule?.limit_vnd ?? null, required: rule?.required_fields ?? [] }
    }
  }
  return out
}

/** Number field value: empty is NaN. */
export const toField = (n: number | null): number => (n === null ? Number.NaN : n)

/** Number from a number field: NaN means empty. */
export const fromField = (n: number): number | null => (Number.isFinite(n) ? n : null)
