import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus, type Principal } from "@modules/platform/cqrs"
import { RunnableWorkflowQuery } from "../../application/runnable-workflow.query"
import { RunnableWorkflowInput } from "./dto/runnable-workflow.input"
import { RunnableWorkflowType } from "./dto/workflow-run.type"
import { toRunnableWorkflowType } from "./run-workflow.mapper"

@Resolver()
/** GraphQL door of runnableWorkflow. */
export class RunnableWorkflowResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Whether a person may start one workflow and the JSON Schema of its declared input (owner or manager). */
    @Query(() => RunnableWorkflowType, { name: "runnableWorkflow" })
    async runnableWorkflow(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: RunnableWorkflowInput,
    ): Promise<RunnableWorkflowType> {
        const view = await this.queryBus.execute(new RunnableWorkflowQuery({ request: { workspaceId, ...input }, principal }))
        return toRunnableWorkflowType(view)
    }
}
