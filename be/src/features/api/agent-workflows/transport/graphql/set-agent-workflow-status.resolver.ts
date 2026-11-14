import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, type Principal } from "@modules/platform/cqrs"
import { SetAgentWorkflowStatusCommand } from "../../application/set-agent-workflow-status.command"
import { SetAgentWorkflowStatusInput } from "./dto/set-agent-workflow-status.input"

@Resolver()
/** GraphQL door of setAgentWorkflowStatus. */
export class SetAgentWorkflowStatusResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** The setAgentWorkflowStatus mutation. */
    @Mutation(() => Boolean, { name: "setAgentWorkflowStatus" })
    setAgentWorkflowStatus(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SetAgentWorkflowStatusInput,
    ): Promise<boolean> {
        return this.commandBus.execute(
            new SetAgentWorkflowStatusCommand({ request: { workspaceId, ...input }, principal }),
        )
    }
}
