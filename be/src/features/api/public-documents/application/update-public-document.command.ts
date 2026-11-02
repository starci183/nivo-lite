import { Command } from "@nestjs/cqrs"
import type { PublicDocumentView } from "@modules/domain/public-documents"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { UpdatePublicDocumentRequest } from "./update-public-document.contracts"

/** Changes the title or the text of a public document; a published one serves its approved text until the new one is approved. */
export class UpdatePublicDocumentCommand extends Command<PublicDocumentView> {
    constructor(readonly params: ExecuteParams<UpdatePublicDocumentRequest>) {
        super()
    }
}
