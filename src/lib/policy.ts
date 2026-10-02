/**
 * NIVO CORE policy gate: pure, no I/O (unit-checked by scripts/policy-check.mjs).
 * Decides whether an AI step runs by itself ("auto") or asks a human ("ask"), and why.
 */
import type { AuthorityRule, Department, FlowAction, GateInput, GateVerdict, Proposal, ReasonCode, RuleMode } from "./flow-types";
import { ACTION_MODULE, actionDef, listModules } from "./module-registry";

/** Which department (module) performs each action. Derived from the module registry (resources/modules/<key>/module.json authority_actions). */
export const ACTION_DEPARTMENT: Record<FlowAction, Department> = ACTION_MODULE;

export type DefaultRule = { department: Department; action: FlowAction; mode: RuleMode; limit_vnd: number | null; required_fields: Array<string> };

const rulesOf = (m: ReturnType<typeof listModules>[number]): Array<DefaultRule> =>
  m.authorityActions.map((a) => ({ department: m.key, action: a.action, mode: a.mode, limit_vnd: a.limitVnd, required_fields: [...a.requiredFields] }));

/** The authority a new workspace starts with (FLOW-PLAN §b), from the registry: the stable modules. The owner changes these on /authority. An early module seeds its own rows when it is installed (see defaultRulesOf). */
export const DEFAULT_RULES: Array<DefaultRule> = listModules().filter((m) => m.status === "stable").flatMap(rulesOf);

/** The default rules of one module (what installing it grants), whatever its status. */
export const defaultRulesOf = (department: Department): Array<DefaultRule> => listModules().filter((m) => m.key === department).flatMap(rulesOf);

/**
 * The hand-off chain between departments. After an item is done, each next action is queued for the same subject
 * (declared per action as `next` in the registry).
 * inbound message/lead → handoff_lead → classify_lead → send_follow_up
 * inbound order → confirm_order → issue_invoice
 * inbound payment → reconcile_payment → send_care (back to the Chatbot conversation)
 */
export const FLOW_NEXT: Record<FlowAction, Array<FlowAction>> = Object.fromEntries(
  listModules().flatMap((m) => m.authorityActions.map((a) => [a.action, [...a.next]] as const)),
) as Record<FlowAction, Array<FlowAction>>;

/**
 * Limit semantics (product copy: "Sales tự xác nhận đơn DƯỚI 20 triệu"): `limit_vnd` is the amount the action runs by
 * itself strictly BELOW. `amount >= limit_vnd` asks a human (over_authority); `null` means no amount limit.
 * The same rule holds for every limited action (confirm_order, issue_invoice, reconcile_payment, send_quote).
 */
export const isOverLimit = (limit_vnd: number | null | undefined, amount_vnd: number | null | undefined): boolean =>
  typeof limit_vnd === "number" && typeof amount_vnd === "number" && amount_vnd >= limit_vnd;

/**
 * Assist mode is a gate, not a rewrite of the owner's rules: while a module's operating_mode is "assist", every "auto"
 * rule of that department behaves as "ask" at evaluation time. "never" and limits stay untouched; autopilot (or no
 * installation row, older workspaces) applies the rules as configured.
 */
export const applyOperatingMode = <R extends { mode: RuleMode }>(rule: R | null, operatingMode: string | null | undefined): R | null =>
  rule && operatingMode === "assist" && rule.mode === "auto" ? { ...rule, mode: "ask" } : rule;

/** The confidence below which NIVO treats its own result as unclear. */
export const MIN_CONFIDENCE = 0.6;

const isEmpty = (v: unknown) => v === null || v === undefined || (typeof v === "string" && v.trim() === "");

/** The value of a required field: `amount_vnd` may live on the proposal itself or in its fields. */
const fieldValue = (p: Proposal, f: string) => (f === "amount_vnd" ? p.amount_vnd ?? p.fields?.amount_vnd ?? null : p.fields?.[f] ?? null);

/** Required fields the proposal does not have yet. */
export const missingFields = (rule: Pick<AuthorityRule, "required_fields"> | null, p: Proposal): Array<string> =>
  (rule?.required_fields ?? []).filter((f) => isEmpty(fieldValue(p, f)));

/**
 * The gate. Checks in precedence order, all reasons collected, the first one is `reason`:
 * 1 not_allowed (no rule / never) · 2 missing_data · 3 over_authority (amount >= limit: auto only strictly below the limit)
 * · 4 unclear_outcome (confidence < 0.6, outcome unclear, or not exactly one candidate) · 5 over_authority (mode ask).
 * humanApproved skips 3 and 5 (never 2: approving cannot supply missing data). `humanApproved` must only be passed for
 * the SAME work item the human decided on: an approval never carries over to another action or department
 * (`GateInput.priorApproval` is deliberately ignored; Sales approving a 45M order does not let Accounting invoice 45M).
 */
export const evaluateGate = (input: GateInput): GateVerdict => {
  const { proposal, humanApproved = false } = input;
  // An action the registry caps at "ask" (publish a video or a post) never runs alone, whatever a stored rule says.
  const cap = input.rule && input.rule.mode === "auto" ? actionDef(input.action).maxMode : null;
  const rule = cap !== null && input.rule ? { ...input.rule, mode: cap } : input.rule;
  const reasons: Array<ReasonCode> = [];
  const add = (r: ReasonCode) => {
    if (!reasons.includes(r)) reasons.push(r);
  };

  // 1. Not granted
  if (!rule || rule.mode === "never") add("not_allowed");

  // 2. Missing data
  const missing = missingFields(rule, proposal);
  if (missing.length) add("missing_data");

  // 3. Over the amount limit
  const amount = typeof proposal.amount_vnd === "number" ? proposal.amount_vnd : null;
  if (!humanApproved && rule && isOverLimit(rule.limit_vnd, amount)) add("over_authority");

  // 4. Unclear outcome
  const lowConfidence = typeof proposal.confidence === "number" && proposal.confidence < MIN_CONFIDENCE;
  const badCandidates = Array.isArray(proposal.candidates) && proposal.candidates.length !== 1;
  if (lowConfidence || proposal.outcome === "unclear" || badCandidates) add("unclear_outcome");

  // 5. Outside the automatic scope
  if (!humanApproved && rule && rule.mode === "ask") add("over_authority");

  if (!reasons.length) return { verdict: "auto", reason: "routine", reasons: ["routine"], missing: [] };
  return { verdict: "ask", reason: reasons[0], reasons, missing };
};
