import type { FindingKind, FindingSeverity } from "./dossier-review.contracts"

/** What the critic of a shop document finds wrong; each kind belongs to one group the founder reads. */
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
] as const
/** One critic kind. */
export type CriticKind = (typeof CRITIC_KINDS)[number]

/** The groups the founder reads (four drawn by the owner, two more where no drawn label is true). */
export const CRITIC_GROUPS = ["inside", "shop", "typo", "other_document", "unclear", "stale"] as const
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
}

/** A fact of the shop that speaks of the same thing as a fact of the document. */
export interface CriticCandidate {
    /** The fact. */
    readonly fact: CriticFact
    /** Its distance by meaning, null for an exact key match. */
    readonly distance: number | null
    /** How it was found. */
    readonly match: "key" | "vector"
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
    /** Passages one critique reads; a longer document is read up to here and the rest is reviewed next time. */
    passages: 120,
    /** Characters of changed passages one model call reads. */
    changedChars: 16_000,
    /** Characters of unchanged context one model call reads. */
    contextChars: 8_000,
    /** Facts one model call reads. */
    facts: 80,
    /** Shop candidates per fact. */
    perFact: 3,
    /** Findings one model answer may give. */
    findingsPerCall: 12,
    /** Model calls per workspace per day for critiques. */
    dailyCalls: 60,
    /** Waiting critiques one review run carries out. */
    perRun: 10,
    /** The longest quote stored. */
    quoteMax: 300,
    /** The ratio from which two amounts of one thing look like a typing slip (a power of ten apart). */
    typoRatio: 9.5,
} as const
