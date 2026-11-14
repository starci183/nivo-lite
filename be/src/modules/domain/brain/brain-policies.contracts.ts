import type { FactFlag, FactRecord, Scope } from "@modules/domain/brain-facts"
import type { PolicyValue, PolicyValueProblem, PolicyValueType } from "./policy-value.policy"

/**
 * Where a value comes from, as the tab shows it (its newest piece of evidence): a document (its title), a chat message, the agent's own
 * learning from answered stops, the owner or a manager editing it directly, or anything else.
 */
export interface PolicySource {
    /** `document`, `chat`, `learning`, `owner_edit` (the owner edited it directly), `manager_edit` or `other`. */
    readonly kind: "document" | "chat" | "learning" | "owner_edit" | "manager_edit" | "other"
    /** The document title, the chat's label, the person's name, or the evidence label. */
    readonly label: string
    /** When the evidence was given (else when the value was proposed); ISO. */
    readonly at: string | null
    /** How many pieces of evidence of that kind it rests on (for example a self-learned value from 3 answers). */
    readonly count: number
}

/** Who reads a value: the fact's scope, read through the lens rule every agent's search uses (`visibleTo`). */
export interface PolicyAudience {
    /** `public` (customers too), `internal` (every agent working for the shop) or `restricted` (the modules named). */
    readonly scope: Scope
    /** The modules a restricted fact is kept for; empty otherwise. */
    readonly modules: ReadonlyArray<string>
    /** Whether a customer-facing step (front desk, consult) can read it: `public` only. */
    readonly customers: boolean
    /** The one agent instance it is kept for, or null (the whole shop). */
    readonly installationId: string | null
}

/** One value of a policy: in force, scheduled, waiting or in history. */
export interface PolicyValueView {
    /** The fact id. */
    readonly factId: string
    /** The value as stored (what the agents read). */
    readonly value: string
    /** The unit written apart, or null. */
    readonly unit: string | null
    /** The value as a parameter. */
    readonly parameter: PolicyValue
    /** Which version of its key it is; null for a value never in force. */
    readonly version: number | null
    /** `active`, `scheduled`, `proposed`, `superseded`, `expired` or `rejected`. */
    readonly status: FactRecord["status"]
    /** From when it holds; ISO or null. */
    readonly validFrom: string | null
    /** Until when it holds; ISO or null. */
    readonly validTo: string | null
    /** Where it comes from, and when. */
    readonly source: PolicySource
    /** Who reads it. */
    readonly audience: PolicyAudience
}

/** One waiting proposal of a policy, with the decision the drawer's two buttons call. */
export interface PolicyProposalView extends PolicyValueView {
    /** `set` (a value) or `retire` (stop using the value in force). */
    readonly kind: FactRecord["proposalKind"]
    /** Who filed it (an agent's module, a person's name, NIVO for a document). */
    readonly proposedBy: string
    /** When it was filed. */
    readonly proposedAt: string
    /** What the brain flagged for the founder (`stale`, `same_meaning`). */
    readonly flags: ReadonlyArray<FactFlag>
    /** The `decideBrainFact` action of the "use" button: `choose` for a value (it also turns down the other waiting values), `apply` for a retire. */
    readonly useAction: "choose" | "apply"
}

/** One row of the tab: one truth of the shop's rules, by the fact that holds it. */
export interface PolicyRow {
    /** The id that keys the row: the value in force, else the scheduled value, else the newest waiting proposal (a row with no value set yet). */
    readonly factId: string
    /** The subject key and attribute key of the truth. */
    readonly subjectKey: string
    /** The attribute key. */
    readonly attribute: string
    /** The subject as people write it. */
    readonly subjectLabel: string
    /** The attribute as people write it (the row's name). */
    readonly attributeLabel: string
    /** The parameter type the control edits, inferred from the value (the waiting value when nothing is in force). */
    readonly type: PolicyValueType
    /** The value in force now; null = not set yet. */
    readonly current: PolicyValueView | null
    /** The value approved for a later start (shown as a change from a given date), or null. */
    readonly scheduled: PolicyValueView | null
    /** How many proposals wait for this truth. */
    readonly pendingCount: number
    /** The waiting values, newest first (the row shows the count, the drawer the list). */
    readonly pendingValues: ReadonlyArray<string>
}

