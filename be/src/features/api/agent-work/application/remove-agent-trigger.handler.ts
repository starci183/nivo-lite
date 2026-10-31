import { CommandHandler } from "@nestjs/cqrs"
import { AgentWorkDoorsService } from "@modules/domain/agent-work"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RemoveAgentTriggerCommand } from "./remove-agent-trigger.command"

@CommandHandler(RemoveAgentTriggerCommand)
/** Removes a trigger of an agent as an owner or manager. */
export class RemoveAgentTriggerHandler extends ICQRSHandler<RemoveAgentTriggerCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly doors: AgentWorkDoorsService,
    ) {
        super(logger)
    }

    protected override process(command: RemoveAgentTriggerCommand): Promise<void> {
        return this.doors.removeTrigger(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.installationId,
            command.params.request.triggerId,
        )
    }
}
