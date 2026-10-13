import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { WorkbenchProject } from "@modules/domain/video"
import type { ApproveVideoProjectRequest } from "./approve-video-project.contracts"

/** Authenticated approveVideoProject request. */
export class ApproveVideoProjectCommand extends Command<WorkbenchProject> {
    constructor(readonly params: ExecuteParams<ApproveVideoProjectRequest>) {
        super()
    }
}
