import { inForce, visibleTo, type BrainSubjectType, type FactRecord } from "@modules/domain/brain-facts"
import type { GapRecord } from "@modules/domain/knowledge-gaps"
import type {
    BrainPolicyDetail,
    PolicyAudience,
    PolicyMissing,
    PolicyProposalView,
    PolicyRow,
    PolicySource,
    PolicyValueView,
} from "./brain-policies.contracts"
import { OWNER_EDIT_LABEL } from "./messages/brain-policies.messages"
import { policyValueOf } from "./policy-value.policy"

/**
 * What makes a fact a policy of the shop, from what the fact itself carries: the subject type the extraction labels every fact with
 * (`brain/extraction.policy.ts` asks the model for business | product | service | policy | customer | person | supplier | place | other).
 * A policy is a fact about the shop's own rules and terms: `policy` (rules), `service` (delivery, fees, lead times) and `business` (opening
 * hours, how the shop works). `product` (catalogue prices), `customer`, `person`, `supplier`, `place` and `other` are not. Known limit:
 * `business` also holds the address and phone, which then show as text rows.
 */
export const POLICY_SUBJECT_TYPES: ReadonlyArray<BrainSubjectType> = ["policy", "service", "business"]

/** Whether a fact is a policy of the shop. */
export const isPolicyFact = (fact: Pick<FactRecord, "subjectType">): boolean =>
    POLICY_SUBJECT_TYPES.includes(fact.subjectType)

/**
 * Which facts are rows of the tab. The derived layer (PO2) passes its own judgement (the truths the AI derived as policies); absent,
 * the subject-type rule above (stage a).
 */
export type PolicyFactRule = (fact: FactRecord) => boolean

/** The evidence ref prefix of a value written on the tab (`policy:<fact id>:<ms>`). */
export const POLICY_EDIT_REF = "policy:"

/** The most open customer questions the tab lists. */
export const MISSING_MAX = 20

/** Where a value comes from: its newest piece of evidence. */
export const policySourceOf = (fact: FactRecord): PolicySource => {
    const item = fact.evidence.at(-1)
    const fallbackAt = fact.decidedAt ?? fact.proposedAt
    if (item === undefined) return { kind: "other", label: fact.proposedBy, at: fallbackAt, count: 0 }
    const sameKind = fact.evidence.filter((one) => one.kind === item.kind).length
    const at = item.at ?? fallbackAt
    if (item.kind === "document") return { kind: "document", label: item.title ?? item.label, at, count: sameKind }
    if (item.kind === "message" && item.ref.startsWith("team-chat:"))
        return { kind: "chat", label: item.label, at, count: sameKind }
    if (item.kind === "decision") return { kind: "learning", label: item.label, at, count: sameKind }
    if (item.kind === "manual") {
        if (fact.sourceKind === "owner") return { kind: "owner_edit", label: OWNER_EDIT_LABEL, at, count: sameKind }
        if (fact.sourceKind === "manager") return { kind: "manager_edit", label: fact.proposedBy, at, count: sameKind }
    }
    return { kind: "other", label: item.label, at, count: sameKind }
}

/** Who reads a fact, by the lens rule of every agent's search. */
export const policyAudienceOf = (fact: FactRecord): PolicyAudience => ({
    scope: fact.scope,
    modules: [...fact.modules],
    customers: visibleTo(fact, "customer", "", fact.installationId),
    installationId: fact.installationId,
})

/** One value as the tab shows it. */
export const policyValueViewOf = (fact: FactRecord): PolicyValueView => ({
    factId: fact.id,
    value: fact.value,
    unit: fact.unit,
    parameter: policyValueOf(fact.value, fact.unit),
    version: fact.version ?? null,
    status: fact.status,
    validFrom: fact.validFrom,
    validTo: fact.validTo,
    source: policySourceOf(fact),
    audience: policyAudienceOf(fact),
})

