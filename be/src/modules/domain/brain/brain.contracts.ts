/** What a reading of a document must do. */
export interface ReadingPlan {
    /** True when some passages are unchanged, so only the others are read. */
    readonly partial: boolean
    /** The hashes of every passage of the document. */
    readonly hashes: ReadonlyArray<string>
    /** The unchanged passages, as one text. */
    readonly unchangedText: string
    /** What the model reads. */
    readonly windows: ReadonlyArray<string>
}

/** What a delivery of the event bus gives the inbox: the consumer's queue and the business key, claimed once per effect. */
export interface InboxClaim {
    /** The reactor's queue, the first half of the inbox key. */
    readonly consumer: string
    /** The business key of the fact, the second half. */
    readonly dedupeKey: string
}

import type { BrainSubjectType, Scope } from "@modules/domain/brain-facts"

/** One correction the owner made of an agent's work, as the decisions record keeps it. */
export interface Correction {
    /** The decision it comes from. */
    readonly decisionId: string
    /** What the agent proposed to do. */
    readonly action: string
    /** edited or rejected. */
    readonly outcome: "edited" | "rejected"
    /** The owner's note. */
    readonly note: string | null
    /** When it happened, ISO 8601. */
    readonly at: string
    /** The agent's proposal. */
    readonly before: CorrectionBody | null
    /** The owner's version. */
    readonly after: CorrectionBody | null
}

/** The parts of a proposal a correction compares. */
export interface CorrectionBody {
    /** A one-line summary. */
    readonly summary?: string
    /** The drafted text. */
    readonly draft?: string
    /** The fields of the proposal. */
    readonly fields?: Readonly<Record<string, unknown>>
}

/** Where the corrections of the owner come from; the decisions capability provides it. */
export interface CorrectionSource {
    /** The corrections of one agent's work since this instant, newest first, at most `limit`. */
    recent(workspaceId: string, module: string, since: Date, limit: number): Promise<ReadonlyArray<Correction>>
}

/** What studying an agent's corrections did. */
export interface MineResult {
    /** How many corrections there were. */
    readonly corrections: number
    /** How many were kept as new regression cases. */
    readonly newCases: number
    /** How many lessons were proposed. */
    readonly proposed: number
    /** Why nothing was proposed, when so. */
    readonly reason?: "not_enough" | "model_unavailable"
}

/** A fact an owner or manager writes on the Second Brain page. */
export interface FactForm {
    /** What it is about. */
    readonly subjectType: BrainSubjectType
    /** The subject. */
    readonly subjectLabel: string
    /** The attribute. */
    readonly attributeLabel: string
    /** The value. */
    readonly value: string
    /** public, internal or restricted. */
    readonly scope: Scope
    /** The modules that may read a restricted fact. */
    readonly modules: ReadonlyArray<string>
    /** From when it holds. */
    readonly validFrom?: string | undefined
    /** Until when it holds. */
    readonly validTo?: string | undefined
    /** A note kept as evidence. */
    readonly note?: string | undefined
    /** The gap this fact answers. */
    readonly gapId?: string | undefined
}

/** What an owner or manager decides about a fact. */
export interface FactDecision {
    /** The workspace. */
    readonly workspaceId: string
    /** The fact. */
    readonly id: string
    /** apply or reject a proposal, choose it among competing values, split it into its own fact, or retire an active fact. */
    readonly action: "apply" | "reject" | "choose" | "split" | "retire"
    /** The reason given with the decision. */
    readonly note?: string | undefined
    /** The situation a split value is for. */
    readonly situation?: string | undefined
}

/** Keeping the value in force against every waiting value of its key. */
export interface KeepCurrentInput {
    /** The workspace. */
    readonly workspaceId: string
    /** The normalised subject. */
    readonly subjectKey: string
    /** The normalised attribute. */
    readonly attribute: string
    /** The agent instance the key is scoped to; omitted = every instance. */
    readonly installationId?: string | undefined
}

/** A lesson an owner or manager writes by hand. */
export interface LessonForm {
    /** The workspace. */
    readonly workspaceId: string
    /** The agent it is for; omitted = every agent. */
    readonly module?: string | undefined
    /** The title. */
    readonly title: string
    /** What to do. */
    readonly body: string
    /** When it applies. */
    readonly appliesWhen?: string | undefined
}

/** What an owner or manager decides about a lesson. */
export interface LessonDecision {
    /** The workspace. */
    readonly workspaceId: string
    /** The lesson. */
    readonly id: string
    /** active or rejected for a proposal; retired for a lesson in force. */
    readonly action: "active" | "rejected" | "retired"
}

/** What reading the facts of one document did. */
export type FactsOutcome = "done" | "skipped" | "blocked" | "failed"

/** What running one command did. */
export type CommandOutcome = "done" | "skipped" | "failed"

/** A source whose passages were stored, as `knowledge_source_indexed` carries it. */
export interface IndexedSource {
    /** The knowledge source. */
    readonly sourceId: string
    /** The workspace. */
    readonly workspaceId: string
    /** When it was indexed (epoch milliseconds): the key of this one reading. */
    readonly indexedAt: number
}

/** What applying the checked facts of one document together did. */
export interface BulkApplied {
    /** The batch the applied facts belong to; the id that takes them back. */
    readonly batchId: string
    /** How many facts were applied. */
    readonly applied: number
    /** How many of the document's waiting facts were left for a person to review. */
    readonly skipped: number
}

/** What taking a batch back did. */
export interface BulkUndone {
    /** How many facts are waiting for review again. */
    readonly restored: number
    /** How many stay as they are because they were changed since (retired, replaced or decided again). */
    readonly kept: number
}
