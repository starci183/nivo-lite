import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { Public, PublicReason } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import { RateLimit, RateTier } from "@modules/platform/http-security"
import { RequestLoyaltyCodeCommand } from "../../application/request-loyalty-code.command"
import { toRequestLoyaltyCodeRequest, toRequestLoyaltyCodeType } from "./request-loyalty-code.mapper"
import { RequestLoyaltyCodeInput } from "./dto/request-loyalty-code.input"
import { RequestLoyaltyCodeType } from "./dto/request-loyalty-code.type"

@Resolver()
/** The public GraphQL door of requestLoyaltyCode. */
export class RequestLoyaltyCodeResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Requests a verification code in the customer's own chat. */
    @Mutation(() => RequestLoyaltyCodeType, { name: "requestLoyaltyCode" })
    @Public({ reason: PublicReason.CatalogRead })
    @RateLimit(RateTier.Strict)
    async requestLoyaltyCode(@Args("input") input: RequestLoyaltyCodeInput): Promise<RequestLoyaltyCodeType> {
        const result = await this.commandBus.execute(
            new RequestLoyaltyCodeCommand({ request: toRequestLoyaltyCodeRequest(input) }),
        )
        return toRequestLoyaltyCodeType(result)
    }
}
