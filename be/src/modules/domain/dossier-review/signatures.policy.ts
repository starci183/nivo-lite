import { fillBlanksIn } from "./blank.policy"
import type { BlankMatch } from "./blank.policy"
import type { FindingEvidence } from "./dossier-review.contracts"
import type { DossierInputs, FindingCandidate } from "./dossier-inputs.contracts"
import { meetingDocuments } from "./presence.policy"
import {
    candidateOf,
    documentEvidence,
    documentsIn,
    dossierLabel,
    expectedEvidence,
    passageEvidence,
    quoteAround,
} from "./rule-kit.policy"
import type { RuleFamily } from "./rule-kit.policy"

/** The blanks of a stored passage, in order (the shared detector: it also reads a dotted blank that normalisation shortened). */
const blanksOf = (text: string): ReadonlyArray<BlankMatch> => fillBlanksIn(text)

const unsigned = (inputs: DossierInputs): ReadonlyArray<FindingCandidate> =>
    (inputs.entry?.expects ?? [])
        .filter((expectation) => expectation.signed)
        .flatMap((expectation) => {
            const found = meetingDocuments(inputs, expectation)
            if (found.actual.length > 0 || found.drafts.length === 0) return []
            return [
                candidateOf(inputs, {
                    ruleKey: "signatures.unsigned",
                    subject: expectation.key,
                    kind: "unsigned",
                    severity: expectation.severity,
                    code: "signatures_unsigned",
                    params: { dossier: dossierLabel(inputs), expectation: expectation.label },
                    evidence: [
                        ...found.drafts.map((doc) => documentEvidence(doc, "claim", expectation.label)),
                        expectedEvidence(expectation.label),
                    ],
                    remedyAction: "upload",
                }),
            ]
        })

const placeholders = (inputs: DossierInputs): ReadonlyArray<FindingCandidate> => {
    let count = 0
    let firstQuote = ""
    const evidence: Array<FindingEvidence> = []
    for (const doc of documentsIn(inputs, ["actual", "draft"])) {
        for (const passage of doc.passages) {
            const text = passage.text.normalize("NFC")
            const matches = blanksOf(text)
            count += matches.length
            const first = matches[0]
            if (first !== undefined) {
                const quote = quoteAround(text, first.index, first.index + first.text.length, 40)
                if (evidence.length === 0) firstQuote = quote
                evidence.push(passageEvidence(doc, passage, quote, "claim", doc.title))
            }
        }
    }
    if (count === 0) return []
    return [
        candidateOf(inputs, {
            ruleKey: "signatures.placeholders",
            subject: "placeholders",
            kind: "missing",
            severity: "low",
            code: "signatures_placeholders",
            params: { dossier: dossierLabel(inputs), count: String(count), quote: firstQuote },
            evidence,
            remedyAction: "decide",
        }),
    ]
}

/** signatures.unsigned: an expectation that must be signed met by drafts only; signatures.placeholders: blanks still left in the passages. */
export const signatureRules: RuleFamily = (context) =>
    context.dossiers.flatMap((inputs) => [...unsigned(inputs), ...placeholders(inputs)])
