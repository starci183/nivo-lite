import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RemoveMemberCommand } from "../../application/remove-member.command"
import { MemberRefInput } from "./dto/member-ref.input"
import { toRemoveMemberRequest } from "./member-change.mapper"

@Resolver()
/** GraphQL door of removing a member. */
export class RemoveMemberResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Removes a member from the workspace; never one's own account. */
    @Mutation(() => Boolean, { name: "removeMember" })
    async removeMember(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: MemberRefInput,
    ): Promise<boolean> {
        await this.commandBus.execute(
            new RemoveMemberCommand({ request: toRemoveMemberRequest(workspaceId, input), principal }),
        )
        return true
    }
}
