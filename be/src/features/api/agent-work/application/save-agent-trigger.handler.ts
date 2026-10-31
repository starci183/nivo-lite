import { CommandHandler } from "@nestjs/cqrs"
import { AgentWorkDoorsService } from "@modules/domain/agent-work"
import type { AgentTriggerRecord } from "@modules/domain/agent-work"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SaveAgentTriggerCommand } from "./save-agent-trigger.command"

@CommandHandler(SaveAgentTriggerCommand)
/** Writes a trigger of an agent as an owner or manager. */
export class SaveAgentTriggerHandler extends ICQRSHandler<SaveAgentTriggerCommand, AgentTriggerRecord> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly doors: AgentWorkDoorsService,
    ) {
        super(logger)
    }

    protected override process(command: SaveAgentTriggerCommand): Promise<AgentTriggerRecord> {
        return this.doors.saveTrigger(command.params.principal.id, command.params.request)
    }
}
