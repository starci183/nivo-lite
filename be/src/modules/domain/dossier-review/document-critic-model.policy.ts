import { foldText } from "./text-fold.policy"
import { CRITIC_CAPS, type CriticPassage, type CriticPoint, type CriticQuote, type CritiqueInput } from "./document-critic.contracts"
import type { BundleItem, CritiqueAnswer, CritiqueBundle, CritiqueFinding } from "./document-critic.port"
import { kindDropOf, type ModelDrop } from "./document-critic-guard.policy"
import { modelSubjectOf } from "./document-critic-reconcile.policy"
import { ownHashesOf } from "./document-critic-rules.policy"
import { normalizeQuote } from "./evidence.policy"

/** A bundle and what each of its keys stands for. */
export interface BuiltCritique {
    /** What the model reads. */
    readonly bundle: CritiqueBundle
    /** Key → the passage it stands for. */
    readonly keys: ReadonlyMap<string, CriticPassage>
    /** Key → the text the quote must be copied from. */
    readonly texts: ReadonlyMap<string, string>
    /** The hashes of the passages the model critiques. */
    readonly changed: ReadonlySet<string>
    /** The prompt size in characters, for the budget. */
    readonly chars: number
}

/** The first items whose texts fit in `max` characters; with `atLeastOne`, the first item even when it alone is longer. */
const within = <T extends { readonly text: string }>(items: ReadonlyArray<T>, max: number, atLeastOne = false): Array<T> => {
    const kept: Array<T> = []
    let used = 0
    for (const item of items) {
        if (used + item.text.length > max && !(atLeastOne && kept.length === 0)) break
        kept.push(item)
        used += item.text.length
    }
    return kept
}

/** The passages a model call critiques: all of them on the first upload, else those whose hash no finished critique read. */
export const changedPassages = (input: CritiqueInput): ReadonlyArray<CriticPassage> =>
    input.passages.filter((passage) => !input.reviewed.has(passage.hash))

/**
 * The bundle of ONE model call for a document: the SECURITY read (D4, owner 2026-11-12). The model is asked one thing only: whether
 * a changed passage carries text addressed to an AI instead of stating something of the business. Every kind of document is read
 * the same way, so the bundle carries the changed passages (P) and nothing else: no context, no truths, no shop values, no rule
 * points (the `CritiqueBundle` shape keeps those members, empty). Answers null when nothing changed: no call. `window` is the most
 * characters of changed passages this call reads: the whole `changedChars` normally, less when the answer over a larger window was
 * cut at the token cap (the next try reads fewer passages; a passage longer than the window is still read, alone).
 */
export const buildCritique = (
    input: CritiqueInput,
    first: boolean = input.reviewed.size === 0,
    window: number = CRITIC_CAPS.changedChars,
): BuiltCritique | null => {
    // One call reads at most `window` characters and `passages` passages; the critique calls again for the rest.
    const changed = within(changedPassages(input), window, true).slice(0, CRITIC_CAPS.passages)
    if (changed.length === 0) return null
    const keys = new Map<string, CriticPassage>()
    const texts = new Map<string, string>()
    const item = (key: string, passage: CriticPassage): BundleItem => {
        keys.set(key, passage)
        texts.set(key, passage.text)
        return { key, text: passage.text }
    }
    const bundle: CritiqueBundle = {
        workspaceId: input.workspaceId,
        today: input.today,
        title: input.title,
        firstUpload: first,
        changed: changed.map((passage, index) => item(`P${index + 1}`, passage)),
        context: [],
        facts: [],
        shop: [],
        known: [],
    }
    const chars = [...texts.values()].reduce((sum, text) => sum + text.length, 0)
    return { bundle, keys, texts, changed: new Set(changed.map((passage) => passage.hash)), chars }
}

/**
 * The window (characters of changed passages) the try after a CUT answer reads: half of what the cut call read, so it reads fewer
 * passages and its answer is shorter. Null when the cut call read one passage: there is nothing left to halve.
 */
export const narrowerWindow = (built: BuiltCritique): number | null => {
    if (built.changed.size <= 1) return null
    const read = built.bundle.changed.reduce((sum, passage) => sum + passage.text.length, 0)
    return Math.max(1, Math.floor(read / 2))
}

