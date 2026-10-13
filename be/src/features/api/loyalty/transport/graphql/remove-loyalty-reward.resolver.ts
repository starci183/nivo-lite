import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RemoveLoyaltyRewardCommand } from "../../application/remove-loyalty-reward.command"
import { toRemoveLoyaltyRewardRequest, toRemoveLoyaltyRewardType } from "./remove-loyalty-reward.mapper"
import { RemoveLoyaltyRewardInput } from "./dto/remove-loyalty-reward.input"
import { RemoveLoyaltyRewardType } from "./dto/remove-loyalty-reward.type"

@Resolver()
/** The GraphQL door for remove loyalty reward. */
export class RemoveLoyaltyRewardResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Runs remove loyalty reward for the selected workspace. */
    @Mutation(() => RemoveLoyaltyRewardType, { name: "removeLoyaltyReward" })
    async removeLoyaltyReward(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: RemoveLoyaltyRewardInput,
    ): Promise<RemoveLoyaltyRewardType> {
        const result = await this.commandBus.execute(
            new RemoveLoyaltyRewardCommand({ request: toRemoveLoyaltyRewardRequest(input, workspaceId), principal }),
        )
        return toRemoveLoyaltyRewardType(result)
    }
}