/** A subject of the truth graph and its policy rows. */
export interface PolicyGroup {
    /** The subject key. */
    readonly subjectKey: string
    /** The subject as people write it (for example a delivery-zone name). */
    readonly subjectLabel: string
    /** Its rows, by attribute. */
    readonly rows: ReadonlyArray<PolicyRow>
}

/** A question customers asked that no truth answered: an agent is missing a rule. */
export interface PolicyMissing {
    /** The knowledge gap id. */
    readonly gapId: string
    /** The agent's module that could not answer. */
    readonly module: string
    /** The question as first asked. */
    readonly question: string
    /** The subject and attribute the question seems to be about, when guessed. */
    readonly topic: string | null
    /** The attribute guess. */
    readonly attributeGuess: string | null
    /** How many times it was asked. */
    readonly count: number
    /** When it was last asked. */
    readonly lastSeenAt: string
}

/** The policies tab of the Second Brain. */
export interface BrainPolicies {
    /** The groups, by subject label. */
    readonly groups: ReadonlyArray<PolicyGroup>
    /** Proposals waiting across every row (the tab's count chip). */
    readonly pendingTotal: number
    /** True for the workspace owner: the only one who edits a value or decides a proposal. */
    readonly canEdit: boolean
    /** Open customer questions no truth answered, most asked first. */
    readonly missing: ReadonlyArray<PolicyMissing>
}

/** The drawer of one row: its value, waiting proposals and version history. */
export interface BrainPolicyDetail {
    /** The row. */
    readonly row: PolicyRow
    /** The waiting proposals, newest first. */
    readonly proposals: ReadonlyArray<PolicyProposalView>
    /** Every value the truth held, newest version first (in force and scheduled included). */
    readonly history: ReadonlyArray<PolicyValueView>
    /** True for the workspace owner. */
    readonly canEdit: boolean
}

/** What setting a policy did. */
export type SetPolicyOutcome = "applied" | "scheduled" | "proposed" | "invalid" | "unchanged"

/** The owner's (or a manager's) edit of one row. */
export interface SetPolicyRequest {
    /** The workspace. */
    readonly workspaceId: string
    /** The row (`PolicyRow.factId`). */
    readonly factId: string
    /** The new value as typed; digits alone mean VND / percent / minutes in a money / percent / duration row. Absent = keep the value. */
    readonly value?: string | undefined
    /** From when it holds; absent or past = now, future = scheduled. */
    readonly validFrom?: string | undefined
    /** Until when it holds; absent = one year. */
    readonly validTo?: string | undefined
    /** Who may read it: `public` (customers may be told) or `internal`; absent = keep. */
    readonly audience?: "public" | "internal" | undefined
}

/** Why an edit was refused. */
export type SetPolicyProblem =
    | PolicyValueProblem
    | "not_found"
    | "window"
    | "nothing_to_change"
    | "not_in_force"
    | "owner_only"

/** What an edit did. */
export interface SetPolicyResult {
    /** `applied`, `scheduled`, `proposed` (a manager's edit waits for the owner), `invalid` or `unchanged`. */
    readonly outcome: SetPolicyOutcome
    /** Why it was refused, for `invalid`. */
    readonly problem: SetPolicyProblem | null
    /** The fact written (the new version, the schedule or the proposal), or the one in force for `unchanged`; null for `invalid`. */
    readonly factId: string | null
    /** The value as stored; null for `invalid`. */
    readonly value: string | null
}

/** Taking a policy out of force. */
export interface UnsetPolicyRequest {
    /** The workspace. */
    readonly workspaceId: string
    /** The row. */
    readonly factId: string
    /** Why, kept with the decision. */
    readonly note?: string | undefined
}

/** What taking it out did: `retired`, `proposed` (a manager's request waits for the owner) or `unchanged` (nothing in force). */
export interface UnsetPolicyResult {
    /** The outcome. */
    readonly outcome: "retired" | "proposed" | "unchanged"
}