/** One waiting proposal with the decision the use button calls. */
export const policyProposalViewOf = (fact: FactRecord): PolicyProposalView => ({
    ...policyValueViewOf(fact),
    kind: fact.proposalKind,
    proposedBy: fact.proposedBy,
    proposedAt: fact.proposedAt,
    flags: [...(fact.flags ?? [])],
    useAction: fact.proposalKind === "retire" ? "apply" : "choose",
})

/** The key a fact's value belongs to: subject, attribute and instance scope. */
const keyOf = (fact: FactRecord): string =>
    `${fact.subjectKey}\u0000${fact.attribute}\u0000${fact.installationId ?? ""}`

/** Newest first by proposal time. */
const newestFirst = (a: FactRecord, b: FactRecord): number => Date.parse(b.proposedAt) - Date.parse(a.proposedAt)

/** Whether a fact holds right now: active, or scheduled with its start come (FX5), inside its window. */
const holdsAt = (fact: FactRecord, at: number): boolean =>
    (fact.status === "active" || fact.status === "scheduled") && inForce(fact, at)

/** One key's facts. */
interface KeyFacts {
    readonly facts: ReadonlyArray<FactRecord>
    readonly current: FactRecord | null
    readonly scheduled: FactRecord | null
}

/** The value in force and the later one of one key's facts. */
const keyFactsOf = (facts: ReadonlyArray<FactRecord>, at: number): KeyFacts => {
    const holding = facts.filter((fact) => holdsAt(fact, at))
    const current = holding.toSorted((a, b) => (b.version ?? 0) - (a.version ?? 0) || newestFirst(a, b))[0] ?? null
    const later = facts
        .filter((fact) => fact.status === "scheduled" && fact.validFrom !== null && Date.parse(fact.validFrom) > at)
        .toSorted((a, b) => Date.parse(a.validFrom ?? "") - Date.parse(b.validFrom ?? ""))
    return { facts, current, scheduled: later[0] ?? null }
}

/** The proposals that wait for a key: of the key itself, or naming its value in force or its scheduled value from another key. */
const waitingFor = (
    key: KeyFacts,
    proposals: ReadonlyArray<FactRecord>,
    keyName: string,
): ReadonlyArray<FactRecord> => {
    const named = new Set([key.current?.id, key.scheduled?.id].filter((id): id is string => id !== undefined))
    return proposals
        .filter(
            (proposal) =>
                keyOf(proposal) === keyName || (proposal.conflictWith !== null && named.has(proposal.conflictWith)),
        )
        .toSorted(newestFirst)
}

/** A row of the tab from one key, or null when the key is not a policy. */
const rowOf = (
    key: KeyFacts,
    waiting: ReadonlyArray<FactRecord>,
    isPolicy: PolicyFactRule = isPolicyFact,
): PolicyRow | null => {
    const anchor = key.current ?? key.scheduled ?? waiting[0] ?? null
    if (anchor === null || !isPolicy(anchor)) return null
    return {
        factId: anchor.id,
        subjectKey: anchor.subjectKey,
        attribute: anchor.attribute,
        subjectLabel: anchor.subjectLabel,
        attributeLabel: anchor.attributeLabel,
        type: policyValueOf(anchor.value, anchor.unit).type,
        current: key.current === null ? null : policyValueViewOf(key.current),
        scheduled: key.scheduled === null ? null : policyValueViewOf(key.scheduled),
        pendingCount: waiting.length,
        pendingValues: waiting.map((proposal) => (proposal.proposalKind === "retire" ? "" : proposal.value)),
    }
}

/** The facts grouped by their key. */
const byKey = (facts: ReadonlyArray<FactRecord>): Map<string, Array<FactRecord>> => {
    const keys = new Map<string, Array<FactRecord>>()
    facts.forEach((fact) => keys.set(keyOf(fact), [...(keys.get(keyOf(fact)) ?? []), fact]))
    return keys
}

/** A row and the proposals it claimed. */
interface ClaimedRow {
    readonly row: PolicyRow
    readonly claimed: ReadonlyArray<FactRecord>
}

/**
 * The rows of the tab from the facts in force or scheduled and the waiting proposals: one row per truth (subject, attribute and instance
 * scope) whose fact is a policy. A truth with a value in force or scheduled comes first and claims its waiting proposals (also the ones
 * that name it from another key: a near-meaning change); a truth with only proposals left is a row with no value set yet.
 */
