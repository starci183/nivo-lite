import { Query } from "@nestjs/cqrs"
import type { StoredCollage } from "@modules/domain/channels"
import type { PublicExecuteParams } from "@modules/platform/cqrs"

/** What reading a collage takes: the name it is stored under. */
interface GetCollageRequest {
    /** The hash that names the collage. */
    readonly key: string
}

/** Reads the public collage image of several product photos, for any caller. */
export class GetCollageQuery extends Query<StoredCollage> {
    constructor(readonly params: PublicExecuteParams<GetCollageRequest>) {
        super()
    }
}
