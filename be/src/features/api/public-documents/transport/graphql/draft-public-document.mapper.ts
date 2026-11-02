import type { DraftPublicDocumentRequest } from "../../application/draft-public-document.contracts"
import type { DraftPublicDocumentInput } from "./dto/draft-public-document.input"
import type { PublicDocumentView } from "@modules/domain/public-documents"
import type { PublicDocumentType } from "./dto/public-document.type"
import { toPublicDocumentType } from "./public-documents.records.mapper"

/** Maps the GraphQL input to the request. */
export const toDraftPublicDocumentRequest = (
    workspaceId: string,
    input: DraftPublicDocumentInput,
): DraftPublicDocumentRequest => ({
    workspaceId,
    title: input.title,
    sourceIds: input.sourceIds,
    instructions: input.instructions,
})

/** Maps the answer to the GraphQL type. */
export const toDraftPublicDocumentType = (result: PublicDocumentView): PublicDocumentType =>
    toPublicDocumentType(result)
