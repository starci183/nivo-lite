import { AI_SEVERITIES, DOSSIER_REVIEW_CAPS, FINDING_SEVERITIES, isFindingKind } from "./dossier-review.contracts"
import type { FindingEvidence } from "./dossier-review.contracts"
import type { FindingCandidate } from "./dossier-inputs.contracts"
import { citedIds } from "./fingerprint.policy"

/** What evidence can be checked against: the titles of sources, the text of passages and the values and quotes of facts. */
export interface EvidenceCorpus {
    /** Source titles by id. */
    readonly sources: ReadonlyMap<string, string>
    /** Passage text by id. */
    readonly passages: ReadonlyMap<string, string>
    /** Fact values and evidence quotes by id. */
    readonly facts: ReadonlyMap<string, { readonly value: string; readonly quotes: ReadonlyArray<string> }>
}

/** Why a candidate was dropped. */
export type DropReason = "no_evidence" | "single_source_contradiction" | "bad_kind" | "bad_severity" | "duplicate_known"

/** An issue already known for the dossier: its kind and the sorted ids it cites. */
export interface KnownFinding {
    /** The kind. */
    readonly kind: string
    /** The sorted ids of the sources and facts. */
    readonly ids: ReadonlyArray<string>
}

/** What the guard kept and what it dropped, with the reason of each drop. */
export interface GuardOutcome {
    /** The candidates that passed, carrying only verified evidence. */
    readonly kept: ReadonlyArray<FindingCandidate>
    /** The reason of each dropped candidate. */
    readonly dropped: ReadonlyArray<DropReason>
}

/** The shortest quote that counts against a passage. */
const SHORT_QUOTE = 8

/** A text compared without composition, case or repeated whitespace. */
export const normalizeQuote = (text: string): string => text.normalize("NFC").replace(/\s+/gu, " ").trim().toLowerCase()

const isCitation = (item: FindingEvidence): boolean =>
    item.sourceId !== null || item.factId !== null || item.passageId !== null

const quoteHolds = (quote: string, held: ReadonlyArray<string>, exact: string | null): boolean => {
    const wanted = normalizeQuote(quote)
    if (exact !== null && wanted === normalizeQuote(exact)) return true
    return wanted.length >= SHORT_QUOTE && held.some((text) => normalizeQuote(text).includes(wanted))
}

/** Whether one evidence item holds: the passage, fact or source it cites exists and its quote is a verbatim part of it; an item that cites nothing (an expectation) holds. */
export const itemHolds = (item: FindingEvidence, corpus: EvidenceCorpus): boolean => {
    if (item.passageId !== null) {
        const text = corpus.passages.get(item.passageId)
        return text !== undefined && (item.quote === null || quoteHolds(item.quote, [text], null))
    }
    if (item.factId !== null) {
        const fact = corpus.facts.get(item.factId)
        return (
            fact !== undefined &&
            (item.quote === null || quoteHolds(item.quote, [fact.value, ...fact.quotes], fact.value))
        )
    }
    return item.sourceId === null || corpus.sources.has(item.sourceId)
}

const unitsOf = (evidence: ReadonlyArray<FindingEvidence>): number =>
    new Set(
        evidence.filter(isCitation).map((item) => (item.factId === null ? `s:${item.sourceId}` : `f:${item.factId}`)),
    ).size

const dropReasonOf = (
    candidate: FindingCandidate,
    evidence: ReadonlyArray<FindingEvidence>,
    known: ReadonlyArray<KnownFinding>,
): DropReason | null => {
    const severities: ReadonlyArray<string> = candidate.origin === "ai" ? AI_SEVERITIES : FINDING_SEVERITIES
    if (!isFindingKind(candidate.kind)) return "bad_kind"
    if (!severities.includes(candidate.severity)) return "bad_severity"
    const cited = evidence.filter(isCitation).length
    if (candidate.origin === "ai" ? cited === 0 : evidence.length === 0) return "no_evidence"
    if (candidate.kind === "contradiction" && unitsOf(evidence) < 2) return "single_source_contradiction"
    const ids = citedIds(evidence)
    const sorted = [...ids.sources, ...ids.facts].sort((a, b) => a.localeCompare(b)).join(",")
    const repeats = known.some(
        (item) => item.kind === candidate.kind && [...item.ids].sort((a, b) => a.localeCompare(b)).join(",") === sorted,
    )
    return candidate.origin === "ai" && repeats ? "duplicate_known" : null
}

/** The hallucination guard: keeps of each candidate only the evidence that verifies, then drops the candidate that has none left, is a contradiction on one document, has a kind or severity outside the enums, or repeats a known finding. */
export const guardCandidates = (
    candidates: ReadonlyArray<FindingCandidate>,
    corpus: EvidenceCorpus,
    known: ReadonlyArray<KnownFinding>,
): GuardOutcome => {
    const kept: Array<FindingCandidate> = []
    const dropped: Array<DropReason> = []
    for (const candidate of candidates) {
        const evidence = candidate.evidence
            .filter((item) => itemHolds(item, corpus))
            .slice(0, DOSSIER_REVIEW_CAPS.evidenceMax)
        const reason = dropReasonOf(candidate, evidence, known)
        if (reason === null) kept.push({ ...candidate, evidence })
        else dropped.push(reason)
    }
    return { kept, dropped }
}
