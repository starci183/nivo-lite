import { CommandHandler } from "@nestjs/cqrs"
import { AgentBindingsService } from "@modules/domain/agent-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RevokeAgentConnectionCommand } from "./revoke-agent-connection.command"

@CommandHandler(RevokeAgentConnectionCommand)
/** Removes the binding through the bindings service. */
export class RevokeAgentConnectionHandler extends ICQRSHandler<RevokeAgentConnectionCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly bindings: AgentBindingsService,
    ) {
        super(logger)
    }

    protected override process(command: RevokeAgentConnectionCommand): Promise<void> {
        return this.bindings.revoke(command.params.principal.id, command.params.request)
    }
}
