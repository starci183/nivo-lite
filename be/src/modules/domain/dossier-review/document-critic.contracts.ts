import type { FindingKind, FindingSeverity } from "./dossier-review.contracts"

/**
 * Every kind a STORED point of the critic of a shop document may carry; each kind belongs to one group the founder reads. Old rows
 * keep their kinds and are still read and shown, but only `PRODUCED_RULE_KINDS` and `PRODUCED_MODEL_KINDS` are raised now (owner
 * 2026-11-12: documents are trusted; only contradictions between data and text addressed to an AI are asked about).
 */
export const CRITIC_KINDS = [
    "inside_contradiction",
    "shop_contradiction",
    "other_document",
    "typo",
    "arithmetic",
    "vague",
    "missing",
    "template",
    "stale_date",
    "addressed_to_ai",
    "hearsay",
    "undated",
] as const
/** One critic kind. */
export type CriticKind = (typeof CRITIC_KINDS)[number]

/**
 * The kinds the deterministic rules still raise: CONTRADICTIONS between data (ids and normal-form values only): one document giving
 * one key two values, a value against the one in force, a value against one waiting from another document.
 */
export const PRODUCED_RULE_KINDS = ["shop_contradiction", "other_document", "inside_contradiction"] as const

/** The one kind the passage critic model still raises: text addressed to an AI (a security flag, never a judgement of accuracy). */
export const PRODUCED_MODEL_KINDS = ["addressed_to_ai"] as const

const PRODUCED_RULE: ReadonlySet<CriticKind> = new Set<CriticKind>(PRODUCED_RULE_KINDS)
const PRODUCED_MODEL: ReadonlySet<CriticKind> = new Set<CriticKind>(PRODUCED_MODEL_KINDS)

/**
 * THE ONE PREDICATE of what a point may hold: true only for a kind that is still produced, raised by the side that produces it (a
 * contradiction by the rules, text addressed to an AI by the model). An open point of any other kind or origin (an old typo, vague,
 * template, hearsay ... point, or a contradiction the old model critic read) holds nothing and is closed at its document's next
 * critique. By kind and origin only.
 */
export const isProducedKind = (kind: CriticKind | null, origin: string): boolean =>
    kind !== null && (origin === "rule" ? PRODUCED_RULE.has(kind) : origin === "ai" && PRODUCED_MODEL.has(kind))

/**
 * The groups the founder reads (four drawn by the owner, two more where no drawn label is true, and `not_shop_word`: text addressed to
 * the AI instead of stating a rule of the shop, D-BR-7; the web words it as `brainCritique.group.not_shop_word`).
 */
export const CRITIC_GROUPS = ["inside", "shop", "typo", "other_document", "unclear", "stale", "not_shop_word"] as const
/** One group. */
export type CriticGroup = (typeof CRITIC_GROUPS)[number]

/** The group each kind is shown under. */
export const GROUP_OF: Readonly<Record<CriticKind, CriticGroup>> = {
    inside_contradiction: "inside",
    shop_contradiction: "shop",
    other_document: "other_document",
    typo: "typo",
    arithmetic: "typo",
    vague: "unclear",
    missing: "unclear",
    template: "unclear",
    stale_date: "stale",
    addressed_to_ai: "not_shop_word",
    hearsay: "unclear",
    undated: "unclear",
}

/** The kind each critic kind is stored under in `dossier_findings.kind` (the table's six kinds). */
export const STORED_KIND_OF: Readonly<Record<CriticKind, FindingKind>> = {
    inside_contradiction: "contradiction",
    shop_contradiction: "contradiction",
    other_document: "contradiction",
    typo: "unreasonable",
    arithmetic: "unreasonable",
    vague: "missing",
    missing: "missing",
    template: "missing",
    stale_date: "expired",
    addressed_to_ai: "unreasonable",
    hearsay: "missing",
    undated: "missing",
}

const KIND_SET: ReadonlySet<string> = new Set(CRITIC_KINDS)

/** True when a text is a critic kind. */
export const isCriticKind = (value: string): value is CriticKind => KIND_SET.has(value)

/** The prefix of the rule key of every finding of the shop-document critic: the dossier review never reconciles these. */
export const CRITIC_RULE_PREFIX = "shop."

/** The rule key of a critic finding. */
export const criticRuleKey = (kind: CriticKind): string => `${CRITIC_RULE_PREFIX}${kind}`

