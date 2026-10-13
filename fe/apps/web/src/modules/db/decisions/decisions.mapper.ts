import type { Database } from "../../../../../../../supabase/types/database.types"
import type { DeciderKind, DecisionOutcome, DecisionRecord, GateReason } from "@/modules/types"

type Tables = Database["public"]["Tables"]

/** One generated row of public.decisions. */
export type DecisionsRow = Tables["decisions"]["Row"]

/** A decision row with the name of the customer embedded by the query. */
export type DecisionWithLeadRow = DecisionsRow & { readonly lead: { readonly contact_name: string } | null }

const DECIDERS: ReadonlyArray<DeciderKind> = ["policy", "owner", "staff"]
const OUTCOMES: ReadonlyArray<DecisionOutcome> = ["auto_done", "approved", "edited", "rejected"]
const REASONS: ReadonlyArray<GateReason> = [
    "routine",
    "missing_data",
    "over_authority",
    "unclear_outcome",
    "not_allowed",
]

/** The decider a stored text names; a value outside the closed set (never written by the app) reads as the policy. */
export const deciderOf = (value: string): DeciderKind => DECIDERS.find((kind) => kind === value) ?? "policy"

/** The outcome a stored text names; a value outside the closed set reads as a rejection, the safe reading. */
export const outcomeOf = (value: string): DecisionOutcome => OUTCOMES.find((outcome) => outcome === value) ?? "rejected"

/** The reason a stored text names, or none. */
export const reasonOf = (value: string | null): GateReason | null => REASONS.find((reason) => reason === value) ?? null

/** One decision row as the history uses it. */
export const toDecisionRecord = (row: DecisionWithLeadRow): DecisionRecord => ({
    id: row.id,
    work_item_id: row.work_item_id,
    lead_id: row.lead_id,
    leadName: row.lead?.contact_name ?? null,
    department: row.department,
    action: row.action,
    decided_by: row.decided_by,
    decider_kind: deciderOf(row.decider_kind),
    outcome: outcomeOf(row.outcome),
    reason: reasonOf(row.reason),
    note: row.note,
    created_at: row.created_at,
})
