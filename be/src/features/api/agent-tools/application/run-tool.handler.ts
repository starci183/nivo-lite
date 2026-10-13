import { CommandHandler } from "@nestjs/cqrs"
import { AgentToolsService } from "@modules/domain/agent-tools"
import type { JsonResult } from "@modules/domain/agent-tools"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RunToolCommand } from "./run-tool.command"

@CommandHandler(RunToolCommand)
/** Runs the tool through the agent tools service; the token is the only authentication. */
export class RunToolHandler extends ICQRSHandler<RunToolCommand, JsonResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly tools: AgentToolsService,
    ) {
        super(logger)
    }

    protected override process(command: RunToolCommand): Promise<JsonResult> {
        return this.tools.runBearerTool(
            command.params.request.authorization,
            command.params.request.tool,
            command.params.request.args,
        )
    }
}
