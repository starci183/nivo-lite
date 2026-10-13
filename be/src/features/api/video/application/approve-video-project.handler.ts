import { CommandHandler } from "@nestjs/cqrs"
import { VideoApprovalService } from "@modules/domain/video"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ApproveVideoProjectCommand } from "./approve-video-project.command"
import type { WorkbenchProject } from "@modules/domain/video"

@CommandHandler(ApproveVideoProjectCommand)
/** Executes approveVideoProject through the manager checked capability. */
export class ApproveVideoProjectHandler extends ICQRSHandler<ApproveVideoProjectCommand, WorkbenchProject> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly service: VideoApprovalService,
    ) {
        super(logger)
    }

    protected override process(command: ApproveVideoProjectCommand): Promise<WorkbenchProject> {
        return this.service.approve(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.projectId,
        )
    }
}
