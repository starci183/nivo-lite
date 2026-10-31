import { CommandHandler } from "@nestjs/cqrs"
import { AgentGraphAdminService } from "@modules/domain/agent-graphs"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SetAgentGraphModeCommand } from "./set-agent-graph-mode.command"

@CommandHandler(SetAgentGraphModeCommand)
/** Sets whether the graph of one agent decides or only records. The admin service checks the owner or manager role. */
export class SetAgentGraphModeHandler extends ICQRSHandler<SetAgentGraphModeCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly admin: AgentGraphAdminService,
    ) {
        super(logger)
    }

    protected override process(command: SetAgentGraphModeCommand): Promise<void> {
        return this.admin.setMode(
            { workspaceId: command.params.request.workspaceId, principalId: command.params.principal.id },
            command.params.request.agentId,
            command.params.request.mode,
        )
    }
}
