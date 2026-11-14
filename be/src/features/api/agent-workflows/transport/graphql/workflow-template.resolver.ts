import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus, type Principal } from "@modules/platform/cqrs"
import { WorkflowTemplateQuery } from "../../application/workflow-template.query"
import { WorkflowTemplateType } from "./dto/workflow-template.type"
import { WorkflowTemplateInput } from "./dto/workflow-template.input"

@Resolver()
/** GraphQL door of workflowTemplate. */
export class WorkflowTemplateResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** The workflowTemplate query. */
    @Query(() => WorkflowTemplateType, { name: "workflowTemplate" })
    workflowTemplate(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: WorkflowTemplateInput,
    ): Promise<WorkflowTemplateType> {
        return this.queryBus.execute(new WorkflowTemplateQuery({ request: { workspaceId, ...input }, principal }))
    }
}
