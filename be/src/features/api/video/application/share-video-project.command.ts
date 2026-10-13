import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { VideoShareResult } from "@modules/domain/video"
import type { ShareVideoProjectRequest } from "./share-video-project.contracts"

/** Authenticated shareVideoProject request. */
export class ShareVideoProjectCommand extends Command<VideoShareResult> {
    constructor(readonly params: ExecuteParams<ShareVideoProjectRequest>) {
        super()
    }
}
