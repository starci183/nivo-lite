import type { RuleMode } from "@modules/domain/authority-rules"
import type { BrainSubjectType, Scope } from "@modules/domain/brain-facts"

/** The states of a confirm card of the setup chat. */
export type CardStatus = "proposed" | "applied" | "rejected" | "superseded"

/** A fact the owner is asked to confirm: subject, attribute, value and who may read it. */
export interface FactCardPayload {
    /** What the fact is about. */
    readonly subjectType: BrainSubjectType
    /** The subject as people write it. */
    readonly subjectLabel: string
    /** The attribute as people write it. */
    readonly attributeLabel: string
    /** The value. */
    readonly value: string
    /** Who may read it. */
    readonly scope: Scope
    /** The customer question the fact answers, when it does. */
    readonly gapId?: string
}

/** A rule change the owner is asked to confirm: the complete resulting rule of one action. */
export interface RuleCardPayload {
    /** The authority action. */
    readonly action: string
    /** Which field the answer set. */
    readonly field: "mode" | "limit_vnd"
    /** The resulting mode. */
    readonly mode: RuleMode
    /** The resulting limit, VND; null for none. */
    readonly limitVnd: number | null
}

/** A branch of an action graph the owner is asked to confirm: where the band that runs alone ends, and who is asked above it. */
export interface BranchCardPayload {
    /** The authority action whose bands the card is about. */
    readonly action: string
    /** The amount in dong where the lower band ends and the higher one begins. */
    readonly boundaryVnd: number
    /** Which band the amount itself belongs to; null until the owner has said, and the card cannot be confirmed before. */
    readonly belongsTo: "lower" | "higher" | null
    /** The name of the person the owner said is asked above the line, as the owner said it. */
    readonly approverName: string
    /** The seat of that person; null until it is found or chosen, and the card cannot be confirmed before. */
    readonly approverMemberId: string | null
    /** The words of the owner the card came from. */
    readonly quote: string
}

/** What a decided card did. */
export interface CardResult {
    /** `applied`, `rejected`, `kept_current` or the outcome of the brain. */
    readonly outcome: string
    /** The fact written. */
    readonly factId?: string
    /** How a conflicting value was settled. */
    readonly resolution?: string
    /** The rule written. */
    readonly ruleId?: string
}

interface CardBase {
    /** The card. */
    readonly id: string
    /** The workspace. */
    readonly workspaceId: string
    /** The session it belongs to. */
    readonly setupSessionId: string
    /** The owner message it came from. */
    readonly sourceMessageId: string | null
    /** The gate it answers. */
    readonly gateKey: string
    /** The target: one waiting card per target. */
    readonly targetKey: string
    /** Where it stands. */
    readonly status: CardStatus
    /** What it did once decided. */
    readonly result: CardResult | null
    /** Who decided it. */
    readonly decidedBy: string | null
    /** When it was proposed, ISO 8601. */
    readonly createdAt: string
}

/** A card that proposes a Second Brain fact. */
export interface FactCardRecord extends CardBase {
    /** Discriminator. */
    readonly kind: "fact"
    /** The fact. */
    readonly payload: FactCardPayload
}

/** A card that proposes a branch of an action graph. */
export interface BranchCardRecord extends CardBase {
    /** Discriminator. */
    readonly kind: "branch"
    /** The branch. */
    readonly payload: BranchCardPayload
}

/** A card that proposes an authority rule. */
export interface RuleCardRecord extends CardBase {
    /** Discriminator. */
    readonly kind: "rule"
    /** The rule. */
    readonly payload: RuleCardPayload
}

/** One confirm card. */
export type CardRecord = FactCardRecord | RuleCardRecord | BranchCardRecord

/** A card, or null when none matches. */
export type OptionalCardRecord = CardRecord | null

/** One card a turn proposes, before it is stored. */
export interface ProposedCardRecord {
    /** The gate it answers. */
    readonly gate_key: string
    /** Fact, rule or branch. */
    readonly kind: "fact" | "rule" | "branch"
    /** The target key. */
    readonly target_key: string
    /** The payload. */
    readonly payload: FactCardPayload | RuleCardPayload | BranchCardPayload
}

/** How a waiting card was closed. */
export interface CardClosing {
    /** Applied or rejected. */
    readonly status: "applied" | "rejected"
    /** The payload as decided, with the edits of the owner. */
    readonly payload: FactCardPayload | RuleCardPayload | BranchCardPayload
    /** What was written. */
    readonly result: CardResult
    /** Who decided. */
    readonly decidedBy: string
}
