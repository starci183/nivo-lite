import type { RedraftPublicDocumentRequest } from "../../application/redraft-public-document.contracts"
import type { PublicDocumentIdInput } from "./dto/public-document-id.input"
import type { PublicDocumentView } from "@modules/domain/public-documents"
import type { PublicDocumentType } from "./dto/public-document.type"
import { toPublicDocumentType } from "./public-documents.records.mapper"

/** Maps the GraphQL input to the request. */
export const toRedraftPublicDocumentRequest = (
    workspaceId: string,
    input: PublicDocumentIdInput,
): RedraftPublicDocumentRequest => ({
    workspaceId,
    id: input.id,
})

/** Maps the answer to the GraphQL type. */
export const toRedraftPublicDocumentType = (result: PublicDocumentView): PublicDocumentType =>
    toPublicDocumentType(result)
