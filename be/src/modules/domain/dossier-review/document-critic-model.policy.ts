import { foldText } from "./document-state.policy"
import {
    CRITIC_CAPS,
    isCriticKind,
    type CriticCandidate,
    type CriticChoice,
    type CriticFact,
    type CriticKind,
    type CriticPassage,
    type CriticPoint,
    type CriticQuote,
    type CritiqueInput,
} from "./document-critic.contracts"
import type { CritiqueAnswer, CritiqueBundle, CritiqueFinding } from "./document-critic.port"
import { modelSubjectOf } from "./document-critic-reconcile.policy"
import { ownHashesOf } from "./document-critic-rules.policy"
import { inputChoice, removeChoice, valueChoice } from "./document-critic-text.policy"
import type { BundleItem } from "./dossier-review.port"
import { normalizeQuote } from "./evidence.policy"

/** What a key of the bundle stands for. */
type Keyed =
    | { readonly type: "passage"; readonly passage: CriticPassage; readonly changed: boolean }
    | { readonly type: "fact"; readonly fact: CriticFact }
    | { readonly type: "shop"; readonly candidate: CriticCandidate }

/** A bundle and what each of its keys stands for. */
export interface BuiltCritique {
    /** What the model reads. */
    readonly bundle: CritiqueBundle
    /** Key → item. */
    readonly keys: ReadonlyMap<string, Keyed>
    /** Key → the text the quote must be copied from. */
    readonly texts: ReadonlyMap<string, string>
    /** The hashes of the passages the model critiques. */
    readonly changed: ReadonlySet<string>
    /** The prompt size in characters, for the budget. */
    readonly chars: number
}

const within = <T extends { readonly text: string }>(items: ReadonlyArray<T>, max: number): Array<T> => {
    const kept: Array<T> = []
    let used = 0
    for (const item of items) {
        if (used + item.text.length > max) break
        kept.push(item)
        used += item.text.length
    }
    return kept
}

const factText = (fact: CriticFact): string =>
    `${fact.subjectLabel} - ${fact.attributeLabel}: ${fact.value}${fact.unit === null ? "" : ` ${fact.unit}`}`

const shopText = (candidate: CriticCandidate): string =>
    `${factText(candidate.fact)} [${candidate.fact.status === "active" ? "in force" : "waiting"}${
        candidate.sourceTitle === null ? "" : ` · ${candidate.sourceTitle}`
    }]`

/** The passages a model call critiques: all of them on the first upload, else those whose hash no finished critique read. */
export const changedPassages = (input: CritiqueInput): ReadonlyArray<CriticPassage> =>
    input.passages.filter((passage) => !input.reviewed.has(passage.hash))

/**
 * The bundle of ONE model call for a document: the changed passages (P), the unchanged ones as context (C, within a cap), the facts born
 * from the changed passages (F; on the first upload every fact), what the shop holds on the same things (T), and the rule points already
 * found (K). Answers null when nothing changed: no call.
 */
export const buildCritique = (input: CritiqueInput, known: ReadonlyArray<CriticPoint>): BuiltCritique | null => {
    const changed = within(changedPassages(input), CRITIC_CAPS.changedChars)
    if (changed.length === 0) return null
    const changedHashes = new Set(changed.map((passage) => passage.hash))
    const firstUpload = input.reviewed.size === 0
    const context = firstUpload
        ? []
        : within(
              input.passages.filter((passage) => !changedHashes.has(passage.hash)),
              CRITIC_CAPS.contextChars,
          )
    const facts = input.facts
        .filter((fact) => firstUpload || fact.chunkHash === null || changedHashes.has(fact.chunkHash))
        .slice(0, CRITIC_CAPS.facts)
    const shop = [
        ...new Map(
            facts.flatMap((fact) => (input.candidates.get(fact.id) ?? []).map((candidate) => [candidate.fact.id, candidate] as const)),
        ).values(),
    ].slice(0, CRITIC_CAPS.facts)
    const keys = new Map<string, Keyed>()
    const texts = new Map<string, string>()
    const item = (key: string, text: string, keyed: Keyed): BundleItem => {
        keys.set(key, keyed)
        texts.set(key, text)
        return { key, text }
    }
    const bundle: CritiqueBundle = {
        workspaceId: input.workspaceId,
        today: input.today,
        title: input.title,
        firstUpload,
        changed: changed.map((passage, index) =>
            item(`P${index + 1}`, passage.text, { type: "passage", passage, changed: true }),
        ),
        context: context.map((passage, index) =>
            item(`C${index + 1}`, passage.text, { type: "passage", passage, changed: false }),
        ),
        facts: facts.map((fact, index) => item(`F${index + 1}`, factText(fact), { type: "fact", fact })),
        shop: shop.map((candidate, index) => item(`T${index + 1}`, shopText(candidate), { type: "shop", candidate })),
        known: known.map((point, index) => ({ key: `K${index + 1}`, text: `${point.kind}: ${point.line}` })),
    }
    const chars = [...texts.values(), ...bundle.known.map((one) => one.text)].reduce((sum, text) => sum + text.length, 0)
    return { bundle, keys, texts, changed: changedHashes, chars }
}

