import { CommandHandler } from "@nestjs/cqrs"
import { AgentGraphAdminService } from "@modules/domain/agent-graphs"
import type { GraphVersionView } from "@modules/domain/agent-graphs"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { PublishAgentGraphCommand } from "./publish-agent-graph.command"

@CommandHandler(PublishAgentGraphCommand)
/** Publishes the draft of the graph of one agent as the next version. The admin service checks the owner or manager role. */
export class PublishAgentGraphHandler extends ICQRSHandler<PublishAgentGraphCommand, GraphVersionView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly admin: AgentGraphAdminService,
    ) {
        super(logger)
    }

    protected override process(command: PublishAgentGraphCommand): Promise<GraphVersionView> {
        return this.admin.publish({ workspaceId: command.params.request.workspaceId, principalId: command.params.principal.id }, command.params.request.agentId, command.params.request.note)
    }
}
