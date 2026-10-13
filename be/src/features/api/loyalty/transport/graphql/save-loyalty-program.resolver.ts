import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SaveLoyaltyProgramCommand } from "../../application/save-loyalty-program.command"
import { toSaveLoyaltyProgramRequest, toSaveLoyaltyProgramType } from "./save-loyalty-program.mapper"
import { SaveLoyaltyProgramInput } from "./dto/save-loyalty-program.input"
import { LoyaltyProgramType } from "./dto/loyalty-program.type"

@Resolver()
/** The GraphQL door for save loyalty program. */
export class SaveLoyaltyProgramResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Runs save loyalty program for the selected workspace. */
    @Mutation(() => LoyaltyProgramType, { name: "saveLoyaltyProgram" })
    async saveLoyaltyProgram(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SaveLoyaltyProgramInput,
    ): Promise<LoyaltyProgramType> {
        const result = await this.commandBus.execute(
            new SaveLoyaltyProgramCommand({ request: toSaveLoyaltyProgramRequest(input, workspaceId), principal }),
        )
        return toSaveLoyaltyProgramType(result)
    }
}
