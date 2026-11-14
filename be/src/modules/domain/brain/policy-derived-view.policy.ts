import type { FactRecord } from "@modules/domain/brain-facts"
import type { GapRecord } from "@modules/domain/knowledge-gaps"
import type { BrainPolicies, BrainPolicyDetail, PolicyRow } from "./brain-policies.contracts"
import { MISSING_MAX, brainPolicyDetailOf, policyMissingOf, policyRowsOf } from "./brain-policies.policy"
import type { PolicyDerivationState } from "./brain-policy-derivations.service"
import { derivePlanOf, heldByTruth, truthKeyOf, type DerivedPolicy } from "./policy-derive.policy"

/** A row of the tab with what the AI derived for it: the row still reads its value from the fact in force. */
export interface DerivedPolicyRow extends PolicyRow {
    /** The derived policy (`brain_policies.id`); null only on a row shown without a judgement. */
    readonly policyId: string | null
    /** The human title of the rule (the delivery fee inside the city), without its value. */
    readonly title: string | null
    /** The AI's one-line reason why this truth is a rule of the shop. */
    readonly reason: string | null
}

/** A group of the tab: the group the AI derived, with its rows. */
export interface DerivedPolicyGroup {
    /** The group's slug (the field keeps PO1's name: it was the subject key before the derived layer). */
    readonly subjectKey: string
    /** The group as people read it (Delivery). */
    readonly subjectLabel: string
    /** Its rows, by title. */
    readonly rows: ReadonlyArray<DerivedPolicyRow>
}

/**
 * Where the derived layer of the workspace stands: `ready` (every truth in force is judged), `deriving` (a pass waits or runs),
 * `failed` (the last pass was given up; the next fact change or the door asks again) or `not_derived` (truths wait to be judged and
 * no pass is queued: a workspace from before this layer that was not backfilled yet).
 */
export type PolicyDerivationStateName = "ready" | "deriving" | "failed" | "not_derived"

/** The derive state the tab shows. */
export interface PolicyDerivationView {
    /** `ready`, `deriving`, `failed` or `not_derived`. */
    readonly state: PolicyDerivationStateName
    /** Truths in force or scheduled the AI has not judged yet (they are not on the tab until it has). */
    readonly pendingFacts: number
    /** When a pass last left nothing to judge; ISO or null. */
    readonly derivedAt: string | null
    /** For `failed`: `model` (no usable answer in three tries), `credits` or `gave_up`. */
    readonly error: string | null
}

/** The tab read from the derived layer. */
export interface DerivedBrainPolicies extends Omit<BrainPolicies, "groups"> {
    /** The derived groups, by label. */
    readonly groups: ReadonlyArray<DerivedPolicyGroup>
    /** Where the derived layer stands. */
    readonly derivation: PolicyDerivationView
}

/** The drawer of one derived row. */
export interface DerivedBrainPolicyDetail extends Omit<BrainPolicyDetail, "row"> {
    /** The row. */
    readonly row: DerivedPolicyRow
}

/** The drawer of a row, or null when the fact is unknown or its truth is not a derived policy. */
export type MaybeDerivedPolicyDetail = DerivedBrainPolicyDetail | null

/** Whether a judgement puts its truth on the tab. */
export const isOpenPolicy = (one: DerivedPolicy | null | undefined): one is DerivedPolicy =>
    one?.kind === "policy" && one.status === "open"

/** A row with its judgement. */
export const derivedRowOf = (row: PolicyRow, derived: DerivedPolicy | null): DerivedPolicyRow => ({
    ...row,
    policyId: derived?.id ?? null,
    title: derived === null || derived.title === "" ? null : derived.title,
    reason: derived === null || derived.reason === "" ? null : derived.reason,
})

/** The name of the derive state: a pass that waits or runs, a pass given up, truths left unjudged, or nothing to do. */
const stateNameOf = (state: PolicyDerivationState | null, pendingFacts: number): PolicyDerivationStateName => {
    if (state?.status === "queued" || state?.status === "running") return "deriving"
    if (state?.status === "failed") return "failed"
    return pendingFacts > 0 ? "not_derived" : "ready"
}

/** The derive state the tab shows, from the stored state and how many truths wait. */
export const derivationViewOf = (state: PolicyDerivationState | null, pendingFacts: number): PolicyDerivationView => {
    const name = stateNameOf(state, pendingFacts)
    return { state: name, pendingFacts, derivedAt: state?.derivedAt ?? null, error: name === "failed" ? (state?.error ?? null) : null }
}

/**
 * The tab from the derived layer: one row per truth the AI derived as a policy, grouped by the derived group; every value, source,
 * audience and waiting proposal is read from the facts (the layer holds none). A truth not judged yet is not shown; it counts in
 * `derivation.pendingFacts`.
 */
export const derivedPoliciesOf = (
    facts: ReadonlyArray<FactRecord>,
    gaps: ReadonlyArray<GapRecord>,
    stored: ReadonlyArray<DerivedPolicy>,
    state: PolicyDerivationState | null,
    canEdit: boolean,
    at: number,
    pendingFacts?: number,
): DerivedBrainPolicies => {
    const policies = new Map(stored.filter(isOpenPolicy).map((one) => [truthKeyOf(one), one]))
    const byId = new Map(facts.map((fact) => [fact.id, fact]))
    const held = facts.filter((fact) => fact.status === "active" || fact.status === "scheduled")
    const proposals = facts.filter((fact) => fact.status === "proposed")
    const rows = policyRowsOf(held, proposals, at, (fact) => policies.has(truthKeyOf(fact)))
    const groups = new Map<string, { label: string; rows: Array<DerivedPolicyRow> }>()
    rows.forEach((row) => {
        const anchor = byId.get(row.factId)
        const derived = anchor === undefined ? null : (policies.get(truthKeyOf(anchor)) ?? null)
        const key = derived?.groupKey ?? row.subjectKey
        const group = groups.get(key) ?? { label: derived?.groupLabel ?? row.subjectLabel, rows: [] }
        group.rows.push(derivedRowOf(row, derived))
        groups.set(key, group)
    })
    const name = (row: DerivedPolicyRow): string => row.title ?? row.attributeLabel
    return {
        groups: [...groups.entries()]
            .map(([subjectKey, group]) => ({
                subjectKey,
                subjectLabel: group.label,
                rows: group.rows.toSorted((a, b) => name(a).localeCompare(name(b), "vi")),
            }))
            .toSorted((a, b) => a.subjectLabel.localeCompare(b.subjectLabel, "vi")),
        pendingTotal: rows.reduce((sum, row) => sum + row.pendingCount, 0),
        canEdit,
        missing: gaps.slice(0, MISSING_MAX).map((one) => policyMissingOf(one)),
        // The truths not judged yet: the SQL count of the candidates when the caller read it (any size), else planned from the facts given.
        derivation: derivationViewOf(state, pendingFacts ?? derivePlanOf(heldByTruth(held, at), stored).ask.length),
    }
}

/** The drawer of a truth the AI derived as a policy, from the facts of its subject and the waiting proposals. */
export const derivedPolicyDetailOf = (
    anchor: FactRecord,
    derived: DerivedPolicy,
    subjectFacts: ReadonlyArray<FactRecord>,
    proposals: ReadonlyArray<FactRecord>,
    canEdit: boolean,
    at: number,
): MaybeDerivedPolicyDetail => {
    const detail = brainPolicyDetailOf(anchor, subjectFacts, proposals, canEdit, at, () => true)
    return detail === null ? null : { ...detail, row: derivedRowOf(detail.row, derived) }
}
