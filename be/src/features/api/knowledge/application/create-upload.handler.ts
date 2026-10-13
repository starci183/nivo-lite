import { CommandHandler } from "@nestjs/cqrs"
import { KnowledgeSourcesService } from "@modules/domain/knowledge-sources"
import type { UploadAddress } from "@modules/domain/knowledge-sources"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CreateUploadCommand } from "./create-upload.command"

@CommandHandler(CreateUploadCommand)
/** Makes the upload address through the sources service. */
export class CreateUploadHandler extends ICQRSHandler<CreateUploadCommand, UploadAddress> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly sources: KnowledgeSourcesService,
    ) {
        super(logger)
    }

    protected override process(command: CreateUploadCommand): Promise<UploadAddress> {
        return this.sources.createUpload(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.filename,
        )
    }
}
