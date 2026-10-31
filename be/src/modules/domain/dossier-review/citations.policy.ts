import { foldKeepLength } from "./document-state.policy"
import { REPEALED_CITATIONS } from "./pack-vocabulary.policy"
import type { RepealedCitation } from "./pack-vocabulary.policy"
import type { FindingEvidence } from "./dossier-review.contracts"
import type { DossierInputs, FindingCandidate } from "./dossier-inputs.contracts"
import { candidateOf, displayDate, documentsIn, passageEvidence, quoteAround } from "./rule-kit.policy"
import type { RuleFamily } from "./rule-kit.policy"

const citationsOf = (inputs: DossierInputs, citation: RepealedCitation): ReadonlyArray<FindingCandidate> => {
    const evidence: Array<FindingEvidence> = []
    for (const doc of documentsIn(inputs, ["actual", "draft"])) {
        if (doc.date === null || doc.date < citation.since) continue
        for (const passage of doc.passages) {
            const text = passage.text.normalize("NFC")
            const match = citation.pattern.exec(foldKeepLength(text))
            if (match === null) continue
            const quote = quoteAround(text, match.index, match.index + match[0].length, 20)
            evidence.push(passageEvidence(doc, passage, quote, "claim", doc.title))
        }
    }
    if (evidence.length === 0) return []
    return [
        candidateOf(inputs, {
            ruleKey: "citations.repealed",
            subject: citation.key,
            kind: "outdated",
            severity: "medium",
            code: "citations_repealed",
            params: {
                citation: citation.label,
                replacement: citation.replacement,
                since: displayDate(citation.since),
            },
            evidence,
            remedyAction: "decide",
        }),
    ]
}

/** citations.repealed: a document dated on or after the end of a legal text that still cites it. */
export const citationRules: RuleFamily = (context) =>
    context.dossiers.flatMap((inputs) => REPEALED_CITATIONS.flatMap((citation) => citationsOf(inputs, citation)))
