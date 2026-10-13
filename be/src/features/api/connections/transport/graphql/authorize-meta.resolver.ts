import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AuthorizeMetaCommand } from "../../application/authorize-meta.command"
import { AuthorizeMetaInput } from "./dto/authorize-meta.input"
import { MetaAuthorizationType } from "./dto/meta-authorization.type"
import { toAuthorizeMetaRequest, toAuthorizeMetaType } from "./authorize-meta.mapper"

@Resolver()
/** GraphQL door of authorizeMeta. */
export class AuthorizeMetaResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Starts the Meta login for a new or an existing connection. */
    @Mutation(() => MetaAuthorizationType, { name: "authorizeMeta" })
    async authorizeMeta(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: AuthorizeMetaInput,
    ): Promise<MetaAuthorizationType> {
        const result = await this.commandBus.execute(
            new AuthorizeMetaCommand({ request: toAuthorizeMetaRequest(workspaceId, input), principal }),
        )
        return toAuthorizeMetaType(result)
    }
}