export const policyRowsOf = (
    held: ReadonlyArray<FactRecord>,
    proposals: ReadonlyArray<FactRecord>,
    at: number,
    isPolicy: PolicyFactRule = isPolicyFact,
): ReadonlyArray<PolicyRow> => {
    const settled: Array<ClaimedRow> = [...byKey(held)].flatMap(([name, facts]) => {
        const key = keyFactsOf(facts, at)
        if (key.current === null && key.scheduled === null) return []
        const waiting = waitingFor(key, proposals, name)
        const row = rowOf(key, waiting, isPolicy)
        return row === null ? [] : [{ row, claimed: waiting }]
    })
    const claimed = new Set(settled.flatMap((one) => one.claimed.map((proposal) => proposal.id)))
    const settledKeys = new Set(byKey(held).keys())
    const unset = [
        ...byKey(proposals.filter((proposal) => !claimed.has(proposal.id) && proposal.proposalKind === "set")),
    ]
        .filter(([name]) => !settledKeys.has(name))
        .flatMap(([, waiting]) => {
            const row = rowOf({ facts: [], current: null, scheduled: null }, waiting.toSorted(newestFirst), isPolicy)
            return row === null ? [] : [row]
        })
    return [...settled.map((one) => one.row), ...unset]
}

/** An open customer question as the "agent is missing a rule" row. */
export const policyMissingOf = (gap: GapRecord): PolicyMissing => ({
    gapId: gap.id,
    module: gap.module,
    question: gap.question,
    topic: gap.topic,
    attributeGuess: gap.attributeGuess,
    count: gap.count,
    lastSeenAt: gap.lastSeenAt,
})

/** The order of history: newest version first, then newest start. */
const historyOrder = (a: FactRecord, b: FactRecord): number =>
    (b.version ?? 0) - (a.version ?? 0) ||
    Date.parse(b.validFrom ?? b.proposedAt) - Date.parse(a.validFrom ?? a.proposedAt)

/** The value in force now and the value approved for a later start of one truth. */
export interface PolicyTruth {
    /** The value in force now, or null. */
    readonly current: FactRecord | null
    /** The value approved for a later start, or null. */
    readonly scheduled: FactRecord | null
}

/**
 * The value in force now and the value approved for a later start of the truth a fact belongs to, from every fact of its subject; the
 * set and unset doors write against these.
 */
export const truthOf = (
    anchor: FactRecord,
    subjectFacts: ReadonlyArray<FactRecord>,
    at: number,
): PolicyTruth => {
    const { current, scheduled } = keyFactsOf(
        subjectFacts.filter((fact) => keyOf(fact) === keyOf(anchor)),
        at,
    )
    return { current, scheduled }
}

/**
 * The drawer of a row from every fact of its subject (one read) and the waiting proposals of the workspace: the row, its proposals
 * (of the key, or naming its value from another key) and its history (every value that was or is in force, or approved for later).
 * Null when the fact is not a policy row.
 */
export const brainPolicyDetailOf = (
    anchor: FactRecord,
    subjectFacts: ReadonlyArray<FactRecord>,
    proposals: ReadonlyArray<FactRecord>,
    canEdit: boolean,
    at: number,
    isPolicy: PolicyFactRule = isPolicyFact,
): BrainPolicyDetail | null => {
    const name = keyOf(anchor)
    const own = subjectFacts.filter((fact) => keyOf(fact) === name)
    const key = keyFactsOf(own, at)
    const waiting = waitingFor(key, proposals, name)
    const row = rowOf(key, waiting, isPolicy)
    if (row === null) return null
    const history = own
        .filter(
            (fact) =>
                fact.status === "scheduled" ||
                (["active", "superseded", "expired"].includes(fact.status) && fact.version !== undefined),
        )
        .toSorted(historyOrder)
        .map((one) => policyValueViewOf(one))
    return { row, proposals: waiting.map((one) => policyProposalViewOf(one)), history, canEdit }
}
