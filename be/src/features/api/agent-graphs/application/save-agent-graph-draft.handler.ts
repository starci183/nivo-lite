import { CommandHandler } from "@nestjs/cqrs"
import { AgentGraphAdminService } from "@modules/domain/agent-graphs"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SaveAgentGraphDraftCommand } from "./save-agent-graph-draft.command"

@CommandHandler(SaveAgentGraphDraftCommand)
/** Saves the draft of the graph of one agent under the revision the editor read. The admin service checks the owner or manager role. */
export class SaveAgentGraphDraftHandler extends ICQRSHandler<SaveAgentGraphDraftCommand, number> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly admin: AgentGraphAdminService,
    ) {
        super(logger)
    }

    protected override process(command: SaveAgentGraphDraftCommand): Promise<number> {
        return this.admin.saveDraft({ workspaceId: command.params.request.workspaceId, principalId: command.params.principal.id }, command.params.request.agentId, command.params.request.rev, command.params.request.documentJson)
    }
}
