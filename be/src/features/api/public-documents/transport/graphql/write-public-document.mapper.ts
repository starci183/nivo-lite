import type { WritePublicDocumentRequest } from "../../application/write-public-document.contracts"
import type { WritePublicDocumentInput } from "./dto/write-public-document.input"
import type { PublicDocumentView } from "@modules/domain/public-documents"
import type { PublicDocumentType } from "./dto/public-document.type"
import { toPublicDocumentType } from "./public-documents.records.mapper"

/** Maps the GraphQL input to the request. */
export const toWritePublicDocumentRequest = (
    workspaceId: string,
    input: WritePublicDocumentInput,
): WritePublicDocumentRequest => ({
    workspaceId,
    title: input.title,
    body: input.body,
})

/** Maps the answer to the GraphQL type. */
export const toWritePublicDocumentType = (result: PublicDocumentView): PublicDocumentType =>
    toPublicDocumentType(result)
