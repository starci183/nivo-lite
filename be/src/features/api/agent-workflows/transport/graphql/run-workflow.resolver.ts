import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, type Principal } from "@modules/platform/cqrs"
import { RunWorkflowCommand } from "../../application/run-workflow.command"
import { RunWorkflowInput } from "./dto/run-workflow.input"
import { WorkflowRunType } from "./dto/workflow-run.type"
import { toRunWorkflowRequest, toWorkflowRunType } from "./run-workflow.mapper"

@Resolver()
/** GraphQL door of runWorkflow. */
export class RunWorkflowResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Starts one workflow of an installed agent through its workflow.called trigger, once per opKey (owner or manager). */
    @Mutation(() => WorkflowRunType, { name: "runWorkflow" })
    async runWorkflow(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: RunWorkflowInput,
    ): Promise<WorkflowRunType> {
        const answer = await this.commandBus.execute(
            new RunWorkflowCommand({ request: toRunWorkflowRequest(workspaceId, input), principal }),
        )
        return toWorkflowRunType(answer)
    }
}
