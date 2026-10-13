import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AuthorizeZaloCommand } from "../../application/authorize-zalo.command"
import { AuthorizeZaloInput } from "./dto/authorize-zalo.input"
import { ZaloAuthorizationType } from "./dto/zalo-authorization.type"
import { toAuthorizeZaloRequest, toAuthorizeZaloType } from "./authorize-zalo.mapper"

@Resolver()
/** GraphQL door of authorizeZalo. */
export class AuthorizeZaloResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Starts the Zalo sign-in of an OA. */
    @Mutation(() => ZaloAuthorizationType, { name: "authorizeZalo" })
    async authorizeZalo(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: AuthorizeZaloInput,
    ): Promise<ZaloAuthorizationType> {
        const result = await this.commandBus.execute(
            new AuthorizeZaloCommand({ request: toAuthorizeZaloRequest(workspaceId, input), principal }),
        )
        return toAuthorizeZaloType(result)
    }
}
