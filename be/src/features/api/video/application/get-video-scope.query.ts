import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { VideoWorkbenchScope } from "@modules/domain/video"
import type { GetVideoScopeRequest } from "./get-video-scope.contracts"

/** The authenticated videoScope operation. */
export class GetVideoScopeQuery extends Query<VideoWorkbenchScope> {
    constructor(readonly params: ExecuteParams<GetVideoScopeRequest>) {
        super()
    }
}
