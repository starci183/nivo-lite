import type { PublicDocumentsRequest } from "../../application/public-documents.contracts"
import type { PublicDocumentView } from "@modules/domain/public-documents"
import type { PublicDocumentType } from "./dto/public-document.type"
import { toPublicDocumentType } from "./public-documents.records.mapper"

/** Maps the GraphQL arguments of publicDocuments to the request. */
export const toPublicDocumentsRequest = (workspaceId: string): PublicDocumentsRequest => ({ workspaceId })

/** Maps the answer to the GraphQL type. */
export const toPublicDocumentsType = (result: ReadonlyArray<PublicDocumentView>): Array<PublicDocumentType> =>
    result.map((document) => toPublicDocumentType(document))
