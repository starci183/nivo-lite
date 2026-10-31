import { dateIn, foldText } from "./document-state.policy"
import type {
    EvidenceRole,
    FindingEvidence,
    FindingKind,
    FindingSeverity,
    RemedyAction,
} from "./dossier-review.contracts"
import type {
    DocumentInput,
    DossierInputs,
    FindingCandidate,
    PassageInput,
    ReviewContext,
    ReviewFact,
} from "./dossier-inputs.contracts"

/** A family of deterministic rules: the candidates it finds in the dossiers of a pass. */
export type RuleFamily = (context: ReviewContext) => ReadonlyArray<FindingCandidate>

/** Whether a folded text holds a folded word or phrase as whole words. */
export const hasWord = (folded: string, word: string): boolean => {
    let from = folded.indexOf(word)
    while (from >= 0) {
        const before = folded.charAt(from - 1)
        const after = folded.charAt(from + word.length)
        if (!/[a-z0-9]/u.test(before) && !/[a-z0-9]/u.test(after)) return true
        from = folded.indexOf(word, from + 1)
    }
    return false
}

/** Whether a folded text holds any of the words. */
export const hasAnyWord = (folded: string, words: ReadonlyArray<string>): boolean =>
    words.some((word) => hasWord(folded, word))

const MULTIPLIERS: ReadonlyArray<readonly [RegExp, number]> = [
    [/\b(?:ty|billion)\b/u, 1_000_000_000],
    [/\b(?:trieu|million|tr)\b/u, 1_000_000],
]

/** The amount a fact gives: its number, else the first number of its value with its separators removed, times trieu or ty when the value says so; null when it gives none. */
export const amountOf = (fact: ReviewFact): number | null => {
    if (fact.valueNumber !== null) return fact.valueNumber
    const folded = foldText(fact.value)
    const match = /\d[\d.,\s]*/u.exec(folded)
    if (match === null) return null
    const digits = match[0].trim()
    const grouped = /^\d{1,3}(?:[.,\s]\d{3})+$/u.test(digits)
    const base = grouped ? Number(digits.replace(/[.,\s]/gu, "")) : Number(digits.replace(",", "."))
    const scale = MULTIPLIERS.find(([pattern]) => pattern.test(folded))?.[1] ?? 1
    return base * scale
}

/** The digits of an identifier a fact gives. */
export const digitsOf = (value: string): string => value.replace(/\D/gu, "")

/** The date a fact's value gives, else the start of its validity; null when it gives none. */
export const dateOfFact = (fact: ReviewFact): string | null => dateIn(fact.value) ?? fact.validFrom

/** Whether a fact's attribute is one of the slugs. */
export const isAttribute = (fact: ReviewFact, attributes: ReadonlyArray<string>): boolean =>
    attributes.includes(fact.attribute)

/** The dossier label people read: its reference and name. */
export const dossierLabel = (inputs: DossierInputs): string => `${inputs.dossier.ref}. ${inputs.dossier.name}`

/** The title of each document of the pass, by id. */
export const titlesOf = (context: ReviewContext): ReadonlyMap<string, string> =>
    new Map(context.dossiers.flatMap((inputs) => inputs.documents.map((doc) => [doc.id, doc.title] as const)))

/** The dossier each document of the pass files under, by document id. */
export const dossierOfSources = (context: ReviewContext): ReadonlyMap<string, DossierInputs> =>
    new Map(context.dossiers.flatMap((inputs) => inputs.documents.map((doc) => [doc.id, inputs] as const)))

/** Every fact of the pass once, in the order the dossiers list them. */
export const factsOfContext = (context: ReviewContext): ReadonlyArray<ReviewFact> => {
    const seen = new Map<string, ReviewFact>()
    for (const inputs of context.dossiers)
        for (const fact of inputs.facts) if (!seen.has(fact.id)) seen.set(fact.id, fact)
    return [...seen.values()]
}

/** The date a document bears, of every document of the pass, by id. */
export const datesOf = (context: ReviewContext): ReadonlyMap<string, string | null> =>
    new Map(context.dossiers.flatMap((inputs) => inputs.documents.map((doc) => [doc.id, doc.date] as const)))

/** The dossier a fact is filed under: the dossier of the first of its documents in the pass. */
export const dossierOfFact = (
    fact: ReviewFact,
    owners: ReadonlyMap<string, DossierInputs>,
): DossierInputs | undefined => fact.sourceIds.map((id) => owners.get(id)).find((owner) => owner !== undefined)

