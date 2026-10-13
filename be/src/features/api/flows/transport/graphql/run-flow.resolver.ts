import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RunFlowCommand } from "../../application/run-flow.command"
import { RunFlowInput } from "./dto/run-flow.input"
import { RunFlowType } from "./dto/run-flow.type"
import { toRunFlowRequest, toRunFlowType } from "./run-flow.mapper"

@Resolver()
/** GraphQL door of the operating flow: authority, rules, staff and the decisions on the work waiting in Office. */
export class RunFlowResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Runs one flow command as the signed-in member; the service admits owners and managers for what changes the rules. */
    @Mutation(() => RunFlowType, { name: "runFlow" })
    async runFlow(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: RunFlowInput,
    ): Promise<RunFlowType> {
        const result = await this.commandBus.execute(
            new RunFlowCommand({ request: toRunFlowRequest(workspaceId, input), principal }),
        )
        return toRunFlowType(result)
    }
}
