import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ArchivePublicDocumentRequest } from "./archive-public-document.contracts"

/** Takes a public document away from customers. */
export class ArchivePublicDocumentCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<ArchivePublicDocumentRequest>) {
        super()
    }
}
