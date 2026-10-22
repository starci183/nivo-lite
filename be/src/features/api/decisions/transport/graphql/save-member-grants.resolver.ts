import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SaveMemberGrantsCommand } from "../../application/save-member-grants.command"
import { MemberGrantType } from "./dto/member-grant.type"
import { SaveMemberGrantsInput } from "./dto/save-member-grants.input"
import { toMemberGrantsType, toSaveMemberGrantsRequest } from "./decisions.mapper"

@Resolver()
/** GraphQL door that makes the approval limits of one action exactly the ones named. */
export class SaveMemberGrantsResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Saves the approval limits of one action; the owner only. */
    @Mutation(() => [MemberGrantType], { name: "saveMemberGrants" })
    async saveMemberGrants(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SaveMemberGrantsInput,
    ): Promise<Array<MemberGrantType>> {
        const result = await this.commandBus.execute(
            new SaveMemberGrantsCommand({ request: toSaveMemberGrantsRequest(workspaceId, input), principal }),
        )
        return toMemberGrantsType(result)
    }
}
