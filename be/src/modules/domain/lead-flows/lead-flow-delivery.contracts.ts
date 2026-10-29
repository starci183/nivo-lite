import type { MetaPageAccess } from "@modules/integrations/meta"
import type { Answer, LeadFlow, Platform, Score } from "./lead-flows.contracts"

/** Why a direct message did not go. */
export type DmRefusal = "window" | "tag_only" | "no_recipient" | "not_connected" | "failed"

/** What a direct message to a flow answered. */
export interface DmOutcome {
    /** Meta accepted it. */
    readonly ok: boolean
    /** Why it did not go. */
    readonly reason: DmRefusal | null
    /** The Meta failure behind `failed`. */
    readonly detail: string | null
}

/** What a reply under or to a comment answered. */
export interface CommentOutcome {
    /** Meta accepted it. */
    readonly ok: boolean
    /** The Meta failure. */
    readonly failure: string | null
    /** A private reply: the Messenger / Instagram id of the commenter it reached. */
    readonly recipientId: string | null
}

/** The texts of a turn the state machine needs the locale of. */
export interface ComposeAsk {
    /** The acknowledgement or answer first. */
    readonly reply: string
    /** The owner's question. */
    readonly question: string
    /** The thanks line used when there is no reply. */
    readonly thanks: string
}

/** What a handoff to Sales carries. */
export interface HandoffPack {
    /** The need. */
    readonly need: string | null
    /** The score. */
    readonly score: Score
    /** The answers. */
    readonly answers: ReadonlyArray<Answer>
    /** The first touch, as one line. */
    readonly sourceLine: string
    /** When the person last wrote. */
    readonly lastUserAt: string | null
    /** The labels of the lines, in the call's language. */
    readonly labels: HandoffLabels
}

/** The labels of the handoff lines. */
export interface HandoffLabels {
    /** "Answers". */
    readonly answers: string
    /** "Score". */
    readonly score: string
    /** "Source". */
    readonly source: string
    /** "Last message". */
    readonly lastMessage: string
}

/** The parts of a source line, as words in the call's language. */
export interface SourceWords {
    /** The kind of touch. */
    readonly kind: string
    /** "form". */
    readonly form: string
    /** "ad". */
    readonly ad: string
    /** "post". */
    readonly post: string
}

/** A text, or none. */
export type OptionalText = string | null

/** A flow, or none. */
export type OptionalLeadFlow = LeadFlow | null

/** The Page a connection answers through, or none. */
export type OptionalPage = MetaPageAccess | null

/** What a comment reply answered, or none when no Page could send it. */
export type OptionalCommentOutcome = CommentOutcome | null

/** The flow fields a direct message needs. */
export type DmTarget = Pick<LeadFlow, "connection_id" | "platform" | "psid" | "igsid">

/** A comment answered through a Page. */
export interface CommentTarget {
    /** The workspace the Page must belong to. */
    readonly workspaceId: string
    /** The connection of the Page. */
    readonly connectionId: string
    /** Facebook or Instagram. */
    readonly platform: Platform
    /** The comment. */
    readonly commentId: string
}

/** The text and author of an Instagram mention. */
export interface MentionRead {
    /** The text, when Meta gave it. */
    readonly text: string | null
    /** The author, when Meta gave it. */
    readonly username: string | null
}
