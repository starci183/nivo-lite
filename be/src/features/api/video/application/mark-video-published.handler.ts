import { CommandHandler } from "@nestjs/cqrs"
import { VideoProjectEditorService } from "@modules/domain/video"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { MarkVideoPublishedCommand } from "./mark-video-published.command"
import type { WorkbenchProject } from "@modules/domain/video"

@CommandHandler(MarkVideoPublishedCommand)
/** Dispatches markVideoPublished through its checked domain use case. */
export class MarkVideoPublishedHandler extends ICQRSHandler<MarkVideoPublishedCommand, WorkbenchProject> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly service: VideoProjectEditorService,
    ) {
        super(logger)
    }

    protected override process(operation: MarkVideoPublishedCommand): Promise<WorkbenchProject> {
        return this.service.publish(
            operation.params.principal.id,
            operation.params.request.workspaceId,
            operation.params.request.projectId,
        )
    }
}
