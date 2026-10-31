import { CommandHandler } from "@nestjs/cqrs"
import { AgentGraphAdminService } from "@modules/domain/agent-graphs"
import type { GraphVersionView } from "@modules/domain/agent-graphs"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RestoreAgentGraphVersionCommand } from "./restore-agent-graph-version.command"

@CommandHandler(RestoreAgentGraphVersionCommand)
/** Publishes an older version of the graph of one agent again as a new one. The admin service checks the owner or manager role. */
export class RestoreAgentGraphVersionHandler extends ICQRSHandler<RestoreAgentGraphVersionCommand, GraphVersionView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly admin: AgentGraphAdminService,
    ) {
        super(logger)
    }

    protected override process(command: RestoreAgentGraphVersionCommand): Promise<GraphVersionView> {
        return this.admin.restore(
            { workspaceId: command.params.request.workspaceId, principalId: command.params.principal.id },
            command.params.request.agentId,
            command.params.request.versionId,
        )
    }
}
