import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AdjustPointsCommand } from "../../application/adjust-points.command"
import { toAdjustLoyaltyPointsRequest, toAdjustLoyaltyPointsType } from "./adjust-loyalty-points.mapper"
import { AdjustLoyaltyPointsInput } from "./dto/adjust-loyalty-points.input"
import { AdjustLoyaltyPointsType } from "./dto/adjust-loyalty-points.type"

@Resolver()
/** The GraphQL door for adjust loyalty points. */
export class AdjustLoyaltyPointsResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Runs adjust loyalty points for the selected workspace. */
    @Mutation(() => AdjustLoyaltyPointsType, { name: "adjustLoyaltyPoints" })
    async adjustLoyaltyPoints(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: AdjustLoyaltyPointsInput,
    ): Promise<AdjustLoyaltyPointsType> {
        const result = await this.commandBus.execute(
            new AdjustPointsCommand({ request: toAdjustLoyaltyPointsRequest(input, workspaceId), principal }),
        )
        return toAdjustLoyaltyPointsType(result)
    }
}
