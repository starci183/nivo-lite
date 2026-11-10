import { CommandHandler } from "@nestjs/cqrs"
import { AgentWorkflowsAdminService } from "@modules/domain/agent-graphs"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { AgentGraphLayoutResult } from "./agent-graph-layout.contracts"
import { SaveAgentGraphLayoutCommand } from "./save-agent-graph-layout.command"

@CommandHandler(SaveAgentGraphLayoutCommand)
/** Replaces where each workflow sits on the Graph page of one installation. The admin service checks the seat (owner or manager). */
export class SaveAgentGraphLayoutHandler extends ICQRSHandler<SaveAgentGraphLayoutCommand, AgentGraphLayoutResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly admin: AgentWorkflowsAdminService,
    ) {
        super(logger)
    }

    protected override process(command: SaveAgentGraphLayoutCommand): Promise<AgentGraphLayoutResult> {
        return this.admin.saveLayout(
            { workspaceId: command.params.request.workspaceId, principalId: command.params.principal.id },
            command.params.request,
        )
    }
}
