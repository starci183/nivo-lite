import type { SourceState } from "@modules/domain/knowledge-sources"

/** Where a public document stands. A published one is live for customers; archived and failed ones are not. */
export type PublicDocumentStatus = "drafting" | "draft" | "published" | "archived" | "failed"

/** How a public document began: NIVO drafted it from public-area documents, the owner wrote it, or NIVO proposed an answer to a customer question. */
export type PublicDocumentKind = "drafted" | "written" | "answer"

/** The most public-area documents one draft may be written from. */
export const MAX_DRAFT_SOURCES = 5

/** The longest title of a public document. */
export const MAX_TITLE_CHARS = 160

/** The longest text of a public document. */
export const MAX_BODY_CHARS = 40_000

/**
 * A piece left out of a draft, as the document's `left_out` column and its GraphQL type still carry it. Nothing is left out by
 * drafting any more (the AREA of a document is its audience, and drafting reads the public area only), so drafting writes an empty
 * list; the field stays for the contract and for rows written before.
 */
export interface LeftOut {
    /** A short label of the piece. */
    readonly label: string
    /** Why it was left out, as the older row recorded it. */
    readonly reason: string
}

/** An internal document a public document was drafted from, as the owner sees it. */
export interface DocumentSourceView {
    /** The internal document. */
    readonly sourceId: string
    /** Its title. */
    readonly title: string
    /** True when it changed, or went, after the owner last approved this public document. */
    readonly changed: boolean
}

/** One public document as the owner reads it. */
export interface PublicDocumentView {
    /** The document. */
    readonly id: string
    /** The title. */
    readonly title: string
    /** The text being worked on. */
    readonly body: string
    /** The exact current content revision an approval must name. */
    readonly draftRevision: number
    /** The text customers read now, or null while nothing is published. */
    readonly publishedBody: string | null
    /** Where it stands. */
    readonly status: PublicDocumentStatus
    /** How it began. */
    readonly kind: PublicDocumentKind
    /** The customer question this answers, when it is a proposal. */
    readonly question: string | null
    /** The unanswered question it proposes to answer. */
    readonly gapId: string | null
    /** The internal documents it was drafted from. */
    readonly sources: ReadonlyArray<DocumentSourceView>
    /** What NIVO left out of the draft. */
    readonly leftOut: ReadonlyArray<LeftOut>
    /** True when an internal source changed since the owner approved. */
    readonly needsReview: boolean
    /** True when the document is published and the text being worked on differs from the published text. */
    readonly hasPendingChange: boolean
    /** Who approved it, by the name the workspace shows. */
    readonly approvedByName: string | null
    /** When it was approved, ISO text. */
    readonly approvedAt: string | null
    /** The code of why drafting failed. */
    readonly failureCode: string | null
    /** When it was made, ISO text. */
    readonly createdAt: string
    /** When it last changed, ISO text. */
    readonly updatedAt: string
}

/** What an owner asks NIVO to draft. */
export interface PublicDocumentDraftRequest {
    /** The title of the public document. */
    readonly title: string
    /** The internal documents to draft it from. */
    readonly sourceIds: ReadonlyArray<string>
    /** The owner's note to NIVO, or undefined. */
    readonly instructions?: string | undefined
}

/** What an owner writes by hand. */
export interface WriteRequest {
    /** The title. */
    readonly title: string
    /** The text. */
    readonly body: string
}

/** A change to the text being worked on; a field left out stays. */
export interface UpdateRequest {
    /** The document. */
    readonly id: string
    /** A new title. */
    readonly title?: string | undefined
    /** A new text. */
    readonly body?: string | undefined
}

/** The approval of one document. */
export interface ApproveRequest {
    /** The document. */
    readonly id: string
    /** The revision of the content the approver actually reviewed. */
    readonly expectedDraftRevision: number
    /** True when the owner looked at the changed sources and approves the text as it stands. */
    readonly reviewedChanges?: boolean | undefined
}

/** One document's text as it is read: by the draft (a public-area document) or by the internal reader. */
export interface InternalText {
    /** The document. */
    readonly sourceId: string
    /** Its title. */
    readonly title: string
    /** The hash of its text at this read. */
    readonly contentHash: string
    /** Its text, clipped. */
    readonly text: string
}

/** One public-area document as the draft call shows it: its title and its text within the call's bound. */
export interface DraftSource {
    /** The document. */
    readonly sourceId: string
    /** Its title. */
    readonly title: string
    /** Its text as shown, cut at the document's share of the call's bound. */
    readonly text: string
    /** True when the text was cut: what lies beyond is not shown and is never written from. */
    readonly cut: boolean
}

/** What the model is given to draft a public text. */
export interface PublicDraftBrief {
    /** The workspace that pays for the call. */
    readonly workspaceId: string
    /** The title of the document, or the customer question it answers. */
    readonly title: string
    /** The customer question to answer, or null. */
    readonly question: string | null
    /** The owner's note, or null. */
    readonly instructions: string | null
    /** The public-area documents, each within its share of the call's bound. */
    readonly sources: ReadonlyArray<DraftSource>
}

/** The row of a public document and its sources as the service reads them. */
export interface SourceRecordRef {
    /** The internal document. */
    readonly sourceId: string
    /** Its title when it was recorded. */
    readonly title: string
    /** The hash of its text when it was recorded. */
    readonly contentHash: string
}

/** The source identity acknowledged by one immutable approval, including an explicit absence. */
export interface ReviewedSourceRef extends SourceRecordRef {
    /** The actual source state at review time; null records a source that was gone. */
    readonly current: SourceState | null
}
