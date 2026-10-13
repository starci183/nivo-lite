import type { RuleMode } from "@modules/domain/authority-rules"
import type { Scope } from "@modules/domain/brain-facts"
import type { ContextVersionRecord } from "@modules/domain/module-context-versions"
import type { InstallationRecord } from "@modules/domain/module-installations"
import type { SetupMessageRecord } from "@modules/domain/module-setup-messages"
import type { CardRecord } from "@modules/domain/module-setup-writes"
import type { SetupRevisionRecord, SetupSessionRecord } from "@modules/domain/module-setup-sessions"

/** The fact in force for the subject and attribute of a waiting fact card. */
export interface CurrentFact {
    /** Discriminator. */
    readonly kind: "fact"
    /** The value in force. */
    readonly value: string
    /** Who may read it. */
    readonly scope: Scope
    /** The modules that may read it, when restricted. */
    readonly modules: ReadonlyArray<string>
}

/** The rule in force for the action of a waiting rule card. */
export interface CurrentRule {
    /** Discriminator. */
    readonly kind: "rule"
    /** The mode in force. */
    readonly mode: RuleMode
    /** The limit in force, VND; null for none. */
    readonly limitVnd: number | null
}

/** A confirm card with the value it would replace. */
export interface SetupCardView {
    /** The card. */
    readonly card: CardRecord
    /** The value in force; null when the card is decided or nothing is in force. */
    readonly current: CurrentFact | CurrentRule | null
}

/** Everything the Setup tab of one instance needs. */
export interface SetupState {
    /** The instance. */
    readonly installation: InstallationRecord
    /** The open draft: new messages go here. */
    readonly session: SetupSessionRecord
    /** Every revision of the installation, oldest first. */
    readonly revisions: ReadonlyArray<SetupRevisionRecord>
    /** The whole chat across the revisions, oldest first. */
    readonly messages: ReadonlyArray<SetupMessageRecord>
    /** The confirm cards of the chat. */
    readonly cards: ReadonlyArray<SetupCardView>
    /** True while NIVO has not answered the last message of the owner yet. */
    readonly turnPending: boolean
}

/** The context versions of an installation with the one in use. */
export interface SetupVersions {
    /** The versions, newest first. */
    readonly versions: ReadonlyArray<ContextVersionRecord>
    /** The version in use; null before the first apply. */
    readonly activeVersionId: string | null
}

/** What storing an owner message answers: the message and the fact that NIVO is working on it. */
export interface PostedSetupMessage {
    /** The stored message. */
    readonly message: SetupMessageRecord
}

/** How the owner settled a fact that disagrees with the one in force. */
export type CardResolution = "replace" | "keep" | "both"

/** The decision of the owner on one confirm card, with the edits. */
export interface CardDecision {
    /** Confirm (optionally edited) or reject. */
    readonly decision: "confirm" | "reject"
    /** Fact edit: the value. */
    readonly value?: string
    /** Fact edit: who may read it. */
    readonly scope?: Scope
    /** Fact edit: the subject. */
    readonly subjectLabel?: string
    /** Fact edit: the attribute. */
    readonly attributeLabel?: string
    /** Rule edit: the mode. */
    readonly mode?: RuleMode
    /** Rule edit: the limit, VND; null for none. */
    readonly limitVnd?: number | null
    /** What to do with a value already in force. */
    readonly resolution?: CardResolution
    /** The situation the new value is for, when both values are kept. */
    readonly situation?: string
    /** The fact is for THIS instance only instead of every instance of the type. */
    readonly onlyThisAgent?: boolean
}