/** The critic kind of a stored rule key, or null for a dossier finding. */
export const criticKindOfRule = (ruleKey: string): CriticKind | null => {
    if (!ruleKey.startsWith(CRITIC_RULE_PREFIX)) return null
    const kind = ruleKey.slice(CRITIC_RULE_PREFIX.length)
    return isCriticKind(kind) ? kind : null
}

/** The identity of a pair of truths a contradiction point asks about, whichever side it is read from: the two ids, sorted. */
export const contradictionPairOf = (a: string, b: string): string => [a, b].sort((x, y) => x.localeCompare(y)).join("|")

/** A text that may be absent: the text, null or undefined. */
export type OptionalModelText = string | null | undefined

/** How the founder may answer a point; none of them puts a truth in force. */
export const ANSWER_KINDS = ["pick", "value", "keep_document", "keep_shop", "split", "remove"] as const
/** One answer kind. */
export type AnswerKind = (typeof ANSWER_KINDS)[number]

/** One concrete answer a point offers or receives. */
export interface CriticAnswer {
    /** What the answer does. */
    readonly kind: AnswerKind
    /** The fact it is about, when one is. */
    readonly factId: string | null
    /** The value it names, or null when the founder types it. */
    readonly value: string | null
    /** The condition a split value holds under. */
    readonly situation?: string | null
}

/** What a critique reads about a document, or null when the document is gone. */
export type OptionalCritiqueInput = CritiqueInput | null

/** One of the (at most two) buttons of a point. */
export interface CriticChoice {
    /** "a" or "b". */
    readonly id: "a" | "b"
    /** The words on the button. */
    readonly label: string
    /** True when the button needs a typed value. */
    readonly needsInput: boolean
    /** The placeholder of that input. */
    readonly inputHint: string | null
    /** What choosing it does. */
    readonly answer: CriticAnswer
}

/** What a point is compared with. */
export interface CriticAgainst {
    /** A truth in force, a waiting proposal, or another document. */
    readonly kind: "truth" | "proposal" | "document"
    /** Its value. */
    readonly value: string
    /** The document it comes from, when known. */
    readonly sourceTitle: string | null
    /** The fact. */
    readonly factId: string | null
}

/** A passage of the document under critique. */
export interface CriticPassage {
    /** The stored passage id. */
    readonly id: string
    /** Its order. */
    readonly order: number
    /** Its text (normalised as stored). */
    readonly text: string
    /** The model-free hash of its text (`passageTextHashOf`): the key facts' evidence carries. */
    readonly hash: string
}

/** A fact as the critic reads it. */
export interface CriticFact {
    /** The fact id. */
    readonly id: string
    /** The subject as written. */
    readonly subjectLabel: string
    /** The normalised subject. */
    readonly subjectKey: string
    /** The attribute as written. */
    readonly attributeLabel: string
    /** The attribute slug. */
    readonly attribute: string
    /** The value as written. */
    readonly value: string
    /** The unit. */
    readonly unit: string | null
    /** proposed or active (or another status for history). */
    readonly status: string
    /** The quote of this document that supports it, when any. */
    readonly quote: string | null
    /** The passage hash of that quote, when known. */
    readonly chunkHash: string | null
    /** The agent instance it is scoped to. */
    readonly installationId: string | null
    /** From when it holds, when a start was stated. */
    readonly validFrom?: string | null
    /** Until when it holds, when an end was stated. */
    readonly validTo?: string | null
    /** Who may read it (`public`, `internal` ...). */
    readonly scope?: string
}

/** A fact of the shop that speaks of the same thing as a fact of the document. */
export interface CriticCandidate {
    /** The fact. */
    readonly fact: CriticFact
    /** Its distance by meaning, null for an exact key match. */
    readonly distance: number | null
    /** How it was found: the same key, a near meaning, or `named` (the truth the same-meaning judgement linked the fact to). */
    readonly match: "key" | "vector" | "named"
    /** The title of the document it comes from, when any. */
    readonly sourceTitle: string | null
}

/** The words of the critic, read from its message catalog (`critic.<key>`, Vietnamese for the stored points); params fill `{{name}}`. */
export type CriticSay = (key: string, params?: Readonly<Record<string, string>>) => string

