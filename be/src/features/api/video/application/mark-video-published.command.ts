import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { WorkbenchProject } from "@modules/domain/video"
import type { MarkVideoPublishedRequest } from "./mark-video-published.contracts"

/** The authenticated markVideoPublished operation. */
export class MarkVideoPublishedCommand extends Command<WorkbenchProject> {
    constructor(readonly params: ExecuteParams<MarkVideoPublishedRequest>) {
        super()
    }
}
