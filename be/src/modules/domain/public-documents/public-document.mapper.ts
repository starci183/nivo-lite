import type { PublicDocumentView } from "./public-documents.contracts"
import type { PublicDocumentEntity, PublicDocumentSourceEntity } from "./persistence/entities"

/** The statuses in which the sources of a document matter: it is a text the owner may approve, or one customers read. */
const REVIEWABLE: ReadonlySet<PublicDocumentEntity["status"]> = new Set<PublicDocumentEntity["status"]>([
    "draft",
    "published",
])

/**
 * A public document as the owner reads it. `changed` holds the ids of its internal sources that changed or went since they were
 * recorded; a text the owner may approve or customers read is `needsReview` while any source of it changed.
 */
export const toPublicDocumentView = (
    row: PublicDocumentEntity,
    sources: ReadonlyArray<PublicDocumentSourceEntity>,
    changed: ReadonlySet<string>,
): PublicDocumentView => ({
    id: row.id,
    title: row.title,
    body: row.body,
    draftRevision: row.draftRevision,
    publishedBody: row.publishedBody,
    status: row.status,
    kind: row.kind,
    question: row.question,
    gapId: row.gapId,
    sources: sources.map((source) => ({
        sourceId: source.sourceId,
        title: source.sourceTitle,
        changed: changed.has(source.sourceId),
    })),
    leftOut: row.leftOut,
    needsReview: REVIEWABLE.has(row.status) && sources.some((source) => changed.has(source.sourceId)),
    hasPendingChange: row.status === "published" && row.publishedBody !== row.body,
    approvedByName: row.approvedByName,
    approvedAt: row.approvedAt === null ? null : row.approvedAt.toISOString(),
    failureCode: row.failureCode,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
})
