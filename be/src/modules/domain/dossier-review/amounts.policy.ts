import { addDays } from "./document-state.policy"
import {
    CHARTER_CAPITAL,
    CONTRIBUTED_ATTRIBUTES,
    INVARIANTS,
    MEMBER_CAPITAL_ATTRIBUTES,
    REGISTRATION_ATTRIBUTES,
    SHARE_ATTRIBUTES,
} from "./pack-vocabulary.policy"
import type { Invariant } from "./pack-vocabulary.policy"
import { DOSSIER_REVIEW_CAPS } from "./dossier-review.contracts"
import type { DossierInputs, FindingCandidate, ReviewContext, ReviewFact } from "./dossier-inputs.contracts"
import {
    amountOf,
    candidateOf,
    dateOfFact,
    digitsOf,
    displayAmount,
    displayDate,
    dossierOfFact,
    dossierOfSources,
    factEvidence,
    factsOfContext,
    isAttribute,
    titlesOf,
} from "./rule-kit.policy"
import type { RuleFamily } from "./rule-kit.policy"

/** The tolerance between a member's capital and its share of the charter capital, in VND. */
const CAPITAL_TOLERANCE = 1_000

/** A fact with the amount it gives. */
interface Amounted {
    readonly fact: ReviewFact
    readonly amount: number
}

const amounted = (facts: ReadonlyArray<ReviewFact>): ReadonlyArray<Amounted> =>
    facts.flatMap((fact) => {
        const amount = amountOf(fact)
        return amount === null ? [] : [{ fact, amount }]
    })

const valueKeyOf = (invariant: Invariant, fact: ReviewFact): string => {
    if (invariant.key === "tax_code") return digitsOf(fact.value)
    const amount = amountOf(fact)
    return amount === null ? "" : String(amount)
}

const ownerRef = (fact: ReviewFact, owners: ReadonlyMap<string, DossierInputs>): string =>
    dossierOfFact(fact, owners)?.dossier.ref ?? ""

/** The facts of an invariant that give a value, those of its authority dossiers first. */
const invariantFacts = (
    context: ReviewContext,
    invariant: Invariant,
    owners: ReadonlyMap<string, DossierInputs>,
): ReadonlyArray<ReviewFact> =>
    factsOfContext(context)
        .filter((fact) => isAttribute(fact, invariant.attributes) && valueKeyOf(invariant, fact) !== "")
        .sort(
            (a, b) =>
                Number(invariant.authority.includes(ownerRef(b, owners))) -
                Number(invariant.authority.includes(ownerRef(a, owners))),
        )

/** The dossier a finding of the pass is filed under: the dossier of the reference when the pass holds it, else the dossier of the fact. */
const filedUnder = (
    context: ReviewContext,
    ref: string,
    fact: ReviewFact,
    owners: ReadonlyMap<string, DossierInputs>,
): DossierInputs | undefined =>
    context.dossiers.find((inputs) => inputs.dossier.ref === ref) ?? dossierOfFact(fact, owners)

const relatedOf = (
    facts: ReadonlyArray<ReviewFact>,
    owners: ReadonlyMap<string, DossierInputs>,
): ReadonlyArray<DossierInputs> =>
    facts.flatMap((fact) => {
        const owner = dossierOfFact(fact, owners)
        return owner === undefined ? [] : [owner]
    })

const invariantFindings = (context: ReviewContext, invariant: Invariant): ReadonlyArray<FindingCandidate> => {
    const owners = dossierOfSources(context)
    const facts = invariantFacts(context, invariant, owners)
    const distinct = new Map<string, ReviewFact>()
    for (const fact of facts) {
        const key = valueKeyOf(invariant, fact)
        if (!distinct.has(key)) distinct.set(key, fact)
    }
    const shown = [...distinct.values()].slice(0, DOSSIER_REVIEW_CAPS.evidenceMax)
    if (shown.length < 2) return []
    const titles = titlesOf(context)
    return shown.slice(0, 1).flatMap((head) => {
        const filed = filedUnder(context, invariant.filedUnder, head, owners)
        if (filed === undefined) return []
        return [
            candidateOf(filed, {
                ruleKey: "amounts.invariant",
                subject: invariant.key,
                kind: "contradiction",
                severity: "high",
                code: "amounts_invariant",
                params: { invariant: head.attributeLabel, values: shown.map((fact) => fact.value).join("; ") },
                evidence: shown.map((fact, index) => factEvidence(fact, index === 0 ? "claim" : "counter", titles)),
                remedyAction: "decide",
                related: relatedOf(facts, owners),
            }),
        ]
    })
}

/** The charter capital the pass agrees on: the first charter-capital fact, those of the authority dossiers first. */
const charterCapitalOf = (
    context: ReviewContext,
    owners: ReadonlyMap<string, DossierInputs>,
): ReadonlyArray<Amounted> => amounted(invariantFacts(context, CHARTER_CAPITAL, owners)).slice(0, 1)

/** The order of facts by when they hold, latest first: the start of validity, else the last change. */
const byLatest = (a: Amounted, b: Amounted): number =>
    (a.fact.validFrom ?? a.fact.updatedAt) < (b.fact.validFrom ?? b.fact.updatedAt) ? 1 : -1

const registrationOf = (facts: ReadonlyArray<ReviewFact>): ReadonlyArray<{ fact: ReviewFact; date: string }> =>
    facts
        .filter((fact) => isAttribute(fact, REGISTRATION_ATTRIBUTES))
        .flatMap((fact) => {
            const date = dateOfFact(fact)
            return date === null ? [] : [{ fact, date }]
        })
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 1)