const severityOf = (value: string): CriticPoint["severity"] =>
    value === "high" || value === "low" ? value : "medium"

/** The quote of a cited key, when the words are really in it (folded, whitespace collapsed). */
const quoteOfKey = (built: BuiltCritique, input: CritiqueInput, key: string, words: string): CriticQuote | null => {
    const keyed = built.keys.get(key)
    const text = built.texts.get(key)
    const quote = words.trim().slice(0, CRITIC_CAPS.quoteMax)
    if (keyed === undefined || text === undefined || quote.length < 3) return null
    if (!normalizeQuote(foldText(text)).includes(normalizeQuote(foldText(quote)))) return null
    if (keyed.type === "passage") {
        const words = foldText(quote)
        const born = input.facts.find(
            (fact) =>
                fact.chunkHash === keyed.passage.hash &&
                fact.quote !== null &&
                (words.includes(foldText(fact.quote)) || foldText(fact.quote).includes(words)),
        )
        return { text: quote, passageId: keyed.passage.id, chunkHash: keyed.passage.hash, role: "this", factId: born?.id ?? null, sourceId: input.sourceId, sourceTitle: input.title }
    }
    if (keyed.type === "fact") {
        return { text: keyed.fact.quote ?? quote, passageId: input.passages.find((one) => one.hash === keyed.fact.chunkHash)?.id ?? null, chunkHash: keyed.fact.chunkHash, role: "this", factId: keyed.fact.id, sourceId: input.sourceId, sourceTitle: input.title }
    }
    return { text: quote, passageId: null, chunkHash: keyed.candidate.fact.chunkHash, role: "other", factId: keyed.candidate.fact.id, sourceId: null, sourceTitle: keyed.candidate.sourceTitle }
}

/** The buttons of a model point: built by the core from what it cites, never taken as instructions from the model. */
const choicesOf = (
    say: CritiqueInput["say"],
    kind: CriticKind,
    quotes: ReadonlyArray<CriticQuote>,
    values: ReadonlyArray<string>,
    against: CriticCandidate | null,
): ReadonlyArray<CriticChoice> => {
    const own = quotes.filter((quote) => quote.role === "this")
    const ownFact = own.find((quote) => quote.factId !== null)?.factId ?? null
    const [first, second] = values
    switch (kind) {
        case "inside_contradiction": {
            const facts = own.filter((quote) => quote.factId !== null)
            if (first !== undefined && second !== undefined) {
                return [valueChoice("a", first, first, facts[0]?.factId ?? null), valueChoice("b", second, second, facts[1]?.factId ?? null)]
            }
            return [inputChoice("a", say("choice.fill_right"), say("hint.right"), ownFact)]
        }
        case "shop_contradiction":
        case "other_document":
            if (against === null) return [inputChoice("a", say("choice.fill_right"), say("hint.right"), ownFact)]
            return [
                { id: "a", label: say(kind === "shop_contradiction" ? "choice.by_file" : "choice.use_file"), needsInput: false, inputHint: null, answer: { kind: "keep_document", factId: ownFact, value: first ?? null } },
                kind === "shop_contradiction"
                    ? { id: "b", label: say("choice.by_shop", { value: against.fact.value }), needsInput: false, inputHint: null, answer: { kind: "keep_shop", factId: against.fact.id, value: against.fact.value } }
                    : valueChoice("b", say("choice.keep_value", { value: against.fact.value }), against.fact.value, against.fact.id),
            ]
        case "typo":
        case "arithmetic":
            return [
                first === undefined
                    ? inputChoice("a", say("choice.fix"), say("hint.right"), ownFact)
                    : { id: "a", label: say("choice.fix_to", { value: first }), needsInput: false, inputHint: null, answer: { kind: "value", factId: ownFact, value: first } },
                { id: "b", label: say("choice.keep"), needsInput: false, inputHint: null, answer: { kind: "keep_document", factId: ownFact, value: null } },
            ]
        case "stale_date":
            return [removeChoice("a", say("choice.ended"), ownFact), inputChoice("b", say("choice.fix_date"), say("hint.until"), ownFact)]
        default:
            return [inputChoice("a", say("choice.clarify"), say("hint.concrete"), ownFact), removeChoice("b", say("choice.drop"), ownFact)]
    }
}

