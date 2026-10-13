import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { CreateInviteCommand } from "../../application/create-invite.command"
import { InviteResultType } from "./dto/invite-result.type"
import { CreateInviteInput } from "./dto/create-invite.input"
import { toCreateInviteRequest, toInviteResultType } from "./invite-result.mapper"

@Resolver()
/** GraphQL door of issuing an invitation. */
export class CreateInviteResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Invites a person by email; the link in the answer is the only place the token appears. */
    @Mutation(() => InviteResultType, { name: "createInvite" })
    async createInvite(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: CreateInviteInput,
    ): Promise<InviteResultType> {
        const result = await this.commandBus.execute(
            new CreateInviteCommand({ request: toCreateInviteRequest(workspaceId, input), principal }),
        )
        return toInviteResultType(result)
    }
}
