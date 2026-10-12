import type { AuthorityRule, Department, FlowAction, RuleMode } from "@/lib/flow-types"
import { actionDef, listModules, moduleDef } from "@/lib/module-registry"

/** Departments and the actions each one can be granted, in display order. From the module registry (resources/modules/<key>/module.json). */
export const RULE_MATRIX: ReadonlyArray<{ readonly department: Department; readonly actions: ReadonlyArray<FlowAction> }> =
  listModules().map((m) => ({ department: m.key, actions: m.authorityActions.map((a) => a.action) }))

/** The groups to show: the stable modules always, any other module once its rules exist (installing a module adds them). */
export const visibleGroups = (rules: ReadonlyArray<AuthorityRule>): typeof RULE_MATRIX =>
  RULE_MATRIX.filter((g) => moduleDef(g.department).status === "stable" || rules.some((r) => r.department === g.department))

/** Actions where a VND limit is meaningful. */
export const AMOUNT_ACTIONS: ReadonlyArray<FlowAction> = listModules().flatMap((m) => m.authorityActions.filter((a) => a.amountLimit).map((a) => a.action))

/** The modes an action may be set to: an action the registry caps at "ask" (publishing) can never run alone. */
export const modesFor = (action: FlowAction): ReadonlyArray<RuleMode> => (actionDef(action).maxMode === null ? MODES : MODES.filter((mode) => mode !== "auto"))

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
