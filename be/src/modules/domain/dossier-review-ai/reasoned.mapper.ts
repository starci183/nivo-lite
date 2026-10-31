import type { CitedQuote, ReasonedFinding, ReasonedReview, RemedyText } from "@modules/domain/dossier-review"
import type { DossierReviewAnswer } from "./dossier-review.schema"
import type { RemedyAnswer } from "./remedy.schema"

/** Who answered and what the calls cost, as the port reports them. */
export interface CallFigures {
    /** The model of the answer that was read. */
    readonly model: string
    /** Prompt tokens of every call made, or null when none reported any. */
    readonly promptTokens: number | null
    /** Completion tokens of every call made, or null when none reported any. */
    readonly completionTokens: number | null
}

/** The bounds of the schemas, applied again so a value that reached the mapper by another road still fits. */
const MAX_FINDINGS = 8
const MAX_STILL_OPEN = 20
const MAX_RELATED_REFS = 5
const MAX_QUOTES = 6
const MAX_VERDICT_QUOTES = 3
const MIN_TEXT = 3
const MAX_TITLE = 140
const MAX_DETAIL = 600
const MAX_QUOTE = 300
const MAX_KEY = 16
const MAX_REF = 8
const MAX_VERDICT_KEY = 8
const MAX_DOCUMENT_TYPE = 80
const MAX_REMEDY_TITLE = 160
const MAX_REMEDY_BODY = 40_000
const MAX_PLACEHOLDERS = 30
const MAX_PLACEHOLDER_LABEL = 120
const MAX_PLACEHOLDER_REASON = 200

/** One line of text: whitespace collapsed, ends trimmed, cut to the bound. */
const lineOf = (text: string, max: number): string => text.replace(/\s+/g, " ").trim().slice(0, max).trimEnd()

/** A paragraph of text: ends trimmed, cut to the bound. */
const textOf = (text: string, max: number): string => text.trim().slice(0, max).trimEnd()

/** The quotes with a key, trimmed and cut, at most `max` of them. */
const quotesOf = (quotes: ReadonlyArray<CitedQuote>, max: number): Array<CitedQuote> =>
    quotes
        .map((item) => ({ key: lineOf(item.key, MAX_KEY), quote: lineOf(item.quote, MAX_QUOTE) }))
        .filter((item) => item.key !== "")
        .slice(0, max)

/** The first `max` distinct non-empty references. */
const refsOf = (refs: ReadonlyArray<string>): Array<string> =>
    [...new Set(refs.map((ref) => lineOf(ref, MAX_REF)).filter((ref) => ref !== ""))].slice(0, MAX_RELATED_REFS)

/** One finding trimmed to its bounds, or null when nothing readable is left of its title, detail or evidence. */
const findingOf = (finding: DossierReviewAnswer["findings"][number]): ReasonedFinding | null => {
    const title = lineOf(finding.title, MAX_TITLE)
    const detail = textOf(finding.detail, MAX_DETAIL)
    const evidence = quotesOf(finding.evidence, MAX_QUOTES)
    if (title.length < MIN_TEXT || detail.length < MIN_TEXT || evidence.length === 0) return null
    const documentType = finding.documentType === null ? "" : lineOf(finding.documentType, MAX_DOCUMENT_TYPE)
    return {
        kind: finding.kind,
        severity: finding.severity,
        title,
        detail,
        evidence,
        relatedRefs: refsOf(finding.relatedRefs),
        remedyAction: finding.remedyAction,
        documentType: documentType === "" ? null : documentType,
    }
}

/** The parsed review answer as the port's value: every text trimmed to its bound, findings with nothing readable dropped. */
export const toReasonedReview = (answer: DossierReviewAnswer, figures: CallFigures): ReasonedReview => ({
    findings: answer.findings
        .map(findingOf)
        .filter((finding): finding is ReasonedFinding => finding !== null)
        .slice(0, MAX_FINDINGS),
    stillOpen: answer.stillOpen.slice(0, MAX_STILL_OPEN).map((verdict) => ({
        key: lineOf(verdict.key, MAX_VERDICT_KEY),
        applies: verdict.applies,
        evidence: quotesOf(verdict.evidence, MAX_VERDICT_QUOTES),
    })),
    model: figures.model,
    promptTokens: figures.promptTokens,
    completionTokens: figures.completionTokens,
})

/** The parsed draft as the port's value, or null when the title or the body is empty once trimmed. */
export const toRemedyText = (answer: RemedyAnswer, model: string): RemedyText | null => {
    const title = lineOf(answer.title, MAX_REMEDY_TITLE)
    const body = textOf(answer.body, MAX_REMEDY_BODY)
    if (title === "" || body === "") return null
    return {
        title,
        documentType: lineOf(answer.documentType, MAX_DOCUMENT_TYPE),
        body,
        placeholders: answer.placeholders
            .map((item) => ({
                label: lineOf(item.label, MAX_PLACEHOLDER_LABEL),
                reason: lineOf(item.reason, MAX_PLACEHOLDER_REASON),
            }))
            .filter((item) => item.label !== "")
            .slice(0, MAX_PLACEHOLDERS),
        model,
    }
}
