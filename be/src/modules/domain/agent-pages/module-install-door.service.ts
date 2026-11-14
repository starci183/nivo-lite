import { Injectable, Optional } from "@nestjs/common"
import { AgentWorkflowInstallService } from "@modules/domain/agent-graphs"
import { ModuleInstallService, type InstallRequest, type InstallResult } from "@modules/domain/modules"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { AgentPagesLogEvent } from "./agent-pages.log-events"

@Injectable()
/**
 * Installs the module through the module install service, then gives its agent the workflows its plugin ships, the way the stack
 * seed gives a seeded shop its own (`AgentWorkflowInstallService`): an agent installed through the app holds them from the start.
 */
export class ModuleInstallDoorService {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        private readonly installs: ModuleInstallService,
        @Optional() private readonly workflows?: AgentWorkflowInstallService,
    ) {}

    /** Installs the module as the member, then makes the plugin's workflows for the agent it made (if it made one). */
    async install(principalId: string, request: InstallRequest): Promise<InstallResult> {
        const made = await this.installs.install(principalId, request)
        const { agentId, installationId } = made
        if (agentId !== null) await this.makeWorkflows(request, agentId, installationId)
        return made
    }

    private async makeWorkflows(request: InstallRequest, agentId: string, installationId: string): Promise<void> {
        const { workspaceId, moduleKey } = request
        try {
            await this.workflows?.install({ workspaceId, agentId, installationId, moduleKey })
        } catch (cause: unknown) {
            // The installation is made and announced: a failure here must not answer the owner "not installed".
            this.logger.error(AgentPagesLogEvent.WorkflowsFailed, cause, { workspaceId, installationId })
        }
    }
}
