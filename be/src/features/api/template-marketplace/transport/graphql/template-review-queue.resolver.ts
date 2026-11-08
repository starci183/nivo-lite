import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectQueryBus, type Principal } from "@modules/platform/cqrs"
import { TemplateReviewQueueQuery } from "../../application/template-review-queue.query"
import { ListingType } from "./dto/listing.type"
import { toTemplateReviewQueueType } from "./template-review-queue.mapper"

@Resolver()
/** GraphQL door of templateReviewQueue. */
export class TemplateReviewQueueResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Lists the submitted listings waiting for a platform reviewer. */
    @Query(() => [ListingType], { name: "templateReviewQueue" })
    async templateReviewQueue(@CurrentPrincipal() principal: Principal): Promise<Array<ListingType>> {
        const result = await this.queryBus.execute(new TemplateReviewQueueQuery({ request: {}, principal }))
        return toTemplateReviewQueueType(result)
    }
}
