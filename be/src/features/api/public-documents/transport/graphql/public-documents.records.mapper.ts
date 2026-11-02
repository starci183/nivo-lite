import type { PublicDocumentView } from "@modules/domain/public-documents"
import type { PublicDocumentType } from "./dto/public-document.type"

/** Maps a public document of the domain to its GraphQL type. */
export const toPublicDocumentType = (document: PublicDocumentView): PublicDocumentType => ({
    id: document.id,
    title: document.title,
    body: document.body,
    draftRevision: document.draftRevision,
    publishedBody: document.publishedBody,
    status: document.status,
    kind: document.kind,
    question: document.question,
    gapId: document.gapId,
    sources: document.sources.map((source) => ({ ...source })),
    leftOut: document.leftOut.map((piece) => ({ ...piece })),
    needsReview: document.needsReview,
    hasPendingChange: document.hasPendingChange,
    approvedByName: document.approvedByName,
    approvedAt: document.approvedAt,
    failureCode: document.failureCode,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
})
