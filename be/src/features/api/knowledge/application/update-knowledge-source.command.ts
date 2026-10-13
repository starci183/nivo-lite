import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { UpdateKnowledgeSourceRequest } from "./update-knowledge-source.contracts"

/** Changes the metadata of a document without reading it again. */
export class UpdateKnowledgeSourceCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<UpdateKnowledgeSourceRequest>) {
        super()
    }
}
