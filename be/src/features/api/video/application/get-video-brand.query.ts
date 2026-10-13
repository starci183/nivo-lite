import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { BrandKit } from "@modules/domain/video"
import type { GetVideoBrandRequest } from "./get-video-brand.contracts"

/** The authenticated videoBrand operation. */
export class GetVideoBrandQuery extends Query<BrandKit> {
    constructor(readonly params: ExecuteParams<GetVideoBrandRequest>) {
        super()
    }
}
