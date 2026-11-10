import { CommandHandler } from "@nestjs/cqrs"
import { McpGatewayAdminService } from "@modules/domain/mcp-gateway"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SetAgentAbilityCommand } from "./set-agent-ability.command"

@CommandHandler(SetAgentAbilityCommand)
/** Ticks or unticks one ability of an agent on a provider it is attached to. The admin service checks the owner or manager role. */
export class SetAgentAbilityHandler extends ICQRSHandler<SetAgentAbilityCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly admin: McpGatewayAdminService,
    ) {
        super(logger)
    }

    protected override process(command: SetAgentAbilityCommand): Promise<void> {
        return this.admin.setAbility(
            { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId },
            command.params.request.ability,
        )
    }
}
