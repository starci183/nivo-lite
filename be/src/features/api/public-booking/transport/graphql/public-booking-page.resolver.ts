import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { Public, PublicReason } from "@modules/domain/identity"
import { InjectQueryBus } from "@modules/platform/cqrs"
import { RateLimit, RateTier } from "@modules/platform/http-security"
import { GetBookingPageQuery } from "../../application/get-booking-page.query"
import { toPublicBookingPageRequest, toPublicBookingPageType } from "./public-booking-page.mapper"
import { PublicBookingPageInput } from "./dto/public-booking-page.input"
import { PublicBookingPageType } from "./dto/public-booking-page.type"

@Resolver()
/** The public GraphQL door of publicBookingPage. */
export class PublicBookingPageResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Shows a published booking page and the services it offers. */
    @Query(() => PublicBookingPageType, { name: "publicBookingPage" })
    @Public({ reason: PublicReason.CatalogRead })
    @RateLimit(RateTier.Strict)
    async publicBookingPage(@Args("input") input: PublicBookingPageInput): Promise<PublicBookingPageType> {
        const result = await this.queryBus.execute(
            new GetBookingPageQuery({ request: toPublicBookingPageRequest(input) }),
        )
        return toPublicBookingPageType(result)
    }
}
