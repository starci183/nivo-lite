import { CommandHandler } from "@nestjs/cqrs"
import { VideoProjectEditorService } from "@modules/domain/video"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DuplicateVideoProjectCommand } from "./duplicate-video-project.command"
import type { WorkbenchProject } from "@modules/domain/video"

@CommandHandler(DuplicateVideoProjectCommand)
/** Dispatches duplicateVideoProject through its checked domain use case. */
export class DuplicateVideoProjectHandler extends ICQRSHandler<DuplicateVideoProjectCommand, WorkbenchProject> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly service: VideoProjectEditorService,
    ) {
        super(logger)
    }

    protected override process(operation: DuplicateVideoProjectCommand): Promise<WorkbenchProject> {
        return this.service.duplicate(
            operation.params.principal.id,
            operation.params.request.workspaceId,
            operation.params.request.projectId,
        )
    }
}