/** Why a model point was dropped. */
export type ModelDrop = "bad_kind" | "no_quote" | "unchanged_only" | "known"

/** What the guard kept and why it dropped the rest. */
export interface GuardedCritique {
    /** The model points that hold. */
    readonly kept: ReadonlyArray<CriticPoint>
    /** Why the others were dropped. */
    readonly dropped: ReadonlyArray<ModelDrop>
}

const pointOf = (finding: CritiqueFinding, built: BuiltCritique, input: CritiqueInput): CriticPoint | ModelDrop => {
    if (!isCriticKind(finding.kind)) return "bad_kind"
    const quotes = finding.quotes.flatMap((cited) => {
        const quote = quoteOfKey(built, input, cited.key, cited.quote)
        return quote === null ? [] : [quote]
    })
    if (!quotes.some((quote) => quote.role === "this")) return "no_quote"
    if (!quotes.some((quote) => quote.role === "this" && quote.chunkHash !== null && built.changed.has(quote.chunkHash))) return "unchanged_only"
    const cited = finding.quotes.map((one) => built.keys.get(one.key)).find((keyed) => keyed?.type === "shop")
    const against = cited?.type === "shop" ? cited.candidate : null
    const ordered = [...quotes.filter((quote) => quote.role === "this"), ...quotes.filter((quote) => quote.role === "other")].slice(0, 8)
    return {
        kind: finding.kind,
        origin: "ai",
        severity: severityOf(finding.severity),
        subject: modelSubjectOf(ordered),
        line: finding.line.slice(0, 200),
        why: finding.why.slice(0, 600),
        question: finding.question.slice(0, 300),
        quotes: ordered,
        against:
            against === null
                ? null
                : { kind: against.fact.status === "active" ? "truth" : "proposal", value: against.fact.value, sourceTitle: against.sourceTitle, factId: against.fact.id },
        choices: choicesOf(input.say, finding.kind, ordered, finding.values.slice(0, 2), against),
    }
}

/** The folded quotes a point takes from this document. */
const ownWords = (point: CriticPoint): ReadonlyArray<string> =>
    point.quotes.filter((quote) => quote.role === "this").map((quote) => normalizeQuote(foldText(quote.text)))

/** The facts of this document a point is about, sorted. */
const ownFacts = (point: CriticPoint): string =>
    point.quotes
        .filter((quote) => quote.role === "this" && quote.factId !== null)
        .map((quote) => quote.factId ?? "")
        .sort((a, b) => a.localeCompare(b))
        .join(",")

/** True when two points of one kind are the same doubt: the same passages and facts, or overlapping words of this document. */
const samePoint = (a: CriticPoint, b: CriticPoint): boolean => {
    if (a.kind !== b.kind) return false
    if (ownHashesOf(a) === ownHashesOf(b) && ownFacts(a) === ownFacts(b)) return true
    const words = ownWords(b)
    return ownWords(a).some((one) => words.some((other) => one.includes(other) || other.includes(one)))
}

/**
 * Keeps a model point only when it holds: a known kind, at least one quote copied verbatim from this document, at least one quote from a
 * CHANGED passage (a later upload is critiqued only where it changed), and not a repeat of a rule point (or of an earlier model point):
 * same kind on the same passages and facts, or on overlapping words. Two different items of one passage are two points.
 */
export const guardCritique = (
    answer: CritiqueAnswer,
    built: BuiltCritique,
    input: CritiqueInput,
    known: ReadonlyArray<CriticPoint>,
): GuardedCritique => {
    const kept: Array<CriticPoint> = []
    const dropped: Array<ModelDrop> = []
    for (const finding of answer.findings.slice(0, CRITIC_CAPS.findingsPerCall)) {
        const point = pointOf(finding, built, input)
        if (typeof point === "string") {
            dropped.push(point)
            continue
        }
        if ([...known, ...kept].some((other) => samePoint(point, other))) {
            dropped.push("known")
            continue
        }
        kept.push(point)
    }
    return { kept, dropped }
}