/** What one critique reads about one document. */
export interface CritiqueInput {
    /** The critic's words. */
    readonly say: CriticSay
    /** The workspace. */
    readonly workspaceId: string
    /** The document. */
    readonly sourceId: string
    /** Its title. */
    readonly title: string
    /** Today, YYYY-MM-DD. */
    readonly today: string
    /** Its passages in order. */
    readonly passages: ReadonlyArray<CriticPassage>
    /** The hashes of the passages a finished critique already read; empty on the first upload. */
    readonly reviewed: ReadonlySet<string>
    /** The waiting and active facts born from this document. */
    readonly facts: ReadonlyArray<CriticFact>
    /** Per fact id, the facts of the shop that speak of the same thing. */
    readonly candidates: ReadonlyMap<string, ReadonlyArray<CriticCandidate>>
    /**
     * The pairs of truths an open contradiction point of ANOTHER document already asks about (`contradictionPairOf`): the rules raise
     * no twin of it here. Absent: none.
     */
    readonly asked?: ReadonlySet<string>
}

/** One quoted place of a point. */
export interface CriticQuote {
    /** The words, verbatim. */
    readonly text: string
    /** The passage of this document, when it is one. */
    readonly passageId: string | null
    /** Its hash. */
    readonly chunkHash: string | null
    /** This document, or another one / the value in use. */
    readonly role: "this" | "other"
    /** The fact it backs, when any. */
    readonly factId: string | null
    /** The document it comes from. */
    readonly sourceId: string | null
    /** That document's title. */
    readonly sourceTitle: string | null
}

/** A point before it is stored. */
export interface CriticPoint {
    /** What is wrong. */
    readonly kind: CriticKind
    /** rule or ai. */
    readonly origin: "rule" | "ai"
    /** How much it matters; only high holds passages back from customers. */
    readonly severity: Exclude<FindingSeverity, "critical">
    /** What identifies it beside its quoted passages (a key, a folded label). */
    readonly subject: string
    /** The one line the founder reads (Vietnamese). */
    readonly line: string
    /** Why NIVO doubts it (Vietnamese). */
    readonly why: string
    /** The question to the founder (Vietnamese). */
    readonly question: string
    /** The quoted places, this document's first. */
    readonly quotes: ReadonlyArray<CriticQuote>
    /** What it is compared with. */
    readonly against: CriticAgainst | null
    /** At most two concrete choices. */
    readonly choices: ReadonlyArray<CriticChoice>
    /** What a typed value is filed under when the point cites no fact (a vague rule, a blank): the thing and what of it. */
    readonly target?: CriticTarget | null
    /**
     * Every truth of the document the point is about: the truths read from the lines it quotes (`namedTruths`), beside the one each
     * quote is tied to. A line may state two truths ("Don tu 3.000.000 d dat coc 500%": the threshold and the rate); the point
     * names both. Absent until the critique names them, just before it is stored.
     */
    readonly names?: ReadonlyArray<string>
    /**
     * True when EVERY quote the point takes from this document is a line a truth was read from (D-R-3): the point then holds exactly
     * the truths it names. False (or absent): one of its lines gave no truth, so what it holds cannot be told by name and it holds
     * its passages whole.
     */
    readonly namesAll?: boolean
}

/** The key a typed answer is filed under when no fact of the document stands for the point. */
export interface CriticTarget {
    /** The thing ("Giao nhanh"). */
    readonly subjectLabel: string
    /** What of it (the extra charge, the price). */
    readonly attributeLabel: string
}

/** The state of the critique of one document. */
export const CRITIQUE_STATES = ["waiting", "running", "done", "not_done"] as const
/** One critique state. */
export type CritiqueState = (typeof CRITIQUE_STATES)[number]

/** Why a critique is not done; never silent. */
export const NOT_DONE_REASONS = ["model", "credits", "facts_unread", "budget"] as const
/** One reason. */
export type NotDoneReason = (typeof NOT_DONE_REASONS)[number]

/** The state of a point as the founder reads it. */
export type PointState = "open" | "answered" | "skipped" | "gone"

