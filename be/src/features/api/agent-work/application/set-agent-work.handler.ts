import { CommandHandler } from "@nestjs/cqrs"
import { AgentWorkDoorsService } from "@modules/domain/agent-work"
import type { AgentWorkState } from "@modules/domain/agent-work"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SetAgentWorkCommand } from "./set-agent-work.command"

@CommandHandler(SetAgentWorkCommand)
/** Switches the work of one agent; only an owner may. */
export class SetAgentWorkHandler extends ICQRSHandler<SetAgentWorkCommand, AgentWorkState> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly doors: AgentWorkDoorsService,
    ) {
        super(logger)
    }

    protected override process(command: SetAgentWorkCommand): Promise<AgentWorkState> {
        return this.doors.setAgentWork(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.installationId,
            command.params.request.enabled,
        )
    }
}
