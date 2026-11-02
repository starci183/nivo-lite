import { Command } from "@nestjs/cqrs"
import type { PublicDocumentView } from "@modules/domain/public-documents"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { WritePublicDocumentRequest } from "./write-public-document.contracts"

/** Writes a public document by hand; it waits for approval. */
export class WritePublicDocumentCommand extends Command<PublicDocumentView> {
    constructor(readonly params: ExecuteParams<WritePublicDocumentRequest>) {
        super()
    }
}
