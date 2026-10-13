import type { CommandBus } from "@nestjs/cqrs"
import { Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AddLoyaltyPresetRewardsCommand } from "../../application/add-loyalty-preset-rewards.command"
import { toAddLoyaltyPresetRewardsRequest, toAddLoyaltyPresetRewardsType } from "./add-loyalty-preset-rewards.mapper"
import { AddLoyaltyPresetRewardsType } from "./dto/add-loyalty-preset-rewards.type"

@Resolver()
/** The GraphQL door for add loyalty preset rewards. */
export class AddLoyaltyPresetRewardsResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Runs add loyalty preset rewards for the selected workspace. */
    @Mutation(() => AddLoyaltyPresetRewardsType, { name: "addLoyaltyPresetRewards" })
    async addLoyaltyPresetRewards(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<AddLoyaltyPresetRewardsType> {
        const result = await this.commandBus.execute(
            new AddLoyaltyPresetRewardsCommand({ request: toAddLoyaltyPresetRewardsRequest(workspaceId), principal }),
        )
        return toAddLoyaltyPresetRewardsType(result)
    }
}
