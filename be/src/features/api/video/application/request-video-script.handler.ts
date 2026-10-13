import { CommandHandler } from "@nestjs/cqrs"
import { VideoScriptingService } from "@modules/domain/video"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RequestVideoScriptCommand } from "./request-video-script.command"
import type { VideoScriptRequest } from "@modules/domain/video"

@CommandHandler(RequestVideoScriptCommand)
/** Starts the script job through the workspace-checked domain use case. */
export class RequestVideoScriptHandler extends ICQRSHandler<RequestVideoScriptCommand, VideoScriptRequest> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly scripting: VideoScriptingService,
    ) {
        super(logger)
    }

    protected override process(command: RequestVideoScriptCommand): Promise<VideoScriptRequest> {
        return this.scripting.request(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.projectId,
        )
    }
}
