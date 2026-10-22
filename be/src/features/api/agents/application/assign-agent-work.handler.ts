import { CommandHandler } from "@nestjs/cqrs"
import { AgentAssignmentsService } from "@modules/domain/agent-profile"
import type { AssignmentThread } from "@modules/domain/agent-profile"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AssignAgentWorkCommand } from "./assign-agent-work.command"

@CommandHandler(AssignAgentWorkCommand)
/** Hands the agent work through the assignments service. */
export class AssignAgentWorkHandler extends ICQRSHandler<AssignAgentWorkCommand, AssignmentThread> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly assignments: AgentAssignmentsService,
    ) {
        super(logger)
    }

    protected override process(command: AssignAgentWorkCommand): Promise<AssignmentThread> {
        return this.assignments.assign(command.params.principal.id, command.params.request.workspaceId, {
            agentId: command.params.request.agentId,
            text: command.params.request.text,
        })
    }
}
