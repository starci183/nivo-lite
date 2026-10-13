import { CommandHandler } from "@nestjs/cqrs"
import { AgentsService } from "@modules/domain/agents"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SetAgentTextsCommand } from "./set-agent-texts.command"

@CommandHandler(SetAgentTextsCommand)
/** Replaces the texts through the agents service. */
export class SetAgentTextsHandler extends ICQRSHandler<SetAgentTextsCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly agents: AgentsService,
    ) {
        super(logger)
    }

    protected override process(command: SetAgentTextsCommand): Promise<void> {
        return this.agents.setTexts(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.agentId,
            command.params.request.texts,
        )
    }
}
