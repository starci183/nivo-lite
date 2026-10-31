import { CommandHandler } from "@nestjs/cqrs"
import { AgentWorkDoorsService } from "@modules/domain/agent-work"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CloseAgentTaskCommand } from "./close-agent-task.command"

@CommandHandler(CloseAgentTaskCommand)
/** Drops a task of an agent as an owner or manager. */
export class CloseAgentTaskHandler extends ICQRSHandler<CloseAgentTaskCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly doors: AgentWorkDoorsService,
    ) {
        super(logger)
    }

    protected override process(command: CloseAgentTaskCommand): Promise<void> {
        return this.doors.closeTask(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.installationId,
            command.params.request.taskId,
        )
    }
}
