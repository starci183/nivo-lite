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

/** What a decided card did. */
export interface CardResult {
    /** `applied`, `rejected`, `kept_current` or the outcome of the brain. */
    readonly outcome: string
    /** The fact written. */
    readonly factId?: string
    /** How a conflicting value was settled. */
    readonly resolution?: string
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

/** One confirm card: the setup chat proposes Second Brain facts only (rule and branch cards are gone with the authority rules, 2026-11-13). */
export type CardRecord = FactCardRecord

/** A card, or null when none matches. */
export type OptionalCardRecord = CardRecord | null

/** One card a turn proposes, before it is stored. */
export interface ProposedCardRecord {
    /** The gate it answers. */
    readonly gate_key: string
    /** Always a fact. */
    readonly kind: "fact"
    /** The target key. */
    readonly target_key: string
    /** The payload. */
    readonly payload: FactCardPayload
}

/** How a waiting card was closed. */
export interface CardClosing {
    /** Applied or rejected. */
    readonly status: "applied" | "rejected"
    /** The payload as decided, with the edits of the owner. */
    readonly payload: FactCardPayload
    /** What was written. */
    readonly result: CardResult
    /** Who decided. */
    readonly decidedBy: string
}
