import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { WorkbenchProject } from "@modules/domain/video"
import type { UpdateVideoProjectRequest } from "./update-video-project.contracts"

/** The authenticated updateVideoProject operation. */
export class UpdateVideoProjectCommand extends Command<WorkbenchProject> {
    constructor(readonly params: ExecuteParams<UpdateVideoProjectRequest>) {
        super()
    }
}