/** The bounds of the critic, named once. */
export const CRITIC_CAPS = {
    /** Tries of the model per critique, in total (owner rule: 3). */
    tries: 3,
    /**
     * RUNS of one critique in a row that ended not done WITHOUT progress (D-V-1): stored in `brain_source_critiques.attempts`, which
     * survives a resume, a claim, a restart and the upkeep tick. At this count the critique is GIVEN UP: nothing asks for it again by
     * itself (only a new request: a reading ended, a founder's answer, a person's "read again"); its passages not reviewed stay
     * withheld from customers (no truth waits for it), and the team is told. A bound of runs, never a quota of calls. The table checks `attempts BETWEEN 0 AND 3`.
     */
    runs: 3,
    /**
     * Passages one model CALL reads. A document with more (or with more than `changedChars` of changed text) is reviewed in successive
     * calls of the same critique until every changed passage has been reviewed: never a partly reviewed document that looks reviewed.
     */
    passages: 120,
    /**
     * A technical bound on the calls of ONE critique (never a quota): 40 calls of 16,000 characters is 640,000 characters, five times a
     * part. A critique that reached it ends `not_done` / `budget` with its waiting passages counted, and goes on when asked again.
     */
    callsPerCritique: 40,
    /** Characters of changed passages one model call reads. */
    changedChars: 16_000,
    /** Shop candidates per fact, by key and by meaning each. */
    perFact: 12,
    /**
     * Findings one model answer may give: a bound that keeps an answer finite, well above what 16,000 characters hold (brain walk 4:
     * at 12, a dense document's answer stopped at its bound and the lines beyond it were never raised).
     */
    findingsPerCall: 40,
    /**
     * Rule points of ONE kind listed one by one per document (D-N-4): the founder's list is bounded by design. The points beyond it
     * are rolled up into "N more of this kind" points (`rollUpPassages` passages each), which quote the passages of the points they
     * stand for, so a rolled-up point of a holding severity still holds every one of its passages: nothing is let through.
     */
    rulePointsPerKind: 12,
    /** Passages one roll-up point quotes (the evidence a stored point keeps). */
    rollUpPassages: 8,
    /**
     * Waiting critiques one review run carries out (a per-job batch, not a quota): when more wait, the run queues a follow-up run. There
     * is NO per-day count (owner 2026-11-11: no daily limit, only the plan's credit pool; every call is checked against it first).
     */
    perRun: 10,
    /** The longest quote stored. */
    quoteMax: 300,
} as const

/** How one run of a critique ended, as its count of runs reads it (`runsAfter`). */
export interface CritiqueRunEnd {
    /** Where the run left the critique. */
    readonly state: "done" | "not_done"
    /** Why it is not done; null when done. */
    readonly reason: NotDoneReason | null
    /** True when the run moved the critique on: a passage newly reviewed. */
    readonly progressed: boolean
    /** True when no later run could do more: every passage reviewed. */
    readonly exhausted: boolean
}

/**
 * The count of runs in a row without progress (`brain_source_critiques.attempts`) after a run that ended this way, from the count
 * before it: done is 0; a model failure with nothing left to read is `CRITIC_CAPS.runs` at once; progress is 0; a run the model or the
 * bound of calls stopped without progress counts one more (at most `CRITIC_CAPS.runs`); a run the empty credit pool stopped (no call
 * made) or whose truths were not read leaves the count as it was. Counts only, never what a text means.
 */
export const runsAfter = (before: number, end: CritiqueRunEnd): number => {
    const kept = Math.min(Math.max(before, 0), CRITIC_CAPS.runs)
    if (end.state === "done") return 0
    if (end.reason === "model" && end.exhausted) return CRITIC_CAPS.runs
    if (end.progressed) return 0
    return end.reason === "model" || end.reason === "budget" ? Math.min(kept + 1, CRITIC_CAPS.runs) : kept
}

/** True when a run ended a slice of work with progress and more to do: the critique waits again at once, behind the others. */
export const takesAnotherTurn = (end: CritiqueRunEnd): boolean => end.state === "not_done" && end.reason === "budget" && end.progressed

/** Where a critique stands, as `isGivenUp` reads it. */
export interface CritiqueRunCount {
    /** Its state. */
    readonly state: CritiqueState
    /** Its runs in a row without progress. */
    readonly attempts: number
}

/** True when a critique is GIVEN UP: not done after `CRITIC_CAPS.runs` runs in a row without progress; nothing asks for it by itself. */
export const isGivenUp = (row: CritiqueRunCount): boolean => row.state === "not_done" && row.attempts >= CRITIC_CAPS.runs
