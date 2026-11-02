import type { ArchivePublicDocumentRequest } from "../../application/archive-public-document.contracts"
import type { PublicDocumentIdInput } from "./dto/public-document-id.input"

/** Maps the GraphQL input to the request. */
export const toArchivePublicDocumentRequest = (
    workspaceId: string,
    input: PublicDocumentIdInput,
): ArchivePublicDocumentRequest => ({
    workspaceId,
    id: input.id,
})
