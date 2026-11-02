import { Command } from "@nestjs/cqrs"
import type { PublicDocumentView } from "@modules/domain/public-documents"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ApprovePublicDocumentRequest } from "./approve-public-document.contracts"

/** Approves a public document and publishes it: the approver, the time and the internal sources are recorded. */
export class ApprovePublicDocumentCommand extends Command<PublicDocumentView> {
    constructor(readonly params: ExecuteParams<ApprovePublicDocumentRequest>) {
        super()
    }
}
