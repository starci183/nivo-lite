import type { PublicDocumentType } from "@/modules/api"

/** Where a document written for customers stands. */
export type PublicDocStatus = "drafting" | "draft" | "published" | "archived" | "failed"

/** How a document came to be: NIVO drafted it from internal documents, the owner wrote it, or NIVO proposed it as the answer to a customer question. */
export type PublicDocKind = "drafted" | "written" | "answer"

/** The statuses and kinds the back end may name, so a word it adds later is read as the safe one. */
const STATUSES: ReadonlyArray<PublicDocStatus> = ["drafting", "draft", "published", "archived", "failed"]
const KINDS: ReadonlyArray<PublicDocKind> = ["drafted", "written", "answer"]

/** One internal document a public document was drafted from, and whether it changed since the owner approved. */
export interface PublicDocSource {
    readonly sourceId: string
    readonly title: string
    readonly changed: boolean
}

/** One part NIVO left out of a draft on purpose, and why. */
export interface PublicLeftOut {
    readonly label: string
    readonly reason: string
}

/** A document customers may read (or will, once the owner approves), as the blocks know it. */
export interface PublicDocument {
    readonly id: string
    readonly title: string
    readonly body: string
    readonly draftRevision: number
    readonly publishedBody: string | null
    readonly status: PublicDocStatus
    readonly kind: PublicDocKind
    readonly question: string | null
    readonly gapId: string | null
    readonly sources: ReadonlyArray<PublicDocSource>
    readonly leftOut: ReadonlyArray<PublicLeftOut>
    readonly needsReview: boolean
    readonly hasPendingChange: boolean
    readonly approvedByName: string | null
    readonly approvedAt: string | null
    readonly failureCode: string | null
    readonly updatedAt: string
}

/** The public document a wire row stands for. */
export const toPublicDocument = (row: PublicDocumentType): PublicDocument => ({
    id: row.id,
    title: row.title,
    body: row.body,
    draftRevision: row.draftRevision,
    publishedBody: row.publishedBody ?? null,
    status: STATUSES.find((known) => known === row.status) ?? "draft",
    kind: KINDS.find((known) => known === row.kind) ?? "written",
    question: row.question ?? null,
    gapId: row.gapId ?? null,
    sources: row.sources.map((source) => ({ sourceId: source.sourceId, title: source.title, changed: source.changed })),
    leftOut: row.leftOut.map((one) => ({ label: one.label, reason: one.reason })),
    needsReview: row.needsReview,
    hasPendingChange: row.hasPendingChange,
    approvedByName: row.approvedByName ?? null,
    approvedAt: row.approvedAt ?? null,
    failureCode: row.failureCode ?? null,
    updatedAt: row.updatedAt,
})

/** The badge a row of the list wears, by the words the page has for it. */
export type PublicBadge = "drafting" | "failed" | "review" | "published" | "pending"

/** A proposal: the answer NIVO found in the internal documents to a customer question, waiting for the owner in the queue of what needs doing. */
const isProposal = (doc: PublicDocument): boolean =>
    doc.kind === "answer" && doc.status === "draft" && doc.gapId !== null

/** The proposals waiting for the owner. */
export const proposalsOf = (docs: ReadonlyArray<PublicDocument>): ReadonlyArray<PublicDocument> =>
    docs.filter((doc) => isProposal(doc))

/** The documents the Public documents tab lists: everything not archived and not still a proposal in the queue. */
export const listedPublicDocs = (docs: ReadonlyArray<PublicDocument>): ReadonlyArray<PublicDocument> =>
    docs.filter((doc) => doc.status !== "archived" && !isProposal(doc))

/** Which badge a document wears: being drafted, failed, an internal source changed, live as approved, or waiting for the owner. */
export const publicBadgeOf = (doc: PublicDocument): PublicBadge => {
    if (doc.status === "drafting") return "drafting"
    if (doc.status === "failed") return "failed"
    if (doc.needsReview) return "review"
    return doc.status === "published" && !doc.hasPendingChange ? "published" : "pending"
}

/** The labels of what NIVO left out, each once, in the order given. */
export const leftOutLabelsOf = (doc: PublicDocument): ReadonlyArray<string> => [
    ...new Set(doc.leftOut.map((one) => one.label)),
]

/** The titles of the internal documents a public document was drafted from. */
export const sourceTitlesOf = (doc: PublicDocument): ReadonlyArray<string> => doc.sources.map((one) => one.title)

/** How many characters of a proposed answer the queue shows before it clips. */
export const PROPOSAL_PREVIEW_CHARS = 280

/** The start of a text, cut at a space when it is longer than the limit and closed with an ellipsis. */
export const clippedText = (text: string, limit: number): string => {
    if (text.length <= limit) return text
    const cut = text.slice(0, limit)
    const space = cut.lastIndexOf(" ")
    return `${(space > limit / 2 ? cut.slice(0, space) : cut).trimEnd()}…`
}

/**
 * The catalog key of the words for the failure code of a draft. A code this app does not know, or none, reads as the generic failure.
 */
export const failureKeyOf = (code: string | null): string => {
    switch (code) {
        case "PUBLIC_DOCUMENTS_NO_INTERNAL_RIGHT":
            return "pubFailNoRight"
        case "PUBLIC_DOCUMENTS_DRAFT_UNAVAILABLE":
            return "pubFailUnavailable"
        case "PUBLIC_DOCUMENTS_NOTHING_LEFT":
            return "pubFailNothingLeft"
        case null:
        default:
            return "pubFailGeneric"
    }
}
