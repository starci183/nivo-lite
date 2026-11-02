import { Command } from "@nestjs/cqrs"
import type { PublicDocumentView } from "@modules/domain/public-documents"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { DraftPublicDocumentRequest } from "./draft-public-document.contracts"

/** Asks NIVO to draft a public document from internal documents; the draft is written in the background and waits for approval. */
export class DraftPublicDocumentCommand extends Command<PublicDocumentView> {
    constructor(readonly params: ExecuteParams<DraftPublicDocumentRequest>) {
        super()
    }
}
