import { CommandHandler } from "@nestjs/cqrs"
import { AgentWorkDoorsService } from "@modules/domain/agent-work"
import type { AgentGoalRecord } from "@modules/domain/agent-work"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SaveAgentGoalCommand } from "./save-agent-goal.command"

@CommandHandler(SaveAgentGoalCommand)
/** Writes a goal of an agent as an owner or manager. */
export class SaveAgentGoalHandler extends ICQRSHandler<SaveAgentGoalCommand, AgentGoalRecord> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly doors: AgentWorkDoorsService,
    ) {
        super(logger)
    }

    protected override process(command: SaveAgentGoalCommand): Promise<AgentGoalRecord> {
        return this.doors.saveGoal(command.params.principal.id, command.params.request)
    }
}
