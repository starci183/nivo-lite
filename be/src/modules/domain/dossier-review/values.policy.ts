import { addDays } from "./document-state.policy"
import { SALARY_ATTRIBUTES, minimumWageOn } from "./pack-vocabulary.policy"
import type { FindingCandidate, ReviewContext } from "./dossier-inputs.contracts"
import {
    amountOf,
    candidateOf,
    datesOf,
    displayAmount,
    displayDate,
    documentEvidence,
    documentsIn,
    dossierOfFact,
    dossierOfSources,
    factEvidence,
    factsOfContext,
    isAttribute,
    titlesOf,
} from "./rule-kit.policy"
import type { RuleFamily } from "./rule-kit.policy"

/** The smallest amount read as a monthly wage; a smaller figure counts millions or hours, not a wage. */
const WAGE_FLOOR = 100_000

const wages = (context: ReviewContext): ReadonlyArray<FindingCandidate> => {
    const owners = dossierOfSources(context)
    const titles = titlesOf(context)
    const dates = datesOf(context)
    return factsOfContext(context).flatMap((fact) => {
        const amount = isAttribute(fact, SALARY_ATTRIBUTES) ? amountOf(fact) : null
        const filed = dossierOfFact(fact, owners)
        if (amount === null || amount < WAGE_FLOOR || filed === undefined) return []
        const documentDate = fact.sourceIds.map((id) => dates.get(id)).find((date) => typeof date === "string")
        const minimum = minimumWageOn(fact.validFrom ?? documentDate ?? context.today)
        if (minimum === null || amount >= minimum.amount) return []
        return [
            candidateOf(filed, {
                ruleKey: "values.minimum_wage",
                subject: `${fact.subjectKey}|${fact.attribute}`,
                kind: "unreasonable",
                severity: "medium",
                code: "values_minimum_wage",
                params: {
                    amount: displayAmount(amount),
                    minimum: displayAmount(minimum.amount),
                    region: minimum.region,
                },
                evidence: [factEvidence(fact, "claim", titles)],
                remedyAction: "decide",
            }),
        ]
    })
}

const reversed = (context: ReviewContext): ReadonlyArray<FindingCandidate> => {
    const owners = dossierOfSources(context)
    const titles = titlesOf(context)
    return factsOfContext(context).flatMap((fact) => {
        const filed = dossierOfFact(fact, owners)
        const { validFrom, validTo } = fact
        if (validFrom === null || validTo === null || validTo >= validFrom || filed === undefined) return []
        return [
            candidateOf(filed, {
                ruleKey: "values.dates",
                subject: `order:${fact.id}`,
                kind: "unreasonable",
                severity: "low",
                code: "values_dates_order",
                params: { subject: fact.subject, from: displayDate(validFrom), to: displayDate(validTo) },
                evidence: [factEvidence(fact, "claim", titles)],
                remedyAction: "decide",
            }),
        ]
    })
}

const future = (context: ReviewContext): ReadonlyArray<FindingCandidate> => {
    const latest = addDays(context.today, 1)
    return context.dossiers.flatMap((inputs) =>
        documentsIn(inputs, ["actual", "draft"]).flatMap((doc) => {
            const date = doc.date
            if (date === null || date <= latest) return []
            return [
                candidateOf(inputs, {
                    ruleKey: "values.dates",
                    subject: `future:${doc.id}`,
                    kind: "unreasonable",
                    severity: "low",
                    code: "values_dates_future",
                    params: { document: doc.title, date: displayDate(date) },
                    evidence: [documentEvidence(doc, "claim", doc.title)],
                    remedyAction: "decide",
                }),
            ]
        }),
    )
}

/** values.minimum_wage: a wage below the regional minimum of its date; values.dates: an end before its start, a document dated after tomorrow. */
export const valueRules: RuleFamily = (context) => [...wages(context), ...reversed(context), ...future(context)]