const contributionFindings = (context: ReviewContext): ReadonlyArray<FindingCandidate> => {
    const owners = dossierOfSources(context)
    const titles = titlesOf(context)
    const facts = factsOfContext(context)
    const contributions = [...amounted(facts.filter((fact) => isAttribute(fact, CONTRIBUTED_ATTRIBUTES)))]
        .sort(byLatest)
        .slice(0, 1)
    return charterCapitalOf(context, owners).flatMap((capital) =>
        contributions.flatMap((contributed) =>
            registrationOf(facts).flatMap((registration) => {
                if (contributed.amount >= capital.amount) return []
                const filed = filedUnder(context, "10", contributed.fact, owners)
                if (filed === undefined) return []
                const deadline = addDays(registration.date, DOSSIER_REVIEW_CAPS.contributionDays)
                const overdue = context.today > deadline
                return [
                    candidateOf(filed, {
                        ruleKey: "amounts.contribution",
                        subject: "contribution",
                        kind: "unreasonable",
                        severity: overdue ? "critical" : "low",
                        code: overdue ? "amounts_contribution_overdue" : "amounts_contribution_open",
                        params: {
                            contributed: displayAmount(contributed.amount),
                            capital: displayAmount(capital.amount),
                            deadline: displayDate(deadline),
                        },
                        evidence: [
                            factEvidence(contributed.fact, "claim", titles),
                            factEvidence(capital.fact, "counter", titles),
                            factEvidence(registration.fact, "event", titles),
                        ],
                        remedyAction: "decide",
                        related: relatedOf([capital.fact, registration.fact], owners),
                    }),
                ]
            }),
        ),
    )
}

/** The latest amounted fact of each subject. */
const latestBySubject = (facts: ReadonlyArray<Amounted>): ReadonlyMap<string, Amounted> => {
    const latest = new Map<string, Amounted>()
    for (const item of [...facts].sort(byLatest)) {
        if (!latest.has(item.fact.subjectKey)) latest.set(item.fact.subjectKey, item)
    }
    return latest
}

const totalFindings = (context: ReviewContext, members: ReadonlyArray<Amounted>): ReadonlyArray<FindingCandidate> => {
    const owners = dossierOfSources(context)
    const titles = titlesOf(context)
    const total = members.reduce((sum, item) => sum + item.amount, 0)
    if (Math.abs(total - 100) <= 0.01) return []
    return members.slice(0, 1).flatMap((head) => {
        const filed = filedUnder(context, "8", head.fact, owners)
        if (filed === undefined) return []
        return [
            candidateOf(filed, {
                ruleKey: "amounts.shares",
                subject: "total",
                kind: "unreasonable",
                severity: "medium",
                code: "amounts_shares_total",
                params: { total: String(Math.round(total * 100) / 100) },
                evidence: members.map((item) => factEvidence(item.fact, "claim", titles)),
                remedyAction: "decide",
                related: relatedOf(
                    members.map((item) => item.fact),
                    owners,
                ),
            }),
        ]
    })
}

const memberCapitalFindings = (
    context: ReviewContext,
    members: ReadonlyArray<Amounted>,
): ReadonlyArray<FindingCandidate> => {
    const owners = dossierOfSources(context)
    const titles = titlesOf(context)
    const capitals = latestBySubject(
        amounted(factsOfContext(context).filter((fact) => isAttribute(fact, MEMBER_CAPITAL_ATTRIBUTES))),
    )
    return charterCapitalOf(context, owners).flatMap((charter) =>
        members.flatMap((share) => {
            const recorded = capitals.get(share.fact.subjectKey)
            const filed = dossierOfFact(share.fact, owners)
            if (recorded === undefined || filed === undefined) return []
            const expected = (share.amount / 100) * charter.amount
            if (Math.abs(recorded.amount - expected) <= CAPITAL_TOLERANCE) return []
            return [
                candidateOf(filed, {
                    ruleKey: "amounts.shares",
                    subject: `capital:${share.fact.subjectKey}`,
                    kind: "unreasonable",
                    severity: "medium",
                    code: "amounts_shares_capital",
                    params: {
                        member: share.fact.subject,
                        capital: displayAmount(recorded.amount),
                        expected: displayAmount(expected),
                    },
                    evidence: [
                        factEvidence(recorded.fact, "claim", titles),
                        factEvidence(share.fact, "counter", titles),
                        factEvidence(charter.fact, "context", titles),
                    ],
                    remedyAction: "decide",
                }),
            ]
        }),
    )
}

const shareFindings = (context: ReviewContext): ReadonlyArray<FindingCandidate> => {
    const shares = latestBySubject(
        amounted(factsOfContext(context).filter((fact) => isAttribute(fact, SHARE_ATTRIBUTES))),
    )
    if (shares.size < 2) return []
    const members = [...shares.values()]
    return [...totalFindings(context, members), ...memberCapitalFindings(context, members)]
}

/**
 * amounts.invariant: the charter capital and the tax code agree across all documents; amounts.contribution: the contributed total below
 * the charter capital, critical once 90 days after registration have passed; amounts.shares: the members' shares make 100 % and each
 * member's capital is its share of the charter capital.
 */
export const amountRules: RuleFamily = (context) => [
    ...INVARIANTS.flatMap((invariant) => invariantFindings(context, invariant)),
    ...contributionFindings(context),
    ...shareFindings(context),
]
