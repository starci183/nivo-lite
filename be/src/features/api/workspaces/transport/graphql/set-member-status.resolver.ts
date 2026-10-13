import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SetMemberStatusCommand } from "../../application/set-member-status.command"
import { SetMemberStatusInput } from "./dto/set-member-status.input"
import { toSetMemberStatusRequest } from "./member-change.mapper"

@Resolver()
/** GraphQL door of enabling or disabling a member. */
export class SetMemberStatusResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Disables or enables a member; never one's own account. */
    @Mutation(() => Boolean, { name: "setMemberStatus" })
    async setMemberStatus(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SetMemberStatusInput,
    ): Promise<boolean> {
        await this.commandBus.execute(
            new SetMemberStatusCommand({ request: toSetMemberStatusRequest(workspaceId, input), principal }),
        )
        return true
    }
}
