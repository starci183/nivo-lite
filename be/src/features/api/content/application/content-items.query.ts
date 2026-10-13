import { Query } from "@nestjs/cqrs"
import type { ContentItem } from "@modules/domain/content-items"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListContentItemsRequest } from "./content-items.contracts"

/** Lists workspace posts in schedule order, optionally within a range. */
export class ListContentItemsQuery extends Query<ReadonlyArray<ContentItem>> {
    constructor(readonly params: ExecuteParams<ListContentItemsRequest>) {
        super()
    }
}
