/** What a delivery of the event bus gives the inbox: the consumer's queue and the business key, claimed once per effect. */
export interface InboxClaim {
    /** The reactor's queue, the first half of the inbox key. */
    readonly consumer: string
    /** The business key of the fact, the second half. */
    readonly dedupeKey: string
}

import type { BrainSubjectType, FactRelation, Scope } from "@modules/domain/brain-facts"

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
export type FactsOutcome = "done" | "skipped" | "blocked" | "failed" | "continued" | "waiting"

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

/** Which part of the truth graph one read answers: one page of subjects, optionally one subject or the truths that match words. */
export interface BrainGraphFilter {
    /** Only this subject (its key). */
    readonly subjectKey?: string | undefined
    /** Only truths whose subject, attribute or value hold every one of these words. */
    readonly query?: string | undefined
    /** The subject key the previous page ended at. */
    readonly cursor?: string | undefined
    /** How many subjects one page holds, 1 to 100; 30 when absent. */
    readonly limit?: number | undefined
}

/** Where a truth or a change request comes from, as the graph shows it. */
export interface BrainGraphOrigin {
    /** A document's passage, a chat message, a person on the page, or anything else. */
    readonly kind: "document" | "chat" | "manual" | "other"
    /** The document title, or the label of the evidence. */
    readonly label: string
    /** The words it rests on, verbatim, or null. */
    readonly quote: string | null
    /** The document, for a document origin. */
    readonly sourceId: string | null
    /** The passage of the document it was read from, or null (read before chunk hashes). */
    readonly chunkHash: string | null
    /** The team-chat message, for a chat origin. */
    readonly messageId: string | null
}

/** One node of the truth graph: one short truth with its source, version and validity. */
export interface BrainGraphNode {
    /** The fact id. */
    readonly id: string
    /** The subject key (nodes of one subject group together). */
    readonly subjectKey: string
    /** The subject as people write it. */
    readonly subjectLabel: string
    /** What the subject is. */
    readonly subjectType: BrainSubjectType
    /** The attribute as people write it. */
    readonly attributeLabel: string
    /** The value. */
    readonly value: string
    /** The unit, or null. */
    readonly unit: string | null
    /** `active` or `scheduled`. */
    readonly status: string
    /** Which value of its key this is, or null (never versioned). */
    readonly version: number | null
    /** From when it holds. */
    readonly validFrom: string | null
    /** Until when it holds (one year after it started unless stated). */
    readonly validTo: string | null
    /** Who may read it: public, internal or restricted. */
    readonly scope: Scope
    /** The modules that read a restricted truth. */
    readonly modules: ReadonlyArray<string>
    /** The agent instance it is kept for, or null for every instance. */
    readonly installationId: string | null
    /** Where it comes from. */
    readonly origin: BrainGraphOrigin
    /** The value it replaced, or null. */
    readonly previous: BrainGraphPrevious | null
    /** When it was put in force. */
    readonly changedAt: string | null
    /** Put in force in the last seven days. */
    readonly recentlyChanged: boolean
    /** How many change requests wait for its key. */
    readonly pendingCount: number
    /** True for a truth of another subject shown because an edge of the page reaches it. */
    readonly neighbor: boolean
}

/** One waiting change request (a proposal), as the aside lists it. */
export interface BrainGraphPending {
    /** The proposal id: the id `decideBrainFact` takes. */
    readonly id: string
    /** The subject key. */
    readonly subjectKey: string
    /** The subject. */
    readonly subjectLabel: string
    /** The attribute. */
    readonly attributeLabel: string
    /** The proposed value (for `retire`: the value it would stop). */
    readonly value: string
    /** The unit, or null. */
    readonly unit: string | null
    /** `set` a value or `retire` the one in force. */
    readonly proposalKind: string
    /** The truth in force it would replace, or null. */
    readonly currentFactId: string | null
    /** Its value, or null. */
    readonly currentValue: string | null
    /** Its version, or null. */
    readonly currentVersion: number | null
    /** Who proposed it (an agent's module, a document title, a person). */
    readonly proposedBy: string
    /** When. */
    readonly proposedAt: string
    /** The source kind it files under. */
    readonly sourceKind: string
    /** Where it comes from. */
    readonly origin: BrainGraphOrigin
    /** From when it would hold, when stated. */
    readonly validFrom: string | null
    /** Until when it would hold, when stated (else one year from approval). */
    readonly validTo: string | null
    /** The review flags of the proposal (`stale`: its stated end is past; `same_meaning`: it may say what `conflictWith` says). */
    readonly flags: ReadonlyArray<string>
    /** The fact it clashes with: the other value WAITING for the key (none in force), or, flagged `same_meaning`, a fact of another key. */
    readonly conflictWith: string | null
}

/** One document the graph was built from. */
export interface BrainGraphSource {
    /** The knowledge source. */
    readonly sourceId: string
    /** Its title. */
    readonly title: string
    /** How many truths in force (or scheduled) it supports. */
    readonly nodeCount: number
    /** When the newest of them was put in force. */
    readonly lastChangedAt: string | null
    /** How far its reading got, or null when it was never read. */
    readonly reading: BrainGraphReading | null
}

/** How far the reading of one source document got. */
export interface BrainGraphReading {
    /** Where the reading stands. */
    readonly status: string
    /** Windows read. */
    readonly windowsDone: number
    /** Windows of this reading (only the changed passages on a re-read). */
    readonly windowsTotal: number
    /** Facts filed by the reading. */
    readonly factsProposed: number
}

/** One page of the truth graph. */
export interface BrainGraph {
    /** The truths of the page's subjects, then their neighbours. */
    readonly nodes: ReadonlyArray<BrainGraphNode>
    /** The edges among the nodes. */
    readonly edges: ReadonlyArray<FactRelation>
    /** Every change request waiting for the founder. */
    readonly pending: ReadonlyArray<BrainGraphPending>
    /** The source documents. */
    readonly sources: ReadonlyArray<BrainGraphSource>
    /** Totals of the whole graph ("19 nut - 23 quan he - 1 nut vua doi"). */
    readonly totals: BrainGraphTotals
    /** The cursor of the next page of subjects, or null. */
    readonly nextCursor: string | null
}

/** The value a truth replaced. */
export interface BrainGraphPrevious {
    /** The replaced fact. */
    readonly id: string
    /** Its value. */
    readonly value: string
    /** Its version. */
    readonly version: number | null
}

/** Totals of the whole graph. */
export interface BrainGraphTotals {
    /** Truths in force or scheduled. */
    readonly nodes: number
    /** Edges among them. */
    readonly relations: number
    /** Truths put in force in the last seven days. */
    readonly recentlyChanged: number
    /** Change requests waiting. */
    readonly pending: number
    /** Truths in force or scheduled the capped read did NOT bring (0 when the graph is whole): the page says it is capped. */
    readonly nodesNotShown: number
    /** Waiting change requests the capped read did NOT bring (0 when all are listed). */
    readonly pendingNotShown: number
}
