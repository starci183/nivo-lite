import type { AiBudget } from "./ai.contracts"

// The lane's intended effort of every kind of model call, in one table (coordinator 2026-11-11, D-BR-2/D-BR-3): a yes/no or a
// reading of a document needs no hidden thinking; an agent's short answer to a person thinks a little; a multi-step tool turn that
// writes money or an order thinks more. `AiClient` maps an effort to each model family's own request fields
// (`anthropic-thinking.policy.ts`). Each kind is its own constant so a live test can flip one.

/**
 * The same-meaning judge: are two truths the same thing, the same value, the same scope. `high`, the model's own default (owner
 * 2026-11-12, "raise to high"; cost is no constraint): a wrong "same" merges two truths and a wrong "different" lets a contradiction
 * stand as two truths in force, so the judge is never asked to think less than it would by itself. It ran with thinking off.
 */
export const JUDGE_EFFORT: AiBudget["effort"] = "high"

/**
 * The most tokens one same-meaning verdict may write, its reasoning included (thinking counts toward the cap): the verdict itself
 * is about 15 tokens, about 150 with a fence and a sentence around it; the rest is room for the reasoning before it at effort high.
 * A cap is not spent unless the model writes that much.
 */
export const JUDGE_MAX_TOKENS = 8000

/**
 * The cap of the ONE try after a verdict that was still cut (told by its finish reason): twice the first, so the second try is
 * never the first one sent again to be cut at the same place.
 */
export const JUDGE_RETRY_MAX_TOKENS = 16_000

/**
 * The triage of a passage: does it state a rule of the shop. `high` (owner 2026-11-12, "raise to high"; cost is not a constraint):
 * a rule lost here is lost for good (Round T: a list of purchase rules triaged none). The call's cap leaves room for the reasoning
 * (`brain/passage-triage.policy.ts` `triageMaxTokensOf`).
 */
export const TRIAGE_EFFORT: AiBudget["effort"] = "high"

/** What a whole document is, and each of its tables (the document map, TRIAGE-2): `high`, as triage (owner 2026-11-12). */
export const NATURE_EFFORT: AiBudget["effort"] = "high"

/**
 * The reading of the truths a passage states: `high` (owner 2026-11-12): every line is read or accounted for, and a dated window, a
 * per-item list or a closure is worked out before it is written. Cap: `brain/document-truth-stages.service.ts` `TRUTHS_BUDGET`.
 */
export const EXTRACTION_EFFORT: AiBudget["effort"] = "high"

/** The relations between the truths of one document. */
export const RELATIONS_EFFORT: AiBudget["effort"] = "off"

/**
 * The critic of a shop document (it only looks for text addressed to an AI, on the endpoint's chat profile) and of a dossier: no
 * hidden thinking, the answer is a short closed list.
 */
export const CRITIC_EFFORT: AiBudget["effort"] = "off"

/**
 * The reading of what a manager wrote in the Office chat (a decision on waiting work, a grant of authority), on the strong model
 * (owner 2026-11-12: a model reads what words mean, code never does). The answer approves or rejects real work and changes what the
 * agents may do alone, so it thinks a little before it answers; the answer itself is a small closed object.
 */
export const OFFICE_READING_EFFORT: "low" | "medium" = "low"

/** The most tokens one Office reading may write, its reasoning included: a closed answer of a few hundred tokens and room to think. */
export const OFFICE_READING_MAX_TOKENS = 4000

/** The policy derive pass over the truths in force. */
export const DERIVE_EFFORT: AiBudget["effort"] = "off"

/** An agent turn of a light step: a short answer to a customer or a colleague (consult, front desk, team chat, notices). */
export const CHAT_TURN_EFFORT: TurnEffort = "low"

/** An agent turn of a heavy step: several tool calls that write an order or money (create order, payment, reconcile, ledger). */
export const MULTI_STEP_TURN_EFFORT: TurnEffort = "medium"

/** The weight blocks-core declares for a step. */
export type TurnWeight = "light" | "heavy"

/** The effort of an agent turn. */
export type TurnEffort = "low" | "medium"

/** The effort of an agent turn by the weight blocks-core declares for its step. */
export const turnEffortOf = (weight: TurnWeight): TurnEffort =>
    weight === "heavy" ? MULTI_STEP_TURN_EFFORT : CHAT_TURN_EFFORT
