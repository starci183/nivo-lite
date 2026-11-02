import { Query } from "@nestjs/cqrs"
import type { PublicDocumentView } from "@modules/domain/public-documents"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { PublicDocumentsRequest } from "./public-documents.contracts"

/** Lists the public documents of the workspace that are not archived, with their sources and what was left out. */
export class PublicDocumentsQuery extends Query<ReadonlyArray<PublicDocumentView>> {
    constructor(readonly params: ExecuteParams<PublicDocumentsRequest>) {
        super()
    }
}
