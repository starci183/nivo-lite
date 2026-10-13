import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { VideoScriptStatus } from "@modules/domain/video"
import type { GetVideoScriptStatusRequest } from "./get-video-script-status.contracts"

/** Reads one queued script's progress. */
export class GetVideoScriptStatusQuery extends Query<VideoScriptStatus> {
    constructor(readonly params: ExecuteParams<GetVideoScriptStatusRequest>) {
        super()
    }
}
