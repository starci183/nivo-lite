import { CommandHandler } from "@nestjs/cqrs"
import { AgentBindingsService } from "@modules/domain/agent-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GrantAgentConnectionCommand } from "./grant-agent-connection.command"

@CommandHandler(GrantAgentConnectionCommand)
/** Grants the binding through the bindings service. */
export class GrantAgentConnectionHandler extends ICQRSHandler<GrantAgentConnectionCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly bindings: AgentBindingsService,
    ) {
        super(logger)
    }

    protected override process(command: GrantAgentConnectionCommand): Promise<void> {
        return this.bindings.grant(command.params.principal.id, command.params.request)
    }
}
