import type { UpdatePublicDocumentRequest } from "../../application/update-public-document.contracts"
import type { UpdatePublicDocumentInput } from "./dto/update-public-document.input"
import type { PublicDocumentView } from "@modules/domain/public-documents"
import type { PublicDocumentType } from "./dto/public-document.type"
import { toPublicDocumentType } from "./public-documents.records.mapper"

/** Maps the GraphQL input to the request. */
export const toUpdatePublicDocumentRequest = (
    workspaceId: string,
    input: UpdatePublicDocumentInput,
): UpdatePublicDocumentRequest => ({
    workspaceId,
    id: input.id,
    title: input.title,
    body: input.body,
})

/** Maps the answer to the GraphQL type. */
export const toUpdatePublicDocumentType = (result: PublicDocumentView): PublicDocumentType =>
    toPublicDocumentType(result)
