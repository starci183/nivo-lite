import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { UpdateAuthorityCommand } from "../../application/update-authority.command"
import { AuthorityProfileType } from "./dto/authority-profile.type"
import { UpdateAuthorityInput } from "./dto/update-authority.input"
import { toAuthorityProfileType, toUpdateAuthorityRequest } from "./decisions.mapper"

@Resolver()
/** GraphQL door that saves the authority sheet. */
export class UpdateAuthorityResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Saves the fields of the patch over the stored sheet. */
    @Mutation(() => AuthorityProfileType, { name: "updateAuthority" })
    async updateAuthority(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: UpdateAuthorityInput,
    ): Promise<AuthorityProfileType> {
        const result = await this.commandBus.execute(
            new UpdateAuthorityCommand({ request: toUpdateAuthorityRequest(workspaceId, input), principal }),
        )
        return toAuthorityProfileType(result)
    }
}
