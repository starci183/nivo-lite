import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { WorkbenchProject } from "@modules/domain/video"
import type { DuplicateVideoProjectRequest } from "./duplicate-video-project.contracts"

/** The authenticated duplicateVideoProject operation. */
export class DuplicateVideoProjectCommand extends Command<WorkbenchProject> {
    constructor(readonly params: ExecuteParams<DuplicateVideoProjectRequest>) {
        super()
    }
}
