import { CommandHandler } from "@nestjs/cqrs"
import { VideoProjectEditorService, type WorkbenchProject } from "@modules/domain/video"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { CreateVideoProjectCommand } from "./create-video-project.command"

@CommandHandler(CreateVideoProjectCommand)
/** Dispatches createVideoProject through its checked domain use case. */
export class CreateVideoProjectHandler extends ICQRSHandler<CreateVideoProjectCommand, WorkbenchProject> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly service: VideoProjectEditorService,
    ) {
        super(logger)
    }

    protected override process(operation: CreateVideoProjectCommand): Promise<WorkbenchProject> {
        return this.service.create(
            operation.params.principal.id,
            operation.params.request.workspaceId,
            operation.params.request,
        )
    }
}
