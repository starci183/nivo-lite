import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { Public, PublicReason } from "@modules/domain/identity"
import { InjectQueryBus } from "@modules/platform/cqrs"
import { RateLimit, RateTier } from "@modules/platform/http-security"
import { GetLoyaltyPageQuery } from "../../application/get-loyalty-page.query"
import { toPublicLoyaltyPageRequest, toPublicLoyaltyPageType } from "./public-loyalty-page.mapper"
import { PublicLoyaltyPageInput } from "./dto/public-loyalty-page.input"
import { PublicLoyaltyPageType } from "./dto/public-loyalty-page.type"

@Resolver()
/** The public GraphQL door of publicLoyaltyPage. */
export class PublicLoyaltyPageResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Shows the published shop and loyalty program names. */
    @Query(() => PublicLoyaltyPageType, { name: "publicLoyaltyPage" })
    @Public({ reason: PublicReason.CatalogRead })
    @RateLimit(RateTier.Strict)
    async publicLoyaltyPage(@Args("input") input: PublicLoyaltyPageInput): Promise<PublicLoyaltyPageType> {
        const result = await this.queryBus.execute(
            new GetLoyaltyPageQuery({ request: toPublicLoyaltyPageRequest(input) }),
        )
        return toPublicLoyaltyPageType(result)
    }
}
