import { CommandHandler } from "@nestjs/cqrs"
import { WorkspaceSettingsAccessService, type WorkspaceLogoUpload } from "@modules/domain/workspace-settings"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { RequestWorkspaceLogoUploadCommand } from "./request-workspace-logo-upload.command"

@CommandHandler(RequestWorkspaceLogoUploadCommand)
/** Issues the upload address of the workspace logo to an owner or a manager through the workspace settings door. */
export class RequestWorkspaceLogoUploadHandler extends ICQRSHandler<
    RequestWorkspaceLogoUploadCommand,
    WorkspaceLogoUpload
> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly settings: WorkspaceSettingsAccessService,
    ) {
        super(logger)
    }

    protected override process(command: RequestWorkspaceLogoUploadCommand): Promise<WorkspaceLogoUpload> {
        return this.settings.requestLogoUpload(command.params.principal.id, command.params.request.workspaceId, {
            contentType: command.params.request.contentType,
            sizeBytes: command.params.request.sizeBytes,
        })
    }
}
