import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AuthorizeGoogleCommand } from "../../application/authorize-google.command"
import { AuthorizeGoogleInput } from "./dto/authorize-google.input"
import { AuthorizeUrlType } from "./dto/authorize-url.type"
import { toAuthorizeGoogleRequest, toAuthorizeGoogleType } from "./authorize-google.mapper"

@Resolver()
/** GraphQL door of authorizeGoogle. */
export class AuthorizeGoogleResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Starts the Google consent. */
    @Mutation(() => AuthorizeUrlType, { name: "authorizeGoogle" })
    async authorizeGoogle(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: AuthorizeGoogleInput,
    ): Promise<AuthorizeUrlType> {
        const result = await this.commandBus.execute(
            new AuthorizeGoogleCommand({ request: toAuthorizeGoogleRequest(workspaceId, input), principal }),
        )
        return toAuthorizeGoogleType(result)
    }
}
