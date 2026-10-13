import { CommandHandler } from "@nestjs/cqrs"
import { KnowledgeSourcesService } from "@modules/domain/knowledge-sources"
import type { UploadAddress } from "@modules/domain/knowledge-sources"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CreateKnowledgeUploadCommand } from "./create-knowledge-upload.command"

@CommandHandler(CreateKnowledgeUploadCommand)
/** Issues an address a browser uploads one document to. */
export class CreateKnowledgeUploadHandler extends ICQRSHandler<CreateKnowledgeUploadCommand, UploadAddress> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly sources: KnowledgeSourcesService,
    ) {
        super(logger)
    }

    protected override process(command: CreateKnowledgeUploadCommand): Promise<UploadAddress> {
        return this.sources.createUpload(command.params.principal.id, command.params.request.workspaceId, command.params.request.filename)
    }
}
