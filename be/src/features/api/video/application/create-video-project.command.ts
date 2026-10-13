import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { WorkbenchProject } from "@modules/domain/video"
import type { CreateVideoProjectRequest } from "./create-video-project.contracts"

/** The authenticated createVideoProject operation. */
export class CreateVideoProjectCommand extends Command<WorkbenchProject> {
    constructor(readonly params: ExecuteParams<CreateVideoProjectRequest>) {
        super()
    }
}
