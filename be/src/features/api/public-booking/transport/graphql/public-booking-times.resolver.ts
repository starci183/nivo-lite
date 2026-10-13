import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { Public, PublicReason } from "@modules/domain/identity"
import { InjectQueryBus } from "@modules/platform/cqrs"
import { RateLimit, RateTier } from "@modules/platform/http-security"
import { ListFreeTimesQuery } from "../../application/list-free-times.query"
import { toPublicBookingTimesRequest, toPublicBookingTimesType } from "./public-booking-times.mapper"
import { PublicBookingTimesInput } from "./dto/public-booking-times.input"
import { PublicBookingTimesType } from "./dto/public-booking-times.type"

@Resolver()
/** The public GraphQL door of publicBookingTimes. */
export class PublicBookingTimesResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Lists the currently free starts of a service on a local day. */
    @Query(() => PublicBookingTimesType, { name: "publicBookingTimes" })
    @Public({ reason: PublicReason.CatalogRead })
    @RateLimit(RateTier.Strict)
    async publicBookingTimes(@Args("input") input: PublicBookingTimesInput): Promise<PublicBookingTimesType> {
        const result = await this.queryBus.execute(
            new ListFreeTimesQuery({ request: toPublicBookingTimesRequest(input) }),
        )
        return toPublicBookingTimesType(result)
    }
}
