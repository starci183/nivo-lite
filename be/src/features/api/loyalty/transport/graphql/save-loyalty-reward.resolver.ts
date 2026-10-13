import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SaveLoyaltyRewardCommand } from "../../application/save-loyalty-reward.command"
import { toSaveLoyaltyRewardRequest, toSaveLoyaltyRewardType } from "./save-loyalty-reward.mapper"
import { SaveLoyaltyRewardInput } from "./dto/save-loyalty-reward.input"
import { LoyaltyRewardType } from "./dto/loyalty-reward.type"

@Resolver()
/** The GraphQL door for save loyalty reward. */
export class SaveLoyaltyRewardResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Runs save loyalty reward for the selected workspace. */
    @Mutation(() => LoyaltyRewardType, { name: "saveLoyaltyReward" })
    async saveLoyaltyReward(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SaveLoyaltyRewardInput,
    ): Promise<LoyaltyRewardType> {
        const result = await this.commandBus.execute(
            new SaveLoyaltyRewardCommand({ request: toSaveLoyaltyRewardRequest(input, workspaceId), principal }),
        )
        return toSaveLoyaltyRewardType(result)
    }
}
