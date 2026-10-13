import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { UpdateLoyaltyMemberCommand } from "../../application/update-loyalty-member.command"
import { toUpdateLoyaltyMemberRequest, toUpdateLoyaltyMemberType } from "./update-loyalty-member.mapper"
import { UpdateLoyaltyMemberInput } from "./dto/update-loyalty-member.input"
import { UpdateLoyaltyMemberType } from "./dto/update-loyalty-member.type"

@Resolver()
/** The GraphQL door for update loyalty member. */
export class UpdateLoyaltyMemberResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Runs update loyalty member for the selected workspace. */
    @Mutation(() => UpdateLoyaltyMemberType, { name: "updateLoyaltyMember" })
    async updateLoyaltyMember(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: UpdateLoyaltyMemberInput,
    ): Promise<UpdateLoyaltyMemberType> {
        const result = await this.commandBus.execute(
            new UpdateLoyaltyMemberCommand({ request: toUpdateLoyaltyMemberRequest(input, workspaceId), principal }),
        )
        return toUpdateLoyaltyMemberType(result)
    }
}
