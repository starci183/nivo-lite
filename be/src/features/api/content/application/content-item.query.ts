import { Query } from "@nestjs/cqrs"
import type { ContentItem } from "@modules/domain/content-items"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetContentItemRequest } from "./content-item.contracts"

/** Reads one workspace post with its editor data. */
export class GetContentItemQuery extends Query<ContentItem> {
    constructor(readonly params: ExecuteParams<GetContentItemRequest>) {
        super()
    }
}
