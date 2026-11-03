import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { MyTemplateListingsQuery } from "../../application/my-template-listings.query"
import { ListingType } from "./dto/listing.type"
import { toMyTemplateListingsType } from "./my-template-listings.mapper"

@Resolver()
/** GraphQL door of myTemplateListings. */
export class MyTemplateListingsResolver {
    constructor(@InjectQueryBus() private readonly bus: QueryBus) {}

    /** Lists the listings of the templates of the caller with their review state. */
    @Query(() => [ListingType], { name: "myTemplateListings" })
    async myTemplateListings(@CurrentPrincipal() principal: Principal): Promise<Array<ListingType>> {
        const result = await this.bus.execute(new MyTemplateListingsQuery({ request: {}, principal }))
        return toMyTemplateListingsType(result)
    }
}
