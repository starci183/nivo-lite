import { CommandHandler } from "@nestjs/cqrs"
import type { ChatFileUpload } from "@modules/domain/chat-files"
import { OfficeTagService } from "@modules/domain/office-command-candidates"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RequestOfficeFileUploadCommand } from "./request-office-file-upload.command"

@CommandHandler(RequestOfficeFileUploadCommand)
/** Issues the upload address of a file of an Office line through the Office tag service. */
export class RequestOfficeFileUploadHandler extends ICQRSHandler<RequestOfficeFileUploadCommand, ChatFileUpload> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly tags: OfficeTagService,
    ) {
        super(logger)
    }

    protected override process(command: RequestOfficeFileUploadCommand): Promise<ChatFileUpload> {
        return this.tags.requestFileUpload(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
