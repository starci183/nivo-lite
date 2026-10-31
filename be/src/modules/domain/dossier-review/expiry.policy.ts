import { addDays, dateIn } from "./document-state.policy"
import { EXPIRY_ATTRIBUTES } from "./pack-vocabulary.policy"
import { DOSSIER_REVIEW_CAPS } from "./dossier-review.contracts"
import type { DossierInputs, FindingCandidate, ReviewContext, ReviewFact } from "./dossier-inputs.contracts"
import {
    candidateOf,
    displayDate,
    documentEvidence,
    documentsIn,
    dossierLabel,
    dossierOfFact,
    dossierOfSources,
    expectedEvidence,
    factEvidence,
    factsOfContext,
    isAttribute,
    titlesOf,
} from "./rule-kit.policy"
import type { RuleFamily } from "./rule-kit.policy"

/** The expiry date a fact gives: the date of an expiry attribute, or the end of validity of a fact of a dossier that tracks expiry. */
export const expiryOf = (fact: ReviewFact, tracksExpiry: boolean): string | null => {
    if (isAttribute(fact, EXPIRY_ATTRIBUTES)) return dateIn(fact.value) ?? fact.validTo
    return tracksExpiry ? fact.validTo : null
}

const dated = (context: ReviewContext): ReadonlyArray<FindingCandidate> => {
    const owners = dossierOfSources(context)
    const titles = titlesOf(context)
    const soon = addDays(context.today, DOSSIER_REVIEW_CAPS.expiringDays)
    return factsOfContext(context).flatMap((fact) => {
        const filed = dossierOfFact(fact, owners)
        if (filed === undefined) return []
        const date = expiryOf(fact, filed.entry?.tracksExpiry === true)
        if (date === null || date > soon) return []
        const expired = date < context.today
        return [
            candidateOf(filed, {
                ruleKey: "expiry.dates",
                subject: `${fact.subjectKey}|${fact.attribute}`,
                kind: "expired",
                severity: expired ? "high" : "medium",
                code: expired ? "expiry_expired" : "expiry_expiring",
                params: {
                    dossier: dossierLabel(filed),
                    item: fact.subject,
                    date: displayDate(date),
                    state: expired ? "expired" : "expiring",
                },
                evidence: [factEvidence(fact, "claim", titles)],
                remedyAction: "external",
            }),
        ]
    })
}

const untracked = (inputs: DossierInputs): ReadonlyArray<FindingCandidate> => {
    const docs = documentsIn(inputs, ["actual", "draft"])
    const first = docs[0]
    if (inputs.entry?.tracksExpiry !== true || first === undefined) return []
    if (inputs.facts.some((fact) => expiryOf(fact, true) !== null)) return []
    return [
        candidateOf(inputs, {
            ruleKey: "expiry.untracked",
            subject: "untracked",
            kind: "missing",
            severity: "low",
            code: "expiry_untracked",
            params: { dossier: dossierLabel(inputs) },
            evidence: [expectedEvidence(inputs.dossier.name), documentEvidence(first, "context", first.title)],
            remedyAction: "upload",
        }),
    ]
}

/** expiry.dates: an expiry passed (high) or within 60 days (medium); expiry.untracked: a dossier that tracks expiry records none. */
export const expiryRules: RuleFamily = (context) => [...dated(context), ...context.dossiers.flatMap(untracked)]
