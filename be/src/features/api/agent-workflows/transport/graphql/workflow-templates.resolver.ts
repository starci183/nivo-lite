import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus, type Principal } from "@modules/platform/cqrs"
import { WorkflowTemplatesQuery } from "../../application/workflow-templates.query"
import { WorkflowTemplateType } from "./dto/workflow-template.type"
import { WorkflowTemplatesInput } from "./dto/workflow-templates.input"

@Resolver()
/** GraphQL door of workflowTemplates. */
export class WorkflowTemplatesResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** The workflowTemplates query. */
    @Query(() => [WorkflowTemplateType], { name: "workflowTemplates" })
    workflowTemplates(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: WorkflowTemplatesInput,
    ): Promise<ReadonlyArray<WorkflowTemplateType>> {
        return this.queryBus.execute(new WorkflowTemplatesQuery({ request: { workspaceId, ...input }, principal }))
    }
}
