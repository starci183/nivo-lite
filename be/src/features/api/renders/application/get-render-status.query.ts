import { Query } from "@nestjs/cqrs"
import type { RenderStatus } from "@modules/domain/video-renders"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetRenderStatusRequest } from "./get-render-status.contracts"

/** Asks for progress and output of a render in the caller's workspace. */
export class GetRenderStatusQuery extends Query<RenderStatus> {
    constructor(readonly params: ExecuteParams<GetRenderStatusRequest>) {
        super()
    }
}
