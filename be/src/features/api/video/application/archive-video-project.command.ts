import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { WorkbenchProject } from "@modules/domain/video"
import type { ArchiveVideoProjectRequest } from "./archive-video-project.contracts"

/** The authenticated archiveVideoProject operation. */
export class ArchiveVideoProjectCommand extends Command<WorkbenchProject> {
    constructor(readonly params: ExecuteParams<ArchiveVideoProjectRequest>) {
        super()
    }
}
