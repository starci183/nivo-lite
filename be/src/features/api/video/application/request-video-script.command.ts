import type { VideoScriptRequest } from "@modules/domain/video"
import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RequestVideoScriptRequest } from "./request-video-script.contracts"

/** Queues a script operation for a manager's project. */
export class RequestVideoScriptCommand extends Command<VideoScriptRequest> {
    constructor(readonly params: ExecuteParams<RequestVideoScriptRequest>) {
        super()
    }
}
