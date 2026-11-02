import type { ApprovePublicDocumentRequest } from "../../application/approve-public-document.contracts"
import type { ApprovePublicDocumentInput } from "./dto/approve-public-document.input"
import type { PublicDocumentView } from "@modules/domain/public-documents"
import type { PublicDocumentType } from "./dto/public-document.type"
import { toPublicDocumentType } from "./public-documents.records.mapper"

/** Maps the GraphQL input to the request. */
export const toApprovePublicDocumentRequest = (
    workspaceId: string,
    input: ApprovePublicDocumentInput,
): ApprovePublicDocumentRequest => ({
    workspaceId,
    id: input.id,
    expectedDraftRevision: input.expectedDraftRevision,
    reviewedChanges: input.reviewedChanges,
})

/** Maps the answer to the GraphQL type. */
export const toApprovePublicDocumentType = (result: PublicDocumentView): PublicDocumentType =>
    toPublicDocumentType(result)
