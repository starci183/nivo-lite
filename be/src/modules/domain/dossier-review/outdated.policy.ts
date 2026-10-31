import { EVENT_ATTRIBUTES } from "./pack-vocabulary.policy"
import type {
    DocumentInput,
    DossierInputs,
    EventKey,
    FindingCandidate,
    ReviewContext,
    ReviewFact,
} from "./dossier-inputs.contracts"
import {
    candidateOf,
    dateOfFact,
    displayDate,
    documentEvidence,
    documentsIn,
    dossierLabel,
    factEvidence,
    factsOfContext,
    isAttribute,
    remedyActionOf,
    titlesOf,
} from "./rule-kit.policy"
import type { RuleFamily } from "./rule-kit.policy"

/** The latest past occurrence of an event among the facts: the fact and its date. */
export const latestEvent = (
    facts: ReadonlyArray<ReviewFact>,
    event: EventKey,
    today: string,
): ReadonlyArray<{ readonly fact: ReviewFact; readonly date: string }> =>
    facts
        .filter((fact) => isAttribute(fact, EVENT_ATTRIBUTES[event]))
        .flatMap((fact) => {
            const date = dateOfFact(fact)
            return date === null || date > today ? [] : [{ fact, date }]
        })
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 1)

/** The newest of the actual documents of a dossier when every one of them bears a date; none when one does not or there is none. */
const newestDated = (inputs: DossierInputs): ReadonlyArray<{ readonly doc: DocumentInput; readonly date: string }> => {
    const dated = documentsIn(inputs, ["actual"]).flatMap((doc) => (doc.date === null ? [] : [{ doc, date: doc.date }]))
    if (dated.length === 0 || dated.length < documentsIn(inputs, ["actual"]).length) return []
    return [...dated].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 1)
}

const outdatedOf = (context: ReviewContext, inputs: DossierInputs): ReadonlyArray<FindingCandidate> => {
    const facts = factsOfContext(context)
    const titles = titlesOf(context)
    return newestDated(inputs).flatMap((newest) =>
        (inputs.entry?.mustReflect ?? []).flatMap((event) =>
            latestEvent(facts, event, context.today).flatMap((happened) =>
                happened.date <= newest.date
                    ? []
                    : [
                          candidateOf(inputs, {
                              ruleKey: "outdated.after_event",
                              subject: event,
                              kind: "outdated",
                              severity: "high",
                              code: "outdated_after_event",
                              params: {
                                  dossier: dossierLabel(inputs),
                                  event: happened.fact.attributeLabel,
                                  eventDate: displayDate(happened.date),
                                  documentDate: displayDate(newest.date),
                              },
                              evidence: [
                                  factEvidence(happened.fact, "event", titles),
                                  documentEvidence(newest.doc, "claim", displayDate(newest.date)),
                              ],
                              remedyAction: remedyActionOf(inputs, "upload"),
                          }),
                      ],
            ),
        ),
    )
}

/** outdated.after_event: every actual document of a dossier predates an event the dossier must reflect. */
export const outdatedRules: RuleFamily = (context) => context.dossiers.flatMap((inputs) => outdatedOf(context, inputs))
