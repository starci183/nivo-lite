import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListVideoMediaRequest, ListVideoMediaResult } from "./list-video-media.contracts"

/** The authenticated videoMedia operation. */
export class ListVideoMediaQuery extends Query<ListVideoMediaResult> {
    constructor(readonly params: ExecuteParams<ListVideoMediaRequest>) {
        super()
    }
}
