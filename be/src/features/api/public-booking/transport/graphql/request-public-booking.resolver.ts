import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { Public, PublicReason } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import { RateLimit, RateTier } from "@modules/platform/http-security"
import { RequestBookingCommand } from "../../application/request-booking.command"
import { toRequestPublicBookingRequest, toRequestPublicBookingType } from "./request-public-booking.mapper"
import { RequestPublicBookingInput } from "./dto/request-public-booking.input"
import { RequestPublicBookingType } from "./dto/request-public-booking.type"

@Resolver()
/** The public GraphQL door of requestPublicBooking. */
export class RequestPublicBookingResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Records the anonymous visitor's booking request. */
    @Mutation(() => RequestPublicBookingType, { name: "requestPublicBooking" })
    @Public({ reason: PublicReason.CatalogRead })
    @RateLimit(RateTier.Strict)
    async requestPublicBooking(@Args("input") input: RequestPublicBookingInput): Promise<RequestPublicBookingType> {
        const result = await this.commandBus.execute(
            new RequestBookingCommand({ request: toRequestPublicBookingRequest(input) }),
        )
        return toRequestPublicBookingType(result)
    }
}
