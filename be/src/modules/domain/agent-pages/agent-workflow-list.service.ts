import { Injectable, Optional } from "@nestjs/common"
import { AgentWorkflowRunsService, AgentWorkflowsAdminService } from "@modules/domain/agent-graphs"
import { withReadinessOf } from "./workflow-readiness.policy"
import type { OptionalText } from "./agent-pages.contracts"
import type { WorkflowListWire } from "./workflow-readiness.contracts"

@Injectable()
/**
 * Lists the workflows of the agent of one installation, the primary one first adopted from its graph, each with its readiness
 * (hidden while a blocking step waits for a provider; the side steps skipped). The admin service checks the seat and that the
 * workflows are the agent's; readiness is read only for the workflows it answered.
 */
export class AgentWorkflowListService {
    constructor(
        private readonly admin: AgentWorkflowsAdminService,
        @Optional() private readonly runs?: AgentWorkflowRunsService,
    ) {}

    /** The workflows of the installation with their readiness; null readiness where an app reads none. */
    async list(
        principalId: string,
        workspaceId: string,
        installationId: string,
        locale: OptionalText,
    ): Promise<ReadonlyArray<WorkflowListWire>> {
        const workflows = await this.admin.list({ workspaceId, principalId }, { installationId, locale })
        const readiness =
            this.runs === undefined
                ? null
                : await this.runs.readinessOf(
                      workspaceId,
                      workflows.map((workflow) => workflow.id),
                  )
        return withReadinessOf(workflows, readiness)
    }
}
