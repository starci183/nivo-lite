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

/** Blanks left to fill in: runs of ellipses or of dots, an empty, dotted or underscored bracket, a bracketed figure to choose before a per cent sign. */
const BLANKS: ReadonlyArray<RegExp> = [
    new RegExp(String.raw`\u2026{2,}`, "gu"),
    /\.{5,}/gu,
    new RegExp(String.raw`\[ ?(?:\.{3}|\u2026)? ?\]`, "gu"),
    /\[_+\]/gu,
    /\[\d+(?:[.,]\d+)?\] ?%/gu,
]

const blanksIn = (text: string): ReadonlyArray<RegExpExecArray> =>
    BLANKS.flatMap((pattern) => [...text.matchAll(pattern)]).sort((a, b) => a.index - b.index)

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
            const matches = blanksIn(text)
            count += matches.length
            const first = matches[0]
            if (first !== undefined) {
                const quote = quoteAround(text, first.index, first.index + first[0].length, 40)
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
