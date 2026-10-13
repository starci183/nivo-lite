import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { Public, PublicReason } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import { RateLimit, RateTier } from "@modules/platform/http-security"
import { VerifyLoyaltyCodeCommand } from "../../application/verify-loyalty-code.command"
import { toVerifyLoyaltyCodeRequest, toVerifyLoyaltyCodeType } from "./verify-loyalty-code.mapper"
import { VerifyLoyaltyCodeInput } from "./dto/verify-loyalty-code.input"
import { VerifyLoyaltyCodeType } from "./dto/verify-loyalty-code.type"

@Resolver()
/** The public GraphQL door of verifyLoyaltyCode. */
export class VerifyLoyaltyCodeResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Verifies the chat code and unlocks the customer's points. */
    @Mutation(() => VerifyLoyaltyCodeType, { name: "verifyLoyaltyCode" })
    @Public({ reason: PublicReason.CatalogRead })
    @RateLimit(RateTier.Strict)
    async verifyLoyaltyCode(@Args("input") input: VerifyLoyaltyCodeInput): Promise<VerifyLoyaltyCodeType> {
        const result = await this.commandBus.execute(
            new VerifyLoyaltyCodeCommand({ request: toVerifyLoyaltyCodeRequest(input) }),
        )
        return toVerifyLoyaltyCodeType(result)
    }
}
