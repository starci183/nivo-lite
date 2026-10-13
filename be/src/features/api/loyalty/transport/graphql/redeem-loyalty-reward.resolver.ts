import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RedeemRewardCommand } from "../../application/redeem-reward.command"
import { toRedeemLoyaltyRewardRequest, toRedeemLoyaltyRewardType } from "./redeem-loyalty-reward.mapper"
import { RedeemLoyaltyRewardInput } from "./dto/redeem-loyalty-reward.input"
import { RedeemLoyaltyRewardType } from "./dto/redeem-loyalty-reward.type"

@Resolver()
/** The GraphQL door for redeem loyalty reward. */
export class RedeemLoyaltyRewardResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Runs redeem loyalty reward for the selected workspace. */
    @Mutation(() => RedeemLoyaltyRewardType, { name: "redeemLoyaltyReward" })
    async redeemLoyaltyReward(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: RedeemLoyaltyRewardInput,
    ): Promise<RedeemLoyaltyRewardType> {
        const result = await this.commandBus.execute(
            new RedeemRewardCommand({ request: toRedeemLoyaltyRewardRequest(input, workspaceId), principal }),
        )
        return toRedeemLoyaltyRewardType(result)
    }
}
