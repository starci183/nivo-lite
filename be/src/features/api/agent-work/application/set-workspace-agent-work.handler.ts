import { CommandHandler } from "@nestjs/cqrs"
import { AgentWorkDoorsService } from "@modules/domain/agent-work"
import type { AgentWorkSettingsRecord } from "@modules/domain/agent-work"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SetWorkspaceAgentWorkCommand } from "./set-workspace-agent-work.command"

@CommandHandler(SetWorkspaceAgentWorkCommand)
/** Switches the work of the whole workspace; only an owner may. */
export class SetWorkspaceAgentWorkHandler extends ICQRSHandler<SetWorkspaceAgentWorkCommand, AgentWorkSettingsRecord> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly doors: AgentWorkDoorsService,
    ) {
        super(logger)
    }

    protected override process(command: SetWorkspaceAgentWorkCommand): Promise<AgentWorkSettingsRecord> {
        return this.doors.setWorkspaceWork(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.enabled,
        )
    }
}
