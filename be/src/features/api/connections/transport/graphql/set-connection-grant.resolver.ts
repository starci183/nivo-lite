import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SetConnectionGrantCommand } from "../../application/set-connection-grant.command"
import { SetConnectionGrantInput } from "./dto/set-connection-grant.input"
import { toSetConnectionGrantRequest } from "./set-connection-grant.mapper"

@Resolver()
/** GraphQL door of setConnectionGrant. */
export class SetConnectionGrantResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Sets or removes the access of one agent to one connection. */
    @Mutation(() => Boolean, { name: "setConnectionGrant" })
    async setConnectionGrant(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SetConnectionGrantInput,
    ): Promise<boolean> {
        await this.commandBus.execute(
            new SetConnectionGrantCommand({ request: toSetConnectionGrantRequest(workspaceId, input), principal }),
        )
        return true
    }
}
