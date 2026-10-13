import { Command } from "@nestjs/cqrs"
import type { UploadAddress } from "@modules/domain/knowledge-sources"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { CreateKnowledgeUploadRequest } from "./create-knowledge-upload.contracts"

/** Issues an address a browser uploads one document to. */
export class CreateKnowledgeUploadCommand extends Command<UploadAddress> {
    constructor(readonly params: ExecuteParams<CreateKnowledgeUploadRequest>) {
        super()
    }
}