/** A fact as an evidence item: its value is the quote. */
export const factEvidence = (
    fact: ReviewFact,
    role: EvidenceRole,
    titles: ReadonlyMap<string, string>,
): FindingEvidence => {
    const titled = fact.sourceIds.flatMap((id) => {
        const title = titles.get(id)
        return title === undefined ? [] : [{ id, title }]
    })[0]
    return {
        role,
        label: fact.attributeLabel,
        sourceId: titled?.id ?? null,
        sourceTitle: titled?.title ?? null,
        passageId: null,
        factId: fact.id,
        factLine: `${fact.subject} - ${fact.attributeLabel}: ${fact.value}`,
        quote: fact.value,
    }
}

/** A document as an evidence item. */
export const documentEvidence = (doc: DocumentInput, role: EvidenceRole, label: string): FindingEvidence => ({
    role,
    label,
    sourceId: doc.id,
    sourceTitle: doc.title,
    passageId: null,
    factId: null,
    factLine: null,
    quote: null,
})

/** A verbatim part of a passage as an evidence item. */
export const passageEvidence = (
    doc: DocumentInput,
    passage: PassageInput,
    quote: string,
    role: EvidenceRole,
    label: string,
): FindingEvidence => ({
    role,
    label,
    sourceId: doc.id,
    sourceTitle: doc.title,
    passageId: passage.id,
    factId: null,
    factLine: null,
    quote,
})

/** What a dossier was expected to hold, as an evidence item that cites nothing. */
export const expectedEvidence = (label: string): FindingEvidence => ({
    role: "expected",
    label,
    sourceId: null,
    sourceTitle: null,
    passageId: null,
    factId: null,
    factLine: null,
    quote: null,
})

/** The words around a match of a passage, copied verbatim from its NFC text: at most `radius` characters on each side. */
export const quoteAround = (text: string, start: number, end: number, radius: number): string =>
    text.slice(Math.max(0, start - radius), Math.min(text.length, end + radius)).trim()

/** What a rule says about one finding; the rest of the candidate is filled in. */
export interface CandidateShape {
    /** The rule. */
    readonly ruleKey: string
    /** What identifies the finding within its rule. */
    readonly subject: string
    /** What is wrong. */
    readonly kind: FindingKind
    /** How much it matters. */
    readonly severity: FindingSeverity
    /** The message code its words are rendered from. */
    readonly code: string
    /** The message params. */
    readonly params: Readonly<Record<string, string>>
    /** The evidence. */
    readonly evidence: ReadonlyArray<FindingEvidence>
    /** What completes it. */
    readonly remedyAction: RemedyAction
    /** The other dossiers it touches. */
    readonly related?: ReadonlyArray<DossierInputs>
}

/** A rule candidate filed under a dossier; its title and detail are rendered later from its code. */
export const candidateOf = (dossier: DossierInputs, shape: CandidateShape): FindingCandidate => ({
    ruleKey: shape.ruleKey,
    dossierId: dossier.dossier.id,
    relatedDossierIds: [
        ...new Set((shape.related ?? []).map((other) => other.dossier.id).filter((id) => id !== dossier.dossier.id)),
    ].sort((a, b) => a.localeCompare(b)),
    kind: shape.kind,
    severity: shape.severity,
    origin: "rule",
    code: shape.code,
    params: shape.params,
    title: "",
    detail: "",
    evidence: shape.evidence.slice(0, 8),
    remedyAction: shape.remedyAction,
    remedyDocumentType: shape.remedyAction === "draft" ? (dossier.entry?.remedy?.documentType ?? null) : null,
    subject: shape.subject,
})

/** The remedy a dossier's pack entry names, else the fallback. */
export const remedyActionOf = (inputs: DossierInputs, fallback: RemedyAction): RemedyAction =>
    inputs.entry?.remedy?.action ?? fallback

/** The documents of a dossier in a state. */
export const documentsIn = (
    inputs: DossierInputs,
    states: ReadonlyArray<DocumentInput["state"]>,
): ReadonlyArray<DocumentInput> => inputs.documents.filter((doc) => states.includes(doc.state))

/** A date YYYY-MM-DD as people read it in the documents: dd/mm/yyyy. */
export const displayDate = (date: string): string => `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`

/** An amount with dots between the thousands, as the documents write it. */
export const displayAmount = (amount: number): string =>
    new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(amount)
