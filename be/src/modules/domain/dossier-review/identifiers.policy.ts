import { factSlugOf } from "@modules/domain/brain-facts"
import { foldKeepLength } from "./document-state.policy"
import { TAX_CODE } from "./pack-vocabulary.policy"
import type { FindingEvidence } from "./dossier-review.contracts"
import type { DossierInputs, FindingCandidate, ReviewContext, ReviewFact } from "./dossier-inputs.contracts"
import {
    candidateOf,
    digitsOf,
    documentsIn,
    factEvidence,
    isAttribute,
    passageEvidence,
    quoteAround,
    titlesOf,
} from "./rule-kit.policy"
import type { RuleFamily } from "./rule-kit.policy"

/** The attribute slugs of a citizen identity number. */
const ID_ATTRIBUTES: ReadonlyArray<string> = [
    "so cccd",
    "cccd",
    "can cuoc",
    "so can cuoc",
    "can cuoc cong dan",
    "so cmnd",
].map(factSlugOf)

/** One kind of identifier: how passages write it, which of its digits are compared, and the attributes of its canonical facts. */
interface IdentifierKind {
    readonly type: "tax" | "id"
    readonly code: string
    readonly pattern: RegExp
    readonly attributes: ReadonlyArray<string>
    readonly comparable: (digits: string) => string
}

const KINDS: ReadonlyArray<IdentifierKind> = [
    {
        type: "tax",
        code: "identifiers_tax",
        pattern: /(?:mst|ma so thue|tax code)[ :.]{0,3}\d{10}(?:-\d{3})?(?!\d)/gu,
        attributes: TAX_CODE.attributes,
        comparable: (digits) => digits.slice(0, 10),
    },
    {
        type: "id",
        code: "identifiers_id",
        pattern: /(?:cccd|can cuoc cong dan|can cuoc|cmnd)(?: so)?[ :.]{0,3}\d{12}(?!\d)/gu,
        attributes: ID_ATTRIBUTES,
        comparable: (digits) => digits,
    },
]

const findingsOf = (
    context: ReviewContext,
    inputs: DossierInputs,
    kind: IdentifierKind,
    canonical: ReadonlyArray<ReviewFact>,
): ReadonlyArray<FindingCandidate> => {
    const known = new Set(canonical.map((fact) => kind.comparable(digitsOf(fact.value))))
    const numbers = new Set<string>()
    const evidence: Array<FindingEvidence> = []
    for (const doc of documentsIn(inputs, ["actual", "draft"])) {
        for (const passage of doc.passages) {
            const text = passage.text.normalize("NFC")
            for (const match of foldKeepLength(text).matchAll(kind.pattern)) {
                const digits = digitsOf(match[0])
                if (known.has(kind.comparable(digits))) continue
                numbers.add(digits)
                const quote = quoteAround(text, match.index, match.index + match[0].length, 0)
                evidence.push(passageEvidence(doc, passage, quote, "claim", doc.title))
            }
        }
    }
    const sorted = [...numbers].sort((a, b) => a.localeCompare(b))
    return canonical.slice(0, sorted.length === 0 ? 0 : 1).map((reference) =>
        candidateOf(inputs, {
            ruleKey: "identifiers.canonical",
            subject: `${kind.type}:${sorted.join(",")}`,
            kind: "contradiction",
            severity: "medium",
            code: kind.code,
            params: { count: String(sorted.length), numbers: sorted.slice(0, 5).join(", ") },
            evidence: [...evidence.slice(0, 7), factEvidence(reference, "counter", titlesOf(context))],
            remedyAction: "decide",
        }),
    )
}

/** identifiers.canonical: a tax code or a citizen identity number in a passage that differs from every active value of the workspace. */
export const identifierRules: RuleFamily = (context) =>
    KINDS.flatMap((kind) => {
        const canonical = context.activeFacts.filter((fact) => isAttribute(fact, kind.attributes))
        return context.dossiers.flatMap((inputs) => findingsOf(context, inputs, kind, canonical))
    })
