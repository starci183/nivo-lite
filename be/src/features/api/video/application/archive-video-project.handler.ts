import { CommandHandler } from "@nestjs/cqrs"
import { VideoProjectEditorService, type WorkbenchProject } from "@modules/domain/video"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { ArchiveVideoProjectCommand } from "./archive-video-project.command"

@CommandHandler(ArchiveVideoProjectCommand)
/** Dispatches archiveVideoProject through its checked domain use case. */
export class ArchiveVideoProjectHandler extends ICQRSHandler<ArchiveVideoProjectCommand, WorkbenchProject> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly service: VideoProjectEditorService,
    ) {
        super(logger)
    }

    protected override process(operation: ArchiveVideoProjectCommand): Promise<WorkbenchProject> {
        return this.service.archive(
            operation.params.principal.id,
            operation.params.request.workspaceId,
            operation.params.request.projectId,
            operation.params.request.archived,
        )
    }
}
