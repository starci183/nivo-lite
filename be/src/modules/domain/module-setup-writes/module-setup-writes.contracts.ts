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

/** A card that proposes an authority rule. */
export interface RuleCardRecord extends CardBase {
    /** Discriminator. */
    readonly kind: "rule"
    /** The rule. */
    readonly payload: RuleCardPayload
}

/** One confirm card. */
export type CardRecord = FactCardRecord | RuleCardRecord

/** A card, or null when none matches. */
export type OptionalCardRecord = CardRecord | null

/** One card a turn proposes, before it is stored. */
export interface ProposedCardRecord {
    /** The gate it answers. */
    readonly gate_key: string
    /** Fact or rule. */
    readonly kind: "fact" | "rule"
    /** The target key. */
    readonly target_key: string
    /** The payload. */
    readonly payload: FactCardPayload | RuleCardPayload
}

/** How a waiting card was closed. */
export interface CardClosing {
    /** Applied or rejected. */
    readonly status: "applied" | "rejected"
    /** The payload as decided, with the edits of the owner. */
    readonly payload: FactCardPayload | RuleCardPayload
    /** What was written. */
    readonly result: CardResult
    /** Who decided. */
    readonly decidedBy: string
}
