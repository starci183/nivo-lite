import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, type Principal } from "@modules/platform/cqrs"
import { RunConnectionActionCommand } from "../../application/run-connection-action.command"
import { RunConnectionActionInput } from "./dto/run-connection-action.input"
import { ConnectionActionResultType } from "./dto/run-connection-action.type"
import { toConnectionActionResultType, toRunConnectionActionRequest } from "./run-connection-action.mapper"

@Resolver()
/** GraphQL door of runConnectionAction. */
export class RunConnectionActionResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Runs one declared action of an account (send a test email, make it the default) through its provider's own service. */
    @Mutation(() => ConnectionActionResultType, { name: "runConnectionAction" })
    async runConnectionAction(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: RunConnectionActionInput,
    ): Promise<ConnectionActionResultType> {
        const result = await this.commandBus.execute(
            new RunConnectionActionCommand({ request: toRunConnectionActionRequest(workspaceId, input), principal }),
        )
        return toConnectionActionResultType(result)
    }
}
