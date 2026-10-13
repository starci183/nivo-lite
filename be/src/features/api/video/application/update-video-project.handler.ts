import { CommandHandler } from "@nestjs/cqrs"
import { VideoProjectEditorService } from "@modules/domain/video"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { UpdateVideoProjectCommand } from "./update-video-project.command"
import type { WorkbenchProject } from "@modules/domain/video"

@CommandHandler(UpdateVideoProjectCommand)
/** Dispatches updateVideoProject through its checked domain use case. */
export class UpdateVideoProjectHandler extends ICQRSHandler<UpdateVideoProjectCommand, WorkbenchProject> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly service: VideoProjectEditorService,
    ) {
        super(logger)
    }

    protected override process(operation: UpdateVideoProjectCommand): Promise<WorkbenchProject> {
        return this.service.update(
            operation.params.principal.id,
            operation.params.request.workspaceId,
            operation.params.request.projectId,
            operation.params.request,
        )
    }
}
