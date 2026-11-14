import { CommandHandler } from "@nestjs/cqrs"
import { ScheduledItemsService, type RunNowAnswer } from "@modules/domain/agent-doors"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { RunScheduledItemNowCommand } from "./run-scheduled-item-now.command"

@CommandHandler(RunScheduledItemNowCommand)
/** "Run now": runs one scheduled item now, for an owner or a manager; the press is recorded with who and when. */
export class RunScheduledItemNowHandler extends ICQRSHandler<RunScheduledItemNowCommand, RunNowAnswer> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly items: ScheduledItemsService,
    ) {
        super(logger)
    }

    protected override process(command: RunScheduledItemNowCommand): Promise<RunNowAnswer> {
        return this.items.runNow(command.params.principal.id, command.params.request.workspaceId, command.params.request.id)
    }
}
