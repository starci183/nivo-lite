import type { FactRecord } from "@modules/domain/brain-facts"
import { injector, type TypedParameterDecorator } from "@modules/platform/composition"

/** One keyed piece of text the model may cite. */
export interface BundleItem {
    /** The key the model cites. */
    readonly key: string
    /** The text. */
    readonly text: string
}

/** Everything the critic model reads about one document; keys are the only way to cite. */
export interface CritiqueBundle {
    /** The workspace that pays. */
    readonly workspaceId: string
    /** Today, YYYY-MM-DD. */
    readonly today: string
    /** The document's title. */
    readonly title: string
    /** What kind of document this is, as its triage judged it (`CritiqueInput.nature`); absent or null when nobody judged it. */
    readonly nature?: string | null
    /** True on the first upload, false when only the changed passages are sent. */
    readonly firstUpload: boolean
    /** The passages to critique (P1 ...): all of them on the first upload, the changed ones later. */
    readonly changed: ReadonlyArray<BundleItem>
    /** Unchanged passages given as context only (C1 ...). */
    readonly context: ReadonlyArray<BundleItem>
    /** The facts read from the document (F1 ...), one line each. */
    readonly facts: ReadonlyArray<BundleItem>
    /** What the shop already holds on the same things (T1 ...): truths in force and waiting proposals, one line each. */
    readonly shop: ReadonlyArray<BundleItem>
    /** What the rules already found (K1 ...): not to be repeated. */
    readonly known: ReadonlyArray<BundleItem>
}

/** A quote the model cites by key. */
export interface CritiqueQuote {
    /** The key. */
    readonly key: string
    /** The words, copied from the cited item. */
    readonly quote: string
}

/** One point the model raises: a question to the founder, never a change. */
export interface CritiqueFinding {
    /** One of the critic kinds. */
    readonly kind: string
    /** high, medium or low. */
    readonly severity: string
    /** The one line the founder reads. */
    readonly line: string
    /** Why it doubts it. */
    readonly why: string
    /** The question to ask the founder. */
    readonly question: string
    /** The cited quotes. */
    readonly quotes: ReadonlyArray<CritiqueQuote>
    /** Up to two values the founder could choose between (the model's suggestion; the core decides the buttons). */
    readonly values: ReadonlyArray<string>
}

/** What one critique call answered, with its usage. */
export interface CritiqueAnswer {
    /** The points. */
    readonly findings: ReadonlyArray<CritiqueFinding>
    /** The model. */
    readonly model: string
    /** Prompt tokens, when reported. */
    readonly promptTokens: number | null
    /** Completion tokens, when reported. */
    readonly completionTokens: number | null
    /**
     * The points of the answer that did not fit the shape of a point (an unknown kind, a missing field) and were left out, each with
     * why: the other points stand (D-N-2: one bad point never voids an answer). Absent when every point fitted.
     */
    readonly refused?: ReadonlyArray<RefusedFinding>
}

/** A point of an answer that was left out because it did not fit the shape of a point. */
export interface RefusedFinding {
    /** The kind it gave, as written (cut to 40 characters), or "" when it gave none. */
    readonly kind: string
    /** Why: `kind` (not a critic kind) or `shape` (a field missing or of another type). */
    readonly problem: "kind" | "shape"
}

/**
 * Why a try gave no answer: `unavailable` (the model did not answer: a timeout, a provider error), `unreadable` (it answered
 * something that is not the JSON object asked for), `cut` (its answer was cut at the token cap, told by the finish reason).
 */
export type CritiqueFailure = "unavailable" | "unreadable" | "cut"

/** The outcome of one try: an answer, or why there is none. */
export type CritiqueTry =
    | { readonly ok: true; readonly answer: CritiqueAnswer }
    | { readonly ok: false; readonly reason: CritiqueFailure }

/** The critic model: ONE call per try, no retry inside (the core counts the three tries). */
export interface DocumentCriticModel {
    /**
     * Critiques one bundle once. `after` is why the try before this one gave no answer, when the core asks again over the same
     * bundle: the model is then told what was wrong with its answer, so the second call is never the first one sent again.
     * `attempt` is the number of this try as the core counts it (absent: 2 after an unreadable answer, else 1).
     */
    critique(bundle: CritiqueBundle, after?: "unreadable", attempt?: number): Promise<CritiqueTry>
}

/** Token of the critic model. */
export const DOCUMENT_CRITIC_MODEL: unique symbol = Symbol("domain.dossier-review.document-critic-model")

/** Injects the critic model. Parameter type: DocumentCriticModel. */
export const InjectDocumentCriticModel = (): TypedParameterDecorator<DocumentCriticModel> =>
    injector<DocumentCriticModel>(DOCUMENT_CRITIC_MODEL)

/** A fact of the shop that speaks of the same thing as a fact of a document. */
export interface TruthCandidate {
    /** The fact. */
    readonly fact: FactRecord
    /** Its distance by meaning; null for an exact key match. */
    readonly distance: number | null
    /** How it was found. */
    readonly match: "key" | "vector" | "named"
}

/** Options of a candidate read. */
export interface TruthCandidateOptions {
    /** At most this many per fact. */
    readonly perFact: number
    /** Drop facts whose only evidence is this document. */
    readonly excludeSourceId: string | null
}

/**
 * The facts in force and the waiting proposals of the same key as the given facts, for the critic's rules (bound to the exact-key
 * read of this module, `KeyedTruthCandidatesService`). Agreed signature: LG-REQUESTS "## BG3 first note".
 */
export interface ShopTruthCandidates {
    /** Per fact id, its candidates, nearest first. */
    candidatesFor(
        workspaceId: string,
        facts: ReadonlyArray<FactRecord>,
        options: TruthCandidateOptions,
    ): Promise<ReadonlyMap<string, ReadonlyArray<TruthCandidate>>>
}

/** Token of the candidate read. */
export const SHOP_TRUTH_CANDIDATES: unique symbol = Symbol("domain.dossier-review.shop-truth-candidates")

/** Injects the candidate read. Parameter type: ShopTruthCandidates. */
export const InjectShopTruthCandidates = (): TypedParameterDecorator<ShopTruthCandidates> =>
    injector<ShopTruthCandidates>(SHOP_TRUTH_CANDIDATES)
