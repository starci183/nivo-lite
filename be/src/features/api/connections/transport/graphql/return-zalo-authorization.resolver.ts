import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ReturnZaloAuthorizationCommand } from "../../application/return-zalo-authorization.command"
import { ReturnZaloAuthorizationInput } from "./dto/return-zalo-authorization.input"
import { ZaloWizardConnectionType } from "./dto/zalo-wizard-connection.type"
import { toReturnZaloAuthorizationRequest, toReturnZaloAuthorizationType } from "./return-zalo-authorization.mapper"

@Resolver()
/** GraphQL door of returnZaloAuthorization. */
export class ReturnZaloAuthorizationResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Finishes the Zalo sign-in with what Zalo returned the browser with. */
    @Mutation(() => ZaloWizardConnectionType, { name: "returnZaloAuthorization" })
    async returnZaloAuthorization(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ReturnZaloAuthorizationInput,
    ): Promise<ZaloWizardConnectionType> {
        const result = await this.commandBus.execute(
            new ReturnZaloAuthorizationCommand({
                request: toReturnZaloAuthorizationRequest(workspaceId, input),
                principal,
            }),
        )
        return toReturnZaloAuthorizationType(result)
    }
}
