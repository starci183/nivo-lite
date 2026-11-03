import { Query } from "@nestjs/cqrs"
import type { ListingView } from "@modules/domain/template-marketplace"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { MyTemplateListingsRequest } from "./my-template-listings.contracts"

/** Lists the listings of the templates of the caller with their review state. */
export class MyTemplateListingsQuery extends Query<ReadonlyArray<ListingView>> {
    constructor(readonly params: ExecuteParams<MyTemplateListingsRequest>) {
        super()
    }
}
