import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetLoyaltyProgramQuery } from "../../application/get-loyalty-program.query"
import { toLoyaltyProgramRequest, toLoyaltyProgramType } from "./loyalty-program.mapper"
import { LoyaltyProgramSettingsType } from "./dto/loyalty-program-settings.type"

@Resolver()
/** The GraphQL door for loyalty program. */
export class LoyaltyProgramResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Runs loyalty program for the selected workspace. */
    @Query(() => LoyaltyProgramSettingsType, { name: "loyaltyProgram" })
    async loyaltyProgram(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<LoyaltyProgramSettingsType> {
        const result = await this.queryBus.execute(
            new GetLoyaltyProgramQuery({ request: toLoyaltyProgramRequest(workspaceId), principal }),
        )
        return toLoyaltyProgramType(result)
    }
}
