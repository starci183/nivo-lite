import { foldText } from "./document-state.policy"
import type { Expectation } from "./dossier-inputs.contracts"

/** What binds a document: its title, the folder or category it came under, and the opening of its text. */
export interface BindingDocument {
    /** The title. */
    readonly title: string
    /** The topic it was added under, if any. */
    readonly topic: string | null
    /** The opening passages of its text, joined. */
    readonly opening: string
}

/** A dossier a document may be filed under, with the words the pack expects its documents to carry. */
export interface BindingCandidate {
    /** The dossier id. */
    readonly id: string
    /** The checklist number. */
    readonly ref: string
    /** The category label. */
    readonly category: string
    /** The name. */
    readonly name: string
    /** What the checklist says is held. */
    readonly existing: string | null
    /** The drafts the checklist lists. */
    readonly drafts: string | null
    /** What the pack expects the dossier to hold. */
    readonly expects: ReadonlyArray<Pick<Expectation, "titleAny" | "textAny">>
}

/** The least score a dossier needs to take a document, and how far it must lead the next one. */
const MIN_SCORE = 6
const MIN_LEAD = 1.5

/** Words too common to tell two dossiers apart. */
const COMMON = new Set([
    "ho",
    "so",
    "theo",
    "doi",
    "cong",
    "ty",
    "cua",
    "va",
    "cho",
    "nivo",
    "tai",
    "lieu",
    "thuc",
    "te",
])

const tokensOf = (text: string): ReadonlyArray<string> =>
    foldText(text)
        .split(/[^a-z0-9]+/u)
        .filter((token) => token.length >= 3 && !COMMON.has(token) && !/^\d+$/u.test(token))

/** The text before the first of these marks, or all of it. */
const beforeMarks = (text: string, marks: ReadonlyArray<string>): string => {
    const at = marks.map((mark) => text.indexOf(mark)).filter((index) => index >= 0)
    return text.slice(0, Math.min(text.length, ...at))
}

/** A title without its number, its extension and its draft or sample marks: what the checklist would call it. */
const bareTitleOf = (title: string): string =>
    beforeMarks(
        foldText(title)
            .replace(/^d+[a-z]?./u, "")
            .replace(/.(pdf|docx?|xlsx?|pptx?|csv|txt|md)$/u, ""),
        [" - nivo", " - so theo doi"],
    ).trim()

const leadingNumberOf = (title: string): string | null => {
    const found = /^0*(d+).s/u.exec(title.trimStart())
    return found?.[1] ?? null
}

const share = (tokens: ReadonlyArray<string>, text: string): number =>
    tokens.length === 0 ? 0 : tokens.filter((token) => text.includes(token)).length / tokens.length

/** How well a dossier fits a document: its name against the title and the opening, its pack words, its checklist lines, its number and category. */
const scoreOf = (document: BindingDocument, candidate: BindingCandidate): number => {
    const title = foldText(document.title)
    const opening = foldText(document.opening).slice(0, 800)
    const nameTokens = tokensOf(candidate.name)
    const bare = bareTitleOf(document.title)
    const listed = foldText(`${candidate.existing ?? ""} ${candidate.drafts ?? ""}`)
    const parts = [
        6 * share(nameTokens, title),
        share(nameTokens, opening) === 1 ? 6 : 2 * share(nameTokens, opening),
        bare !== "" && foldText(candidate.name).includes(bare) ? 3 : 0,
        candidate.expects.some((one) => one.titleAny.some((word) => title.includes(word))) ? 6 : 0,
        candidate.expects.some((one) => one.textAny.some((word) => opening.includes(word))) ? 1 : 0,
        bare.length >= 8 && listed.includes(bare) ? 7 : 0,
        leadingNumberOf(document.title) === candidate.ref ? 4 : 0,
        document.topic !== null && foldText(document.topic) === foldText(candidate.category) ? 2 : 0,
    ]
    return parts.reduce((sum, part) => sum + part, 0)
}

/** The dossier a document belongs to by its content, title and category; null when no dossier clearly leads, so the document is reviewed on its own. */
export const bindingOf = (
    document: BindingDocument,
    candidates: ReadonlyArray<BindingCandidate>,
): BindingCandidate | null => {
    const ranked = candidates
        .map((candidate) => ({ candidate, score: scoreOf(document, candidate) }))
        .sort((a, b) => b.score - a.score)
    const [best, next] = ranked
    if (best === undefined || best.score < MIN_SCORE) return null
    return next !== undefined && best.score - next.score < MIN_LEAD ? null : best.candidate
}
