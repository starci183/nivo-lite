import { CommandHandler } from "@nestjs/cqrs"
import { AutomationsService } from "@modules/domain/automations"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RunNowCommand } from "./run-now.command"
import type { RunNowResult } from "./run-now.contracts"

@CommandHandler(RunNowCommand)
/** Runs a scheduled n8n template once now. */
export class RunNowHandler extends ICQRSHandler<RunNowCommand, RunNowResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly automations: AutomationsService,
    ) {
        super(logger)
    }

    protected override process(message: RunNowCommand): Promise<RunNowResult> {
        return this.automations.runNow(
            message.params.principal.id,
            message.params.request.workspaceId,
            message.params.request.templateKey,
        )
    }
}