/** The quote of a cited passage key, when the words are really in it (folded, whitespace collapsed). */
const quoteOfKey = (built: BuiltCritique, input: CritiqueInput, key: string, words: string): CriticQuote | null => {
    const passage = built.keys.get(key)
    const text = built.texts.get(key)
    const quote = words.trim().slice(0, CRITIC_CAPS.quoteMax)
    if (passage === undefined || text === undefined || quote.length < 3) return null
    if (!normalizeQuote(foldText(text)).includes(normalizeQuote(foldText(quote)))) return null
    return { text: quote, passageId: passage.id, chunkHash: passage.hash, role: "this", factId: null, sourceId: input.sourceId, sourceTitle: input.title }
}

export type { ModelDrop } from "./document-critic-guard.policy"

/** What the guard kept and why it dropped the rest. */
export interface GuardedCritique {
    /** The model points that hold. */
    readonly kept: ReadonlyArray<CriticPoint>
    /** Why the others were dropped. */
    readonly dropped: ReadonlyArray<ModelDrop>
}

/**
 * The point of a passage addressed to the AI as the model raised it: no value, no fact, no choice (the founder answers it as the
 * business's own text, or removes it). It is high, so the passage is withheld from customer-facing agents while it is open.
 */
const addressedPointOf = (finding: CritiqueFinding, own: ReadonlyArray<CriticQuote>, input: CritiqueInput): CriticPoint => {
    const quotes = own.slice(0, 8)
    return {
        kind: "addressed_to_ai",
        origin: "ai",
        severity: "high",
        subject: modelSubjectOf(quotes),
        line: input.say("addressed.line"),
        why: input.say("addressed.why", { quote: (quotes[0]?.text ?? finding.line).slice(0, 160) }),
        question: input.say("addressed.question"),
        quotes,
        against: null,
        choices: [],
    }
}

/** A model point that holds. */
interface KeptPoint {
    /** Discriminant: the point holds. */
    readonly ok: true
    /** The point. */
    readonly point: CriticPoint
}

/** A model point dropped, with why. */
interface DroppedPoint {
    /** Discriminant: the point does not hold. */
    readonly ok: false
    /** Why it was dropped. */
    readonly drop: ModelDrop
}

/** What the guard made of one model finding: a point that holds, or why it was dropped. */
type PointRead = KeptPoint | DroppedPoint

const pointOf = (finding: CritiqueFinding, built: BuiltCritique, input: CritiqueInput): PointRead => {
    const kind = kindDropOf(finding.kind)
    if (kind !== null) return { ok: false, drop: kind }
    const own = finding.quotes.flatMap((cited) => {
        const quote = quoteOfKey(built, input, cited.key, cited.quote)
        return quote === null ? [] : [quote]
    })
    if (own.length === 0) return { ok: false, drop: "no_quote" }
    if (!own.some((quote) => quote.chunkHash !== null && built.changed.has(quote.chunkHash))) return { ok: false, drop: "unchanged_only" }
    return { ok: true, point: addressedPointOf(finding, own, input) }
}

/** The folded quotes a point takes from this document. */
const ownWords = (point: CriticPoint): ReadonlyArray<string> =>
    point.quotes.filter((quote) => quote.role === "this").map((quote) => normalizeQuote(foldText(quote.text)))

/** True when two points are the same flag: the same passages, or overlapping words of this document. */
const samePoint = (a: CriticPoint, b: CriticPoint): boolean => {
    if (a.kind !== b.kind) return false
    if (ownHashesOf(a) === ownHashesOf(b)) return true
    const words = ownWords(b)
    return ownWords(a).some((one) => words.some((other) => one.includes(other) || other.includes(one)))
}

/**
 * Keeps a model point only when it holds: the ONE kind the model is asked about (`addressed_to_ai`; any other kind is dropped as
 * `removed_kind` and counted), at least one quote copied verbatim from a passage of this call, at least one of them CHANGED (a
 * later upload is read only where it changed), and not a repeat of an earlier point of the answer. Every drop is one point only.
 */
export const guardCritique = (answer: CritiqueAnswer, built: BuiltCritique, input: CritiqueInput): GuardedCritique => {
    const kept: Array<CriticPoint> = []
    const dropped: Array<ModelDrop> = []
    for (const finding of answer.findings.slice(0, CRITIC_CAPS.findingsPerCall)) {
        const read = pointOf(finding, built, input)
        if (!read.ok) {
            dropped.push(read.drop)
            continue
        }
        if (kept.some((other) => samePoint(read.point, other))) {
            dropped.push("known")
            continue
        }
        kept.push(read.point)
    }
    return { kept, dropped }
}
