import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetLoyaltyBoardQuery } from "../../application/get-loyalty-board.query"
import { toLoyaltyBoardRequest, toLoyaltyBoardType } from "./loyalty-board.mapper"
import { LoyaltyBoardType } from "./dto/loyalty-board.type"

@Resolver()
/** The GraphQL door for loyalty board. */
export class LoyaltyBoardResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Runs loyalty board for the selected workspace. */
    @Query(() => LoyaltyBoardType, { name: "loyaltyBoard" })
    async loyaltyBoard(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<LoyaltyBoardType> {
        const result = await this.queryBus.execute(
            new GetLoyaltyBoardQuery({ request: toLoyaltyBoardRequest(workspaceId), principal }),
        )
        return toLoyaltyBoardType(result)
    }
}
