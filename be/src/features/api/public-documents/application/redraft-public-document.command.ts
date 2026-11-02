import { Command } from "@nestjs/cqrs"
import type { PublicDocumentView } from "@modules/domain/public-documents"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RedraftPublicDocumentRequest } from "./redraft-public-document.contracts"

/** Asks NIVO to draft a public document again from the internal documents it was drafted from. */
export class RedraftPublicDocumentCommand extends Command<PublicDocumentView> {
    constructor(readonly params: ExecuteParams<RedraftPublicDocumentRequest>) {
        super()
    }
}
