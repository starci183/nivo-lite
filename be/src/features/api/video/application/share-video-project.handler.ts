import { CommandHandler } from "@nestjs/cqrs"
import { VideoSharingService } from "@modules/domain/video"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ShareVideoProjectCommand } from "./share-video-project.command"
import type { VideoShareResult } from "@modules/domain/video"

@CommandHandler(ShareVideoProjectCommand)
/** Executes shareVideoProject through the manager checked capability. */
export class ShareVideoProjectHandler extends ICQRSHandler<ShareVideoProjectCommand, VideoShareResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly service: VideoSharingService,
    ) {
        super(logger)
    }

    protected override process(command: ShareVideoProjectCommand): Promise<VideoShareResult> {
        return this.service.share(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.projectId,
        )
    }
}
