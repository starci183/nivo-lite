import { Query } from "@nestjs/cqrs"
import type { ContentMediaData } from "@modules/domain/content-media"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetContentMediaRequest } from "./get-content-media.contracts"

/** Asks for attachable media and the selected private attachment addresses. */
export class GetContentMediaQuery extends Query<ContentMediaData> {
    constructor(readonly params: ExecuteParams<GetContentMediaRequest>) {
        super()
    }
}
